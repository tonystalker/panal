"use client";

import { useState, useEffect, useRef } from "react";
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
} from "@/lib/repositories";
import { todayKey } from "@/lib/date";
import { TaskRow } from "@/components/TaskRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PlusIcon, CalendarIcon } from "lucide-react";

type ManualMetricKey = "exercise_minutes" | "mobile_usage_minutes" | "dsa_problems";

const MANUAL_METRICS: { key: ManualMetricKey; label: string; unit: string; placeholder: string }[] =
  [
    { key: "exercise_minutes", label: "Exercise", unit: "min", placeholder: "0" },
    { key: "dsa_problems", label: "DSA problems", unit: "solved", placeholder: "0" },
    { key: "mobile_usage_minutes", label: "Mobile usage", unit: "min", placeholder: "0" },
  ];

export default function TodayPage() {
  const qc = useQueryClient();
  const [timezone, setTimezone] = useState("UTC");
  const [dateKey, setDateKey] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(tz);
    setDateKey(todayKey(tz));
  }, []);

  const { data: log } = useQuery({
    queryKey: ["dailyLog", dateKey],
    queryFn: () => getOrCreateDailyLog(dateKey, timezone),
    enabled: !!dateKey && !!timezone,
  });

  // Tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", log?.id],
    queryFn: () => getTasksForLog(log!.id),
    enabled: !!log?.id,
  });

  // Manual metrics
  const { data: metrics = [] } = useQuery({
    queryKey: ["manualMetrics", log?.id],
    queryFn: () => getManualMetricsForLog(log!.id),
    enabled: !!log?.id,
  });

  // Derived state
  const completion = taskCompletionPercent(tasks);
  const targetPct = targetProgressPercent(tasks);
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const activeTasks = tasks.filter((t) => t.status !== "skipped").length;

  const getMetricValue = (key: string) => metrics.find((m) => m.metricKey === key)?.value ?? 0;

  // Mutations
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tasks", log?.id] });
    qc.invalidateQueries({ queryKey: ["manualMetrics", log?.id] });
    qc.invalidateQueries({ queryKey: ["dailyLog", dateKey] });
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

  useEffect(() => {
    if (showAddTask) setTimeout(() => addInputRef.current?.focus(), 50);
  }, [showAddTask]);

  if (!dateKey) return null;

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="page fade-in">
      {/* Editorial Page Header */}
      <PageHeader
        title="Today"
        description={
          <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <CalendarIcon className="size-3.5 text-zinc-400" />
            {todayFormatted}
          </span>
        }
        action={
          <button
            id="add-task-btn"
            className="btn btn-primary btn-sm flex items-center gap-1.5 font-semibold"
            onClick={() => setShowAddTask((v) => !v)}
          >
            <PlusIcon className="size-3.5 stroke-[2.5]" />
            <span>Add task</span>
          </button>
        }
      />

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
                  placeholder="What needs to be done today?"
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
                  Plan one thing worth finishing today.
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-sm leading-relaxed">
                  A clear, quiet day begins with a single focused task.
                </p>
                <button
                  className="btn btn-secondary btn-sm mt-3 text-xs"
                  onClick={() => setShowAddTask(true)}
                >
                  + Create first task
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
              description="Daily habits & quantitative logs"
            />
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
            </div>
          </section>

          {/* Daily Note / Reflection */}
          <section className="flex flex-col gap-2">
            <SectionHeading
              title="Daily Reflection"
              description="Capture context, energy, or thoughts"
            />
            <div className="rounded-xl border border-border/80 bg-surface/50 p-2.5">
              <textarea
                id="daily-note"
                className="w-full bg-transparent resize-y text-xs text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[76px] leading-relaxed p-1"
                placeholder="How's today going? Any key reflections…"
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
