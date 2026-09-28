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

  return (
    <div className="page fade-in">
      {/* Header */}
      <header style={{ marginBottom: "1.5rem" }}>
        <p style={{ color: "var(--text-3)", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1>Today</h1>
      </header>

      {/* Progress strip */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.875rem", color: "var(--text-2)" }}>
            Task completion
          </span>
          <span style={{ fontWeight: 700, fontSize: "1.125rem", color: "var(--accent)" }}>
            {completion}%
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${completion}%` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.625rem", fontSize: "0.8125rem", color: "var(--text-3)" }}>
          <span>{doneTasks} of {activeTasks} tasks done</span>
          {tasks.some((t) => t.targetValue != null) && (
            <span>Target progress: {targetPct}%</span>
          )}
        </div>
      </div>

      {/* Tasks section */}
      <section>
        <div className="section-header">
          <h2>Tasks</h2>
          <button
            id="add-task-btn"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddTask((v) => !v)}
          >
            + Add task
          </button>
        </div>

        {/* Add task form */}
        {showAddTask && (
          <div className="card fade-in" style={{ marginBottom: "0.75rem" }}>
            <input
              ref={addInputRef}
              id="new-task-title"
              className="input"
              placeholder="Task title…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask.mutate()}
            />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <input
                id="new-task-target"
                className="input input-sm"
                type="number"
                placeholder="Target (optional)"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                id="new-task-unit"
                className="input input-sm"
                placeholder="Unit (e.g. problems)"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button className="btn btn-primary btn-sm" onClick={() => addTask.mutate()} disabled={!newTitle.trim()}>
                Add
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddTask(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Task list */}
        <div className="card">
          {tasks.length === 0 ? (
            <div className="empty-state" style={{ padding: "2rem 0" }}>
              <p>No tasks yet. Add one above.</p>
            </div>
          ) : (
            tasks.map((task) => (
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
            ))
          )}
        </div>
      </section>

      {/* Manual metrics */}
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Manual Metrics</h2>
        <div className="card">
          {MANUAL_METRICS.map((m) => (
            <div
              key={m.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.625rem 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <span style={{ fontWeight: 500 }}>{m.label}</span>
                <span style={{ color: "var(--text-3)", fontSize: "0.8125rem", marginLeft: "0.375rem" }}>
                  {m.unit}
                </span>
              </div>
              <input
                id={`metric-${m.key}`}
                className="input input-sm"
                type="number"
                min={0}
                defaultValue={getMetricValue(m.key) || ""}
                placeholder={m.placeholder}
                style={{ width: "90px", textAlign: "right" }}
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

      {/* Note */}
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Daily Note</h2>
        <textarea
          id="daily-note"
          className="input"
          placeholder="How's today going? Any reflections…"
          defaultValue={log?.note ?? ""}
          rows={3}
          style={{ resize: "vertical" }}
          onBlur={(e) => updateNote.mutate(e.target.value)}
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskRow sub-component
// ---------------------------------------------------------------------------

function TaskRow({
  task,
  editing,
  onToggle,
  onSkip,
  onDelete,
  onEditValue,
  onSetEditing,
}: {
  task: TaskInstance;
  editing: boolean;
  onToggle: () => void;
  onSkip: () => void;
  onDelete: () => void;
  onEditValue: (v: number) => void;
  onSetEditing: (id: string | null) => void;
}) {
  const isDone = task.status === "done";
  const isSkipped = task.status === "skipped";
  const hasTarget = task.targetValue != null && task.targetValue > 0;
  const targetPct = hasTarget
    ? Math.round(((task.completedValue ?? 0) / (task.targetValue ?? 1)) * 100)
    : null;

  return (
    <div
      className="checkbox-row"
      style={{ opacity: isSkipped ? 0.4 : 1 }}
    >
      {/* Checkbox */}
      <button
        id={`task-toggle-${task.id}`}
        className={`checkbox ${isDone ? "checked" : isSkipped ? "skipped" : ""}`}
        onClick={onToggle}
        aria-label={isDone ? "Mark incomplete" : "Mark complete"}
        style={{ border: "none", background: "none", cursor: "pointer" }}
      >
        {isDone && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
          <span
            style={{
              fontWeight: 500,
              textDecoration: isDone ? "line-through" : "none",
              color: isDone || isSkipped ? "var(--text-3)" : "var(--text)",
              fontSize: "0.9375rem",
            }}
          >
            {task.title}
          </span>
          {hasTarget && (
            <span style={{ fontSize: "0.8125rem", color: "var(--text-3)" }}>
              {task.completedValue} / {task.targetValue} {task.unit}
            </span>
          )}
        </div>

        {/* Quantitative progress */}
        {hasTarget && !isDone && (
          <div style={{ marginTop: "0.375rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div className="progress-track" style={{ flex: 1, height: "4px" }}>
              <div className="progress-bar" style={{ width: `${Math.min(targetPct ?? 0, 100)}%` }} />
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-3)", minWidth: "30px", textAlign: "right" }}>
              {targetPct}%
            </span>
            {editing && (
              <input
                id={`task-value-${task.id}`}
                className="input input-sm"
                type="number"
                min={0}
                defaultValue={task.completedValue}
                style={{ width: "70px" }}
                onBlur={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) onEditValue(val);
                  onSetEditing(null);
                }}
                autoFocus
              />
            )}
            {!editing && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: "0.125rem 0.375rem", fontSize: "0.75rem" }}
                onClick={() => onSetEditing(task.id)}
              >
                Log
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
        {!isSkipped && (
          <button
            id={`task-skip-${task.id}`}
            className="btn-icon"
            style={{ width: "28px", height: "28px", fontSize: "0.75rem", border: "none", cursor: "pointer" }}
            onClick={onSkip}
            title="Skip"
          >
            —
          </button>
        )}
        <button
          id={`task-delete-${task.id}`}
          className="btn-icon"
          style={{ width: "28px", height: "28px", fontSize: "0.875rem", border: "none", cursor: "pointer", color: "var(--danger)" }}
          onClick={onDelete}
          title="Delete"
        >
          ×
        </button>
      </div>
    </div>
  );
}
