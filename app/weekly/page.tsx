"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { WeeklyTask } from "@/lib/db";
import {
  getOrCreateWeeklyLog,
  getWeeklyLogByKey,
  updateWeeklyLog,
  getTasksForWeeklyLog,
  createWeeklyTask,
  updateWeeklyTask,
  completeWeeklyTask,
  reopenWeeklyTask,
  skipWeeklyTask,
  softDeleteWeeklyTask,
  carryForwardWeeklyTasks,
  taskCompletionPercent,
  targetProgressPercent,
  getOrCreateProfile,
  getDailyLogsInRange,
  getTasksForLog,
} from "@/lib/repositories";
import {
  operationalDate,
  isValidDateKey,
  getWeekBounds,
  formatWeekRange,
  getPrevWeekStartDate,
  getNextWeekStartDate,
  getWeekDays,
} from "@/lib/date";
import { format, parseISO } from "date-fns";
import { TaskRow } from "@/components/TaskRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  CheckIcon,
  CalendarRangeIcon,
  ArrowUpRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

function WeeklyPlannerContent() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryParam = searchParams.get("week") || searchParams.get("date");

  const [timezone, setTimezone] = useState("UTC");
  const [showAddTask, setShowAddTask] = useState(false);
  const [showPrevTasks, setShowPrevTasks] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getOrCreateProfile(),
  });

  const tz = profile?.timezone ?? timezone;
  const cutoff = profile?.preferences?.workdayCutoff ?? "00:00";
  const firstDayOfWeek = (profile?.preferences?.firstDayOfWeek === 0 ? 0 : 1) as 0 | 1;
  const operationalToday = operationalDate(new Date(), tz, cutoff);

  // Determine current active week date
  const anchorDate = queryParam && isValidDateKey(queryParam) ? queryParam : operationalToday;
  const currentWeekBounds = getWeekBounds(operationalToday, firstDayOfWeek, tz);
  const activeBounds = getWeekBounds(anchorDate, firstDayOfWeek, tz);

  const isCurrentActiveWeek = activeBounds.startDate === currentWeekBounds.startDate;
  const prevWeekStartDate = getPrevWeekStartDate(activeBounds.startDate);
  const prevWeekBounds = getWeekBounds(prevWeekStartDate, firstDayOfWeek, tz);
  const nextWeekStartDate = getNextWeekStartDate(activeBounds.startDate);

  // Fetch or create WeeklyLog for active week
  const { data: weeklyLog } = useQuery({
    queryKey: ["weeklyLog", activeBounds.startDate],
    queryFn: () => getOrCreateWeeklyLog(activeBounds.startDate, activeBounds.endDate),
    enabled: !!profile && !!activeBounds.startDate,
  });

  // Current week tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["weeklyTasks", weeklyLog?.id],
    queryFn: () => getTasksForWeeklyLog(weeklyLog!.id),
    enabled: !!weeklyLog?.id,
  });

  // Previous week query (for unfinished task shortcut banner on current week)
  const { data: prevLog = null } = useQuery({
    queryKey: ["weeklyLog", prevWeekStartDate],
    queryFn: async () => (await getWeeklyLogByKey(prevWeekStartDate)) ?? null,
    enabled: isCurrentActiveWeek && !!prevWeekStartDate,
  });

  const { data: prevTasks = [] } = useQuery({
    queryKey: ["weeklyTasks", prevLog?.id],
    queryFn: () => getTasksForWeeklyLog(prevLog!.id),
    enabled: isCurrentActiveWeek && !!prevLog?.id,
  });

  const unfinishedPrevTasks = prevTasks.filter((t) => t.status === "todo");

  // Daily logs for 7 days in the week (for Cadence overview)
  const weekDays = getWeekDays(activeBounds.startDate);
  const { data: dailyLogsInWeek = [] } = useQuery({
    queryKey: ["dailyLogsInWeek", activeBounds.startDate, activeBounds.endDate],
    queryFn: () => getDailyLogsInRange(activeBounds.startDate, activeBounds.endDate),
    enabled: !!activeBounds.startDate,
  });

  const dailyLogMap = Object.fromEntries(dailyLogsInWeek.map((l) => [l.date, l]));

  // Tasks count for daily logs in this week
  const { data: dailyTaskCounts = {} } = useQuery({
    queryKey: ["dailyTaskCounts", dailyLogsInWeek.map((l) => l.id)],
    queryFn: async () => {
      const counts: Record<string, { total: number; done: number }> = {};
      for (const log of dailyLogsInWeek) {
        const t = await getTasksForLog(log.id);
        const done = t.filter((item) => item.status === "done").length;
        counts[log.date] = { total: t.length, done };
      }
      return counts;
    },
    enabled: dailyLogsInWeek.length > 0,
  });

  // Derived calculations
  const completion = taskCompletionPercent(tasks);
  const targetPct = targetProgressPercent(tasks);
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const activeTasks = tasks.filter((t) => t.status !== "skipped").length;

  // Week temporal relation
  const isPastWeek = activeBounds.startDate < currentWeekBounds.startDate;

  // Navigation handlers
  const navigateToDate = (targetDate: string) => {
    const targetBounds = getWeekBounds(targetDate, firstDayOfWeek, tz);
    if (targetBounds.startDate === currentWeekBounds.startDate) {
      router.push("/weekly");
    } else {
      router.push(`/weekly?week=${targetBounds.startDate}`);
    }
  };

  const goToPrevWeek = () => navigateToDate(prevWeekStartDate);
  const goToNextWeek = () => navigateToDate(nextWeekStartDate);
  const goToCurrentWeek = () => router.push("/weekly");

  // Mutations
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["weeklyTasks", weeklyLog?.id] });
    qc.invalidateQueries({ queryKey: ["weeklyLog", activeBounds.startDate] });
  };

  const addTask = useMutation({
    mutationFn: async () => {
      if (!weeklyLog || !newTitle.trim()) return;
      await createWeeklyTask(
        weeklyLog.id,
        {
          title: newTitle.trim(),
          targetValue: newTarget ? parseFloat(newTarget) : null,
          unit: newUnit.trim() || null,
        },
        tasks.length,
      );
    },
    onSuccess: () => {
      setNewTitle("");
      setNewTarget("");
      setNewUnit("");
      setShowAddTask(false);
      invalidate();
    },
  });

  const toggleTask = useMutation({
    mutationFn: async (task: WeeklyTask) => {
      if (task.status === "done") await reopenWeeklyTask(task.id);
      else await completeWeeklyTask(task.id);
    },
    onSuccess: invalidate,
  });

  const skipTaskMut = useMutation({
    mutationFn: (id: string) => skipWeeklyTask(id),
    onSuccess: invalidate,
  });

  const deleteTaskMut = useMutation({
    mutationFn: (id: string) => softDeleteWeeklyTask(id),
    onSuccess: invalidate,
  });

  const updateTaskValue = useMutation({
    mutationFn: async ({ id, completedValue }: { id: string; completedValue: number }) => {
      await updateWeeklyTask(id, { completedValue });
    },
    onSuccess: invalidate,
  });

  const completePrevTask = useMutation({
    mutationFn: async (taskId: string) => {
      await completeWeeklyTask(taskId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weeklyTasks", prevLog?.id] });
      qc.invalidateQueries({ queryKey: ["weeklyTasks", weeklyLog?.id] });
    },
  });

  const completeAllPrevTasks = useMutation({
    mutationFn: async () => {
      for (const t of unfinishedPrevTasks) {
        await completeWeeklyTask(t.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weeklyTasks", prevLog?.id] });
      qc.invalidateQueries({ queryKey: ["weeklyTasks", weeklyLog?.id] });
    },
  });

  const carryForwardMut = useMutation({
    mutationFn: async () => {
      if (!prevLog || !weeklyLog) return;
      await carryForwardWeeklyTasks(prevLog.id, weeklyLog.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weeklyTasks", prevLog?.id] });
      qc.invalidateQueries({ queryKey: ["weeklyTasks", weeklyLog?.id] });
    },
  });

  const updateNote = useMutation({
    mutationFn: async (value: string) => {
      if (!weeklyLog) return;
      await updateWeeklyLog(weeklyLog.id, { note: value });
    },
  });

  useEffect(() => {
    if (showAddTask) setTimeout(() => addInputRef.current?.focus(), 50);
  }, [showAddTask]);

  return (
    <div className="page fade-in flex flex-col gap-4">
      {/* Editorial Page Header with Integrated Week Navigator */}
      <PageHeader
        title={isCurrentActiveWeek ? "Weekly Planner" : formatWeekRange(activeBounds.startDate, activeBounds.endDate)}
        badge={
          isCurrentActiveWeek ? (
            <span className="badge badge-secondary font-mono text-[10px] text-accent uppercase tracking-wider">
              Current Week · W{activeBounds.weekNumber}
            </span>
          ) : isPastWeek ? (
            <span className="badge badge-secondary font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Past Week · W{activeBounds.weekNumber}
            </span>
          ) : (
            <span className="badge badge-secondary font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Upcoming Week · W{activeBounds.weekNumber}
            </span>
          )
        }
        description={
          <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <CalendarRangeIcon className="size-3.5 text-subtle-foreground" />
            {format(parseISO(activeBounds.startDate), "EEEE, MMM d")} — {format(parseISO(activeBounds.endDate), "EEEE, MMM d, yyyy")}
          </span>
        }
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Segmented Week Pager */}
            <div className="flex items-center rounded-lg border border-border bg-surface-muted/40 p-0.5">
              <button
                id="prev-week-btn"
                type="button"
                className="btn-icon size-7 border-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted"
                onClick={goToPrevWeek}
                title="Previous week"
                aria-label="Previous week"
              >
                <ChevronLeftIcon className="size-3.5" />
              </button>

              <div className="relative flex items-center px-1">
                <input
                  id="week-picker-input"
                  type="date"
                  className="bg-transparent text-xs font-mono text-foreground cursor-pointer outline-none border-0 py-0.5 px-1.5 rounded hover:bg-surface-muted transition-colors w-[124px]"
                  value={activeBounds.startDate}
                  onChange={(e) => e.target.value && navigateToDate(e.target.value)}
                  title="Jump to week by date"
                  aria-label="Choose week date"
                />
              </div>

              <button
                id="next-week-btn"
                type="button"
                className="btn-icon size-7 border-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted"
                onClick={goToNextWeek}
                title="Next week"
                aria-label="Next week"
              >
                <ChevronRightIcon className="size-3.5" />
              </button>
            </div>

            {!isCurrentActiveWeek && (
              <button
                id="jump-current-week-btn"
                type="button"
                className="btn btn-ghost btn-sm text-xs font-mono h-8 text-foreground"
                onClick={goToCurrentWeek}
              >
                Jump to This Week
              </button>
            )}

            <button
              id="add-weekly-task-btn"
              className="btn btn-primary btn-sm flex items-center gap-1.5 font-semibold text-xs h-8"
              onClick={() => setShowAddTask((v) => !v)}
            >
              <PlusIcon className="size-3.5 stroke-[2.5]" />
              <span>Add task</span>
            </button>
          </div>
        }
      />

      {/* Previous Week Unfinished Tasks Shortcut Banner */}
      {isCurrentActiveWeek && unfinishedPrevTasks.length > 0 && (
        <div
          id="prev-week-banner"
          className="rounded-xl border border-border/80 bg-surface/80 p-3 sm:px-4 sm:py-3 flex flex-col gap-2.5 transition-all"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="size-2 rounded-full bg-warning shrink-0" />
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground">
                  Previous week
                </span>
                <span className="text-xs text-muted-foreground">
                  · <span className="font-mono tabular-nums text-foreground">{unfinishedPrevTasks.length}</span> unfinished {unfinishedPrevTasks.length === 1 ? "task" : "tasks"}
                </span>
                <span className="text-[11px] text-subtle-foreground font-mono">
                  ({formatWeekRange(prevWeekBounds.startDate, prevWeekBounds.endDate)})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="carry-forward-btn"
                type="button"
                className="btn btn-secondary btn-sm text-xs h-7 px-2.5 flex items-center gap-1 text-foreground"
                onClick={() => carryForwardMut.mutate()}
                disabled={carryForwardMut.isPending}
                title="Copy incomplete tasks from previous week into this week"
              >
                <span>Move to this week</span>
              </button>
              <button
                id="toggle-prev-weekly-tasks-btn"
                type="button"
                className="btn btn-ghost btn-sm text-xs h-7 px-2.5"
                onClick={() => setShowPrevTasks((v) => !v)}
              >
                {showPrevTasks ? "Hide items" : "Quick complete"}
              </button>
              <button
                id="open-prev-week-btn"
                type="button"
                className="btn btn-ghost btn-sm text-xs h-7 px-2.5 flex items-center gap-1 text-foreground"
                onClick={() => navigateToDate(prevWeekStartDate)}
              >
                <span>Open week</span>
                <ArrowRightIcon className="size-3 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Expandable tasks list to mark items complete directly */}
          {showPrevTasks && (
            <div className="pt-2 border-t border-border/50 flex flex-col gap-1">
              <div className="flex items-center justify-between pb-1 text-[11px] text-subtle-foreground font-mono">
                <span>Incomplete from {formatWeekRange(prevWeekBounds.startDate, prevWeekBounds.endDate)}:</span>
                <button
                  type="button"
                  className="hover:text-foreground text-accent text-[11px] font-mono transition-colors"
                  onClick={() => completeAllPrevTasks.mutate()}
                >
                  Mark all complete
                </button>
              </div>
              <div className="flex flex-col divide-y divide-border/30">
                {unfinishedPrevTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 py-2 px-1 hover:bg-surface-muted/20 transition-colors rounded"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        id={`complete-prev-weekly-${t.id}`}
                        aria-label={`Complete task ${t.title}`}
                        className="checkbox size-4 shrink-0"
                        onClick={() => completePrevTask.mutate(t.id)}
                      >
                        <CheckIcon className="size-2.5 text-background stroke-[2.5]" />
                      </button>
                      <span className="text-xs text-foreground truncate">{t.title}</span>
                      {t.targetValue != null && (
                        <span className="text-[11px] text-subtle-foreground font-mono tabular-nums shrink-0">
                          ({t.completedValue}/{t.targetValue} {t.unit ?? ""})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-[11px] h-6 px-2 font-mono text-muted-foreground hover:text-foreground shrink-0"
                      onClick={() => completePrevTask.mutate(t.id)}
                    >
                      Done
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main 2-column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Weekly Tasks (~65%) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="card p-0 flex flex-col overflow-hidden">
            {/* Integrated Header with Progress Indicator */}
            <div className="px-4 py-3 bg-surface-muted/30 border-b border-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                  Weekly Tasks
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="text-foreground font-mono font-medium tabular-nums">{doneTasks}</span> of{" "}
                  <span className="font-mono tabular-nums">{activeTasks}</span> done
                  {tasks.some((t) => t.targetValue != null) && (
                    <> · <span className="font-mono tabular-nums text-foreground">{targetPct}%</span> target</>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-24 sm:w-36 h-1.5 bg-surface-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <span className="text-xs font-semibold font-mono text-accent tabular-nums min-w-[3ch] text-right">
                  {completion}%
                </span>
              </div>
            </div>

            {/* Inline Add Task Form */}
            {showAddTask && (
              <div className="p-3.5 bg-surface-raised border-b border-border/60 fade-in flex flex-col gap-2.5">
                <input
                  ref={addInputRef}
                  id="new-weekly-task-title"
                  className="input input-sm"
                  placeholder={
                    isCurrentActiveWeek
                      ? "What needs to be accomplished this week?"
                      : `Add task for week of ${format(parseISO(activeBounds.startDate), "MMM d")}`
                  }
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTask.mutate();
                    if (e.key === "Escape") setShowAddTask(false);
                  }}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    id="new-weekly-task-target"
                    className="input input-sm"
                    type="number"
                    placeholder="Target number (optional)"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                  />
                  <input
                    id="new-weekly-task-unit"
                    className="input input-sm"
                    placeholder="Unit (e.g. chapters, workouts, hours)"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    className="btn btn-primary btn-sm text-xs"
                    onClick={() => addTask.mutate()}
                    disabled={!newTitle.trim()}
                  >
                    Add Task
                  </button>
                  <button
                    className="btn btn-ghost btn-sm text-xs"
                    onClick={() => setShowAddTask(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Tasks Container */}
            {tasks.length === 0 ? (
              <div className="py-10 px-4 flex flex-col items-center justify-center text-center">
                <div className="p-3 rounded-full bg-surface-muted/60 border border-border/60 mb-2.5">
                  <CalendarRangeIcon className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground tracking-tight">
                  {isCurrentActiveWeek
                    ? "Plan your major outcomes for this week."
                    : `No tasks planned for week of ${format(parseISO(activeBounds.startDate), "MMM d")}.`}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                  {isCurrentActiveWeek
                    ? "Weekly planning provides the clarity and direction needed before daily demands take over."
                    : "You can add goals or tasks retroactively to this week."}
                </p>
                <button
                  className="btn btn-secondary btn-sm mt-3.5 text-xs"
                  onClick={() => setShowAddTask(true)}
                >
                  + Add task to this week
                </button>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/40">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    editing={editingId === task.id}
                    onToggle={() => toggleTask.mutate(task)}
                    onSkip={() => skipTaskMut.mutate(task.id)}
                    onDelete={() => deleteTaskMut.mutate(task.id)}
                    onEditValue={(v) => updateTaskValue.mutate({ id: task.id, completedValue: v })}
                    onSetEditing={(id) => setEditingId(id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Week Cadence & Focus Notes (~35%) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* 7-Day Week Cadence Overview & Quick Jump to Day Logs */}
          <section className="flex flex-col gap-2">
            <SectionHeading
              title="Week Cadence"
              description="7-day overview & jump to daily logs"
            />
            <div className="card p-3 flex flex-col gap-1.5">
              <div className="grid grid-cols-7 gap-1 text-center select-none pb-1 border-b border-border/40">
                {weekDays.map((d) => {
                  const parsed = parseISO(d);
                  const isToday = d === operationalToday;
                  const dayName = format(parsed, "EEE");
                  const dayNum = format(parsed, "d");
                  const hasLog = !!dailyLogMap[d];
                  const taskStats = dailyTaskCounts[d];

                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => router.push(`/today?date=${d}`)}
                      className={cn(
                        "group flex flex-col items-center py-2 px-1 rounded-lg transition-all outline-none border",
                        isToday
                          ? "bg-accent/15 border-accent text-accent font-semibold ring-1 ring-accent"
                          : hasLog
                            ? "bg-surface-raised border-border/80 text-foreground hover:border-foreground/30 hover:bg-surface-muted"
                            : "bg-surface-muted/40 border-border/30 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                      )}
                      title={`Open workday for ${format(parsed, "EEEE, MMM d")}`}
                    >
                      <span className="text-[10px] uppercase font-mono tracking-wider opacity-70">
                        {dayName.slice(0, 3)}
                      </span>
                      <span className="text-xs font-mono font-medium mt-0.5">
                        {dayNum}
                      </span>
                      {taskStats && taskStats.total > 0 ? (
                        <span className="text-[9px] font-mono mt-1 opacity-80">
                          {taskStats.done}/{taskStats.total}
                        </span>
                      ) : (
                        <span className="size-1 rounded-full mt-1.5 bg-border group-hover:bg-muted-foreground transition-colors" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1 px-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-accent" />
                  Today is {format(parseISO(operationalToday), "EEE, MMM d")}
                </span>
                <button
                  type="button"
                  onClick={() => router.push("/today")}
                  className="hover:text-foreground text-accent inline-flex items-center gap-0.5 font-mono text-[10px] transition-colors"
                >
                  <span>Open Today</span>
                  <ArrowUpRightIcon className="size-3" />
                </button>
              </div>
            </div>
          </section>

          {/* Weekly Summary Metrics */}
          <section className="flex flex-col gap-2">
            <SectionHeading
              title="Weekly Cadence Stats"
              description="Planned vs completed overview"
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="card p-3 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                  Planned Tasks
                </span>
                <span className="text-xl font-bold font-mono text-foreground tabular-nums">
                  {tasks.length}
                </span>
                <span className="text-[10px] text-subtle-foreground font-mono">
                  {activeTasks} active · {tasks.length - activeTasks} skipped
                </span>
              </div>

              <div className="card p-3 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                  Completed
                </span>
                <span className="text-xl font-bold font-mono text-accent tabular-nums">
                  {completion}%
                </span>
                <span className="text-[10px] text-subtle-foreground font-mono">
                  {doneTasks} of {activeTasks} tasks done
                </span>
              </div>
            </div>
          </section>

          {/* Weekly Focus & Strategic Objectives Note */}
          <section className="flex flex-col gap-2">
            <SectionHeading
              title="Weekly Focus & Objectives"
              description={`Key priorities for ${formatWeekRange(activeBounds.startDate, activeBounds.endDate)}`}
            />
            <div className="card p-2.5">
              <textarea
                key={`weekly-note-${activeBounds.startDate}`}
                id="weekly-note"
                className="w-full bg-transparent resize-y text-xs text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[96px] leading-relaxed p-1"
                placeholder="What are the essential themes or outcomes for this week? Key milestones, focus projects, deadlines..."
                defaultValue={weeklyLog?.note ?? ""}
                rows={4}
                onBlur={(e) => updateNote.mutate(e.target.value)}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function WeeklyPlannerPage() {
  return (
    <Suspense
      fallback={
        <div className="page p-8 text-center text-xs text-muted-foreground">
          Loading weekly planner...
        </div>
      }
    >
      <WeeklyPlannerContent />
    </Suspense>
  );
}
