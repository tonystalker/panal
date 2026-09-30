"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, TaskInstance } from "@/lib/db";
import {
  getOrCreateDailyLog,
  getTasksForLog,
  createTask,
  updateTask,
  completeTask,
  reopenTask,
  skipTask,
  softDeleteTask,
  getManualMetricsForLog,
  upsertManualMetric,
  taskCompletionPercent,
  targetProgressPercent,
  getOrCreateProfile,
  getDailyLogByDate,
  addCustomMetric,
  deleteCustomMetric,
} from "@/lib/repositories";
import { operationalDate, dateLabel, isValidDateKey } from "@/lib/date";
import { format, parseISO, subDays, addDays } from "date-fns";
import { TaskRow } from "@/components/TaskRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  PlusIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

type ManualMetricKey = "exercise_minutes" | "mobile_usage_minutes" | "dsa_problems";

const MANUAL_METRICS: { key: ManualMetricKey; label: string; unit: string; placeholder: string }[] =
  [
    { key: "exercise_minutes", label: "Exercise", unit: "min", placeholder: "0" },
    { key: "dsa_problems", label: "DSA problems", unit: "solved", placeholder: "0" },
    { key: "mobile_usage_minutes", label: "Mobile usage", unit: "min", placeholder: "0" },
  ];

function TodayContent() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryDate = searchParams.get("date");

  const [timezone, setTimezone] = useState("UTC");
  const [showAddTask, setShowAddTask] = useState(false);
  const [showPrevTasks, setShowPrevTasks] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Custom metric creation state
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [metricName, setMetricName] = useState("");
  const [metricUnit, setMetricUnit] = useState("");
  const [metricGoal, setMetricGoal] = useState("");
  const [metricAddToDashboard, setMetricAddToDashboard] = useState(true);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getOrCreateProfile(),
  });

  const tz = profile?.timezone ?? timezone;
  const cutoff = profile?.preferences?.workdayCutoff ?? "00:00";
  const operationalToday = operationalDate(new Date(), tz, cutoff);

  // If query param ?date=YYYY-MM-DD is present and valid, use it; otherwise default to operational today
  const dateKey = queryDate && isValidDateKey(queryDate) ? queryDate : operationalToday;
  const isCurrentOperationalToday = dateKey === operationalToday;
  const prevWorkdayKey = format(subDays(parseISO(operationalToday), 1), "yyyy-MM-dd");

  const { data: log } = useQuery({
    queryKey: ["dailyLog", dateKey],
    queryFn: () => getOrCreateDailyLog(dateKey, tz),
    enabled: !!dateKey && !!tz,
  });

  // Current day tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", log?.id],
    queryFn: () => getTasksForLog(log!.id),
    enabled: !!log?.id,
  });

  // Current day manual metrics
  const { data: metrics = [] } = useQuery({
    queryKey: ["manualMetrics", log?.id],
    queryFn: () => getManualMetricsForLog(log!.id),
    enabled: !!log?.id,
  });

  // Previous operational day query (for unfinished task shortcut banner on Today)
  const { data: prevLog } = useQuery({
    queryKey: ["dailyLog", prevWorkdayKey],
    queryFn: () => getDailyLogByDate(prevWorkdayKey),
    enabled: isCurrentOperationalToday && !!prevWorkdayKey,
  });

  const { data: prevTasks = [] } = useQuery({
    queryKey: ["tasks", prevLog?.id],
    queryFn: () => getTasksForLog(prevLog!.id),
    enabled: isCurrentOperationalToday && !!prevLog?.id,
  });

  const unfinishedPrevTasks = prevTasks.filter((t) => t.status === "todo");

  // Derived state
  const completion = taskCompletionPercent(tasks);
  const targetPct = targetProgressPercent(tasks);
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const activeTasks = tasks.filter((t) => t.status !== "skipped").length;

  const getMetricValue = (key: string) => metrics.find((m) => m.metricKey === key)?.value ?? 0;

  // Navigation handlers
  const navigateToDate = (targetDate: string) => {
    if (targetDate === operationalToday) {
      router.push("/today");
    } else {
      router.push(`/today?date=${targetDate}`);
    }
  };

  const goToPrevDay = () => {
    const prev = format(subDays(parseISO(dateKey), 1), "yyyy-MM-dd");
    navigateToDate(prev);
  };

  const goToNextDay = () => {
    const next = format(addDays(parseISO(dateKey), 1), "yyyy-MM-dd");
    navigateToDate(next);
  };

  const goToToday = () => {
    navigateToDate(operationalToday);
  };

  // Mutations
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tasks", log?.id] });
    qc.invalidateQueries({ queryKey: ["manualMetrics", log?.id] });
    qc.invalidateQueries({ queryKey: ["dailyLog", dateKey] });
    qc.invalidateQueries({ queryKey: ["calendar-completion"] });
    qc.invalidateQueries({ queryKey: ["logs-recent"] });
  };

  const addTask = useMutation({
    mutationFn: async () => {
      if (!log || !newTitle.trim()) return;
      await createTask(
        log.id,
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
    mutationFn: async (task: TaskInstance) => {
      if (task.status === "done") await reopenTask(task.id);
      else await completeTask(task.id);
    },
    onSuccess: invalidate,
  });

  const completePrevTask = useMutation({
    mutationFn: async (taskId: string) => {
      await completeTask(taskId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", prevLog?.id] });
      qc.invalidateQueries({ queryKey: ["tasks", log?.id] });
      qc.invalidateQueries({ queryKey: ["dailyLog", prevWorkdayKey] });
      qc.invalidateQueries({ queryKey: ["calendar-completion"] });
      qc.invalidateQueries({ queryKey: ["logs-recent"] });
    },
  });

  const completeAllPrevTasks = useMutation({
    mutationFn: async () => {
      for (const t of unfinishedPrevTasks) {
        await completeTask(t.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", prevLog?.id] });
      qc.invalidateQueries({ queryKey: ["tasks", log?.id] });
      qc.invalidateQueries({ queryKey: ["dailyLog", prevWorkdayKey] });
      qc.invalidateQueries({ queryKey: ["calendar-completion"] });
      qc.invalidateQueries({ queryKey: ["logs-recent"] });
    },
  });

  const skipTaskMut = useMutation({
    mutationFn: (id: string) => skipTask(id),
    onSuccess: invalidate,
  });

  const deleteTaskMut = useMutation({
    mutationFn: (id: string) => softDeleteTask(id),
    onSuccess: invalidate,
  });

  const updateMetric = useMutation({
    mutationFn: async ({ key, value, unit }: { key: string; value: number; unit: string }) => {
      if (!log) return;
      await upsertManualMetric(log.id, key, value, unit);
    },
    onSuccess: invalidate,
  });

  const updateNote = useMutation({
    mutationFn: async (value: string) => {
      if (!log) return;
      await db.dailyLogs.update(log.id, { note: value });
    },
  });

  const updateTaskValue = useMutation({
    mutationFn: async ({ id, completedValue }: { id: string; completedValue: number }) => {
      await updateTask(id, { completedValue });
    },
    onSuccess: invalidate,
  });

  const addCustomMetricMut = useMutation({
    mutationFn: async () => {
      if (!metricName.trim()) return;
      await addCustomMetric({
        label: metricName.trim(),
        unit: metricUnit.trim(),
        goalLine: metricGoal ? parseFloat(metricGoal) : null,
        addToDashboard: metricAddToDashboard,
      });
    },
    onSuccess: () => {
      setMetricName("");
      setMetricUnit("");
      setMetricGoal("");
      setMetricAddToDashboard(true);
      setShowAddMetric(false);
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboardWidgets"] });
    },
  });

  const deleteCustomMetricMut = useMutation({
    mutationFn: async (key: string) => {
      await deleteCustomMetric(key);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboardWidgets"] });
    },
  });

  useEffect(() => {
    if (showAddTask) setTimeout(() => addInputRef.current?.focus(), 50);
  }, [showAddTask]);

  if (!dateKey) return null;

  return (
    <div className="page fade-in flex flex-col gap-4">
      {/* Editorial Page Header with Integrated Date Navigator */}
      <PageHeader
        title={isCurrentOperationalToday ? "Today" : dateLabel(dateKey, tz, cutoff)}
        badge={
          !isCurrentOperationalToday ? (
            <span className="badge badge-secondary font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Historical Workday
            </span>
          ) : cutoff !== "00:00" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-surface-muted text-subtle-foreground border border-border">
              <ClockIcon className="size-2.5 text-accent" />
              <span>{cutoff} cutoff</span>
            </span>
          ) : undefined
        }
        description={
          <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <CalendarIcon className="size-3.5 text-subtle-foreground" />
            {format(parseISO(dateKey), "EEEE, MMMM d, yyyy")}
          </span>
        }
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Segmented Day Pager */}
            <div className="flex items-center rounded-lg border border-border bg-surface-muted/40 p-0.5">
              <button
                id="prev-day-btn"
                type="button"
                className="btn-icon size-7 border-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted"
                onClick={goToPrevDay}
                title="Previous workday"
                aria-label="Previous workday"
              >
                <ChevronLeftIcon className="size-3.5" />
              </button>

              <div className="relative flex items-center px-1">
                <input
                  id="date-picker-input"
                  type="date"
                  className="bg-transparent text-xs font-mono text-foreground cursor-pointer outline-none border-0 py-0.5 px-1.5 rounded hover:bg-surface-muted transition-colors w-[124px]"
                  value={dateKey}
                  onChange={(e) => e.target.value && navigateToDate(e.target.value)}
                  title="Jump to date"
                  aria-label="Choose workday date"
                />
              </div>

              <button
                id="next-day-btn"
                type="button"
                className="btn-icon size-7 border-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted"
                onClick={goToNextDay}
                title="Next workday"
                aria-label="Next workday"
              >
                <ChevronRightIcon className="size-3.5" />
              </button>
            </div>

            {!isCurrentOperationalToday && (
              <button
                id="jump-today-btn"
                type="button"
                className="btn btn-ghost btn-sm text-xs font-mono h-8 text-foreground"
                onClick={goToToday}
              >
                Jump to Today
              </button>
            )}

            <button
              id="add-task-btn"
              className="btn btn-primary btn-sm flex items-center gap-1.5 font-semibold text-xs h-8"
              onClick={() => setShowAddTask((v) => !v)}
            >
              <PlusIcon className="size-3.5 stroke-[2.5]" />
              <span>Add task</span>
            </button>
          </div>
        }
      />

      {/* Previous Workday Unfinished Tasks Shortcut Banner */}
      {isCurrentOperationalToday && unfinishedPrevTasks.length > 0 && (
        <div
          id="prev-workday-banner"
          className="rounded-xl border border-border/80 bg-surface/80 p-3 sm:px-4 sm:py-3 flex flex-col gap-2.5 transition-all"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="size-2 rounded-full bg-warning shrink-0" />
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground">
                  Previous workday
                </span>
                <span className="text-xs text-muted-foreground">
                  · <span className="font-mono tabular-nums text-foreground">{unfinishedPrevTasks.length}</span> unfinished {unfinishedPrevTasks.length === 1 ? "task" : "tasks"}
                </span>
                <span className="text-[11px] text-subtle-foreground font-mono">
                  ({format(parseISO(prevWorkdayKey), "MMM d")})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="toggle-prev-tasks-btn"
                type="button"
                className="btn btn-ghost btn-sm text-xs h-7 px-2.5"
                onClick={() => setShowPrevTasks((v) => !v)}
              >
                {showPrevTasks ? "Hide items" : "Quick complete"}
              </button>
              <button
                id="open-prev-workday-btn"
                type="button"
                className="btn btn-ghost btn-sm text-xs h-7 px-2.5 flex items-center gap-1 text-foreground"
                onClick={() => navigateToDate(prevWorkdayKey)}
              >
                <span>Open day</span>
                <ArrowRightIcon className="size-3 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Expandable tasks list to mark items complete directly */}
          {showPrevTasks && (
            <div className="pt-2 border-t border-border/50 flex flex-col gap-1">
              <div className="flex items-center justify-between pb-1 text-[11px] text-subtle-foreground font-mono">
                <span>Incomplete from {prevWorkdayKey}:</span>
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
                        id={`complete-prev-${t.id}`}
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

      {/* Main 2-column Layout on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (Primary Tasks Workflow ~ 65%) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Unified Compact Tasks Surface */}
          <div className="card p-0 flex flex-col overflow-hidden">
            {/* Integrated Header with Precision Progress Indicator */}
            <div className="px-4 py-3 bg-surface-muted/30 border-b border-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                  Tasks
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
                  id="new-task-title"
                  className="input input-sm"
                  placeholder={
                    isCurrentOperationalToday
                      ? "What needs to be done today?"
                      : `Add task for ${dateKey}`
                  }
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask.mutate()}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    id="new-task-target"
                    className="input input-sm"
                    type="number"
                    placeholder="Target number (optional)"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                  />
                  <input
                    id="new-task-unit"
                    className="input input-sm"
                    placeholder="Unit (e.g. problems, pages)"
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
              <div className="py-7 px-4 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-foreground tracking-tight">
                  {isCurrentOperationalToday
                    ? "Plan one thing worth finishing today."
                    : `No tasks logged for ${format(parseISO(dateKey), "MMM d")}.`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-sm leading-relaxed">
                  {isCurrentOperationalToday
                    ? "A clear, quiet day begins with a single focused task."
                    : "You can add tasks retroactively to this workday."}
                </p>
                <button
                  className="btn btn-secondary btn-sm mt-3 text-xs"
                  onClick={() => setShowAddTask(true)}
                >
                  + Add task to this day
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

        {/* Right Column (Narrow grouped check-ins and reflection ~ 35%) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Manual Metrics — Grouped Rows */}
          <section className="flex flex-col gap-2">
            <SectionHeading
              title="Manual Check-ins"
              description={`Habits & metrics for ${format(parseISO(dateKey), "MMM d")}`}
              action={
                <button
                  id="add-custom-metric-btn"
                  type="button"
                  className="btn btn-ghost btn-sm h-7 px-2 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAddMetric((prev) => !prev)}
                  title="Add metric to track"
                  aria-label="Add metric to track"
                >
                  <PlusIcon className="size-3.5" />
                  <span>Add</span>
                </button>
              }
            />

            {showAddMetric && (
              <div className="rounded-xl border border-border/80 bg-surface/80 p-3.5 flex flex-col gap-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                  <span className="text-xs font-semibold text-foreground">Add Custom Metric</span>
                  <button
                    type="button"
                    className="btn-icon size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAddMetric(false)}
                    aria-label="Close"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Metric Name
                    </label>
                    <input
                      id="custom-metric-name"
                      type="text"
                      placeholder="e.g. Water intake, Push-ups, Reading"
                      value={metricName}
                      onChange={(e) => setMetricName(e.target.value)}
                      className="input input-sm text-xs w-full"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && metricName.trim()) {
                          e.preventDefault();
                          addCustomMetricMut.mutate();
                        }
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Unit
                      </label>
                      <input
                        id="custom-metric-unit"
                        type="text"
                        placeholder="e.g. glasses, ml, pages"
                        value={metricUnit}
                        onChange={(e) => setMetricUnit(e.target.value)}
                        className="input input-sm text-xs w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Daily Goal (optional)
                      </label>
                      <input
                        id="custom-metric-goal"
                        type="number"
                        placeholder="e.g. 8"
                        value={metricGoal}
                        onChange={(e) => setMetricGoal(e.target.value)}
                        className="input input-sm text-xs w-full font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                    <input
                      id="custom-metric-add-widget"
                      type="checkbox"
                      checked={metricAddToDashboard}
                      onChange={(e) => setMetricAddToDashboard(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent bg-surface-muted size-3.5"
                    />
                    <span className="text-xs text-foreground">Add to Dashboard widgets</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-xs h-7 px-2.5"
                    onClick={() => setShowAddMetric(false)}
                  >
                    Cancel
                  </button>
                  <button
                    id="save-custom-metric-btn"
                    type="button"
                    className="btn btn-primary btn-sm text-xs h-7 px-3"
                    disabled={!metricName.trim() || addCustomMetricMut.isPending}
                    onClick={() => addCustomMetricMut.mutate()}
                  >
                    {addCustomMetricMut.isPending ? "Adding…" : "Add Metric"}
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border/80 divide-y divide-border/60 bg-surface/50 overflow-hidden">
              {MANUAL_METRICS.map((m) => (
                <div
                  key={m.key}
                  className="flex items-center justify-between gap-4 px-3.5 py-2.5 hover:bg-surface-muted/20 transition-colors"
                >
                  <div className="flex items-baseline gap-1.5 shrink-0 select-none">
                    <span className="text-xs font-medium text-foreground whitespace-nowrap">{m.label}</span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">({m.unit})</span>
                  </div>
                  <input
                    key={`${dateKey}-${m.key}`}
                    id={`metric-${m.key}`}
                    type="text"
                    inputMode="numeric"
                    style={{ width: "4rem" }}
                    className="h-7 w-16 shrink-0 rounded-md border border-border/80 bg-surface-muted/60 px-2 text-right font-mono text-xs tabular-nums text-foreground outline-none transition-colors hover:border-border-strong focus:border-border-strong focus:bg-surface-muted focus:ring-1 focus:ring-border-strong"
                    defaultValue={getMetricValue(m.key) || ""}
                    placeholder={m.placeholder}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        updateMetric.mutate({ key: m.key, value: val, unit: m.unit });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                </div>
              ))}

              {(profile?.preferences?.customMetrics ?? []).map((cm) => (
                <div
                  key={cm.key}
                  className="group flex items-center justify-between gap-4 px-3.5 py-2.5 hover:bg-surface-muted/20 transition-colors"
                >
                  <div className="flex items-baseline gap-1.5 shrink-0 select-none">
                    <span className="text-xs font-medium text-foreground whitespace-nowrap">{cm.label}</span>
                    {cm.unit && (
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">({cm.unit})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      key={`${dateKey}-${cm.key}`}
                      id={`metric-${cm.key}`}
                      type="text"
                      inputMode="numeric"
                      style={{ width: "4rem" }}
                      className="h-7 w-16 shrink-0 rounded-md border border-border/80 bg-surface-muted/60 px-2 text-right font-mono text-xs tabular-nums text-foreground outline-none transition-colors hover:border-border-strong focus:border-border-strong focus:bg-surface-muted focus:ring-1 focus:ring-border-strong"
                      defaultValue={getMetricValue(cm.key) || ""}
                      placeholder="0"
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0) {
                          updateMetric.mutate({ key: cm.key, value: val, unit: cm.unit });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                    <button
                      id={`delete-custom-metric-${cm.key}`}
                      type="button"
                      className="btn-icon size-7 text-muted-foreground hover:text-destructive opacity-40 hover:opacity-100 transition-opacity"
                      onClick={() => deleteCustomMetricMut.mutate(cm.key)}
                      title={`Remove ${cm.label}`}
                      aria-label={`Remove ${cm.label}`}
                    >
                      <Trash2Icon className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Daily Note / Reflection */}
          <section className="flex flex-col gap-2">
            <SectionHeading
              title="Daily Reflection"
              description={`Context & thoughts for ${format(parseISO(dateKey), "MMM d")}`}
            />
            <div className="rounded-xl border border-border/80 bg-surface/50 p-2.5">
              <textarea
                key={`note-${dateKey}`}
                id="daily-note"
                className="w-full bg-transparent resize-y text-xs text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[76px] leading-relaxed p-1"
                placeholder="How did this workday go? Any key reflections…"
                defaultValue={log?.note ?? ""}
                rows={3}
                onBlur={(e) => updateNote.mutate(e.target.value)}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function TodayPage() {
  return (
    <Suspense
      fallback={
        <div className="page p-8 text-center text-xs text-muted-foreground">
          Loading workday...
        </div>
      }
    >
      <TodayContent />
    </Suspense>
  );
}
