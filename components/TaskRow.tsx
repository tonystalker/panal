"use client";

import type { TaskInstance, WeeklyTask } from "@/lib/db";
import { CheckIcon, MinusIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskRowProps {
  task: TaskInstance | WeeklyTask;
  editing: boolean;
  onToggle: () => void;
  onSkip: () => void;
  onDelete: () => void;
  onEditValue: (v: number) => void;
  onSetEditing: (id: string | null) => void;
}

export function TaskRow({
  task,
  editing,
  onToggle,
  onSkip,
  onDelete,
  onEditValue,
  onSetEditing,
}: TaskRowProps) {
  const isDone = task.status === "done";
  const isSkipped = task.status === "skipped";
  const hasTarget = task.targetValue != null && task.targetValue > 0;
  const targetPct = hasTarget
    ? Math.round(((task.completedValue ?? 0) / (task.targetValue ?? 1)) * 100)
    : null;

  return (
    <div
      className={cn(
        "group/task flex items-start gap-3 py-3 px-3.5 border-b border-border/60 last:border-b-0 transition-colors hover:bg-surface-muted/30 rounded-lg",
        isSkipped && "opacity-40"
      )}
    >
      {/* Checkbox button */}
      <button
        type="button"
        id={`task-toggle-${task.id}`}
        role="checkbox"
        aria-checked={isDone}
        className={cn(
          "checkbox shrink-0 mt-0.5",
          isDone && "checked",
          isSkipped && "skipped"
        )}
        onClick={onToggle}
        aria-label={isDone ? "Mark incomplete" : "Mark complete"}
      >
        {isDone && <CheckIcon className="size-3 text-background stroke-[2.5]" />}
      </button>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className={cn(
              "text-sm font-medium leading-snug transition-colors",
              isDone
                ? "text-muted-foreground line-through decoration-muted-foreground/40"
                : isSkipped
                ? "text-subtle-foreground"
                : "text-foreground"
            )}
          >
            {task.title}
          </span>
          {hasTarget && (
            <span className="text-xs text-subtle-foreground font-mono tabular-nums">
              {task.completedValue} / {task.targetValue} {task.unit}
            </span>
          )}
        </div>

        {/* Quantitative progress */}
        {hasTarget && !isDone && (
          <div className="mt-2 flex items-center gap-2.5 max-w-sm">
            <div className="progress-track flex-1 h-1.5 bg-surface-muted">
              <div
                className="progress-bar bg-accent"
                style={{ width: `${Math.min(targetPct ?? 0, 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground min-w-[32px] text-right">
              {targetPct}%
            </span>
            {editing ? (
              <input
                id={`task-value-${task.id}`}
                type="text"
                inputMode="numeric"
                style={{ width: "3.75rem" }}
                className="h-6 w-16 shrink-0 rounded border border-border/80 bg-surface-muted/60 px-1.5 py-0 text-right font-mono text-xs tabular-nums text-foreground outline-none transition-colors hover:border-border-strong focus:border-border-strong focus:bg-surface-muted focus:ring-1 focus:ring-border-strong"
                defaultValue={task.completedValue}
                onBlur={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) onEditValue(val);
                  onSetEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = parseFloat((e.target as HTMLInputElement).value);
                    if (!isNaN(val)) onEditValue(val);
                    onSetEditing(null);
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm h-6 px-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground"
                onClick={() => onSetEditing(task.id)}
              >
                Log
              </button>
            )}
          </div>
        )}
      </div>

      {/* Row Actions */}
      <div className="flex items-center gap-1 opacity-80 md:opacity-0 md:group-hover/task:opacity-100 transition-opacity shrink-0">
        {!isSkipped && (
          <button
            type="button"
            id={`task-skip-${task.id}`}
            className="btn-icon size-7 text-muted-foreground hover:text-foreground"
            onClick={onSkip}
            title="Skip task"
            aria-label="Skip task"
          >
            <MinusIcon className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          id={`task-delete-${task.id}`}
          className="btn-icon size-7 text-muted-foreground hover:text-destructive hover:border-destructive/30"
          onClick={onDelete}
          title="Delete task"
          aria-label="Delete task"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
