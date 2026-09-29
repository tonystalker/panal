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
import { EmptyState } from "@/components/ui/EmptyState";
import { PlusIcon, CheckCircle2Icon, SparklesIcon, CalendarIcon } from "lucide-react";

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
          <span className="flex items-center gap-1.5 font-medium text-subtle-foreground">
            <CalendarIcon className="size-3.5 text-accent" />
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Primary Tasks Workflow ~ 65%) */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Day Progress Strip */}
          <div className="card p-4 sm:p-5 flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                  Task Completion
                </span>
                <span className="text-xs text-subtle-foreground font-mono">
                  ({doneTasks}/{activeTasks} done)
                </span>
              </div>
              <span className="text-2xl font-bold font-mono text-accent tabular-nums">
                {completion}%
              </span>
            </div>

            {/* Thin precise progress track */}
            <div className="progress-track h-2 bg-surface-muted">
              <div className="progress-bar bg-accent" style={{ width: `${completion}%` }} />
            </div>

            <div className="flex items-center justify-between text-xs text-subtle-foreground font-mono tabular-nums">
              <span>{doneTasks} of {activeTasks} tasks done</span>
              {tasks.some((t) => t.targetValue != null) && (
                <span className="text-muted-foreground">
                  Target progress: <strong className="text-foreground">{targetPct}%</strong>
                </span>
              )}
            </div>
          </div>

          {/* Tasks Section */}
          <section className="flex flex-col gap-3">
            <SectionHeading
              title="Tasks"
              description="Keep today focused on high-priority outcomes."
            />

            {/* Add Task Form */}
            {showAddTask && (
              <div className="card card-raised p-4 fade-in border-accent/30 flex flex-col gap-3">
                <input
                  ref={addInputRef}
                  id="new-task-title"
                  className="input"
                  placeholder="What needs to be done today?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask.mutate()}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                <div className="flex items-center gap-2 pt-1">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => addTask.mutate()}
                    disabled={!newTitle.trim()}
                  >
                    Add Task
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowAddTask(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Tasks Container */}
            <div className="card p-1.5 sm:p-2">
              {tasks.length === 0 ? (
                <EmptyState
                  title="Plan one thing worth finishing today."
                  description="A clear, quiet day begins with a single focused task."
                  action={
                    <button
                      className="btn btn-ghost btn-sm text-xs"
                      onClick={() => setShowAddTask(true)}
                    >
                      + Create first task
                    </button>
                  }
                />
              ) : (
                <div className="flex flex-col">
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
          </section>
        </div>

        {/* Right Column (Narrow check-ins and reflection ~ 35%) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Manual Metrics Panel */}
          <section className="flex flex-col gap-3">
            <SectionHeading
              title="Manual Check-ins"
              description="Daily habits & quantitative logs"
            />
            <div className="card p-3.5 flex flex-col divide-y divide-border/60">
              {MANUAL_METRICS.map((m) => (
                <div
                  key={m.key}
                  className="flex items-center justify-between py-2.5 first:pt-1 last:pb-1"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{m.label}</span>
                    <span className="text-[11px] text-subtle-foreground font-mono">{m.unit}</span>
                  </div>
                  <input
                    id={`metric-${m.key}`}
                    className="input input-sm h-8 w-24 text-right font-mono tabular-nums"
                    type="number"
                    min={0}
                    defaultValue={getMetricValue(m.key) || ""}
                    placeholder={m.placeholder}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        updateMetric.mutate({ key: m.key, value: val, unit: m.unit });
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Daily Note / Reflection */}
          <section className="flex flex-col gap-3">
            <SectionHeading
              title="Daily Reflection"
              description="Capture context, energy, or thoughts"
            />
            <div className="card p-3.5">
              <textarea
                id="daily-note"
                className="input resize-y text-sm font-sans min-h-[96px] leading-relaxed p-2.5"
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
