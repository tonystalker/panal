import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: "connected" | "syncing" | "error" | "not_connected" | "done" | "skipped" | "pending" | string;
  label?: string;
  dot?: boolean;
}

export function StatusBadge({ status, label, dot = true, className, ...props }: StatusBadgeProps) {
  let displayLabel = label;
  let variantClass = "bg-surface-muted text-muted-foreground border-border";
  let dotClass = "bg-muted-foreground";

  switch (status) {
    case "connected":
    case "done":
      displayLabel = label ?? (status === "done" ? "Done" : "Connected");
      variantClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      dotClass = "bg-emerald-400";
      break;
    case "syncing":
    case "pending":
      displayLabel = label ?? (status === "syncing" ? "Syncing…" : "Pending");
      variantClass = "bg-amber-500/10 text-amber-300 border-amber-500/20";
      dotClass = "bg-amber-300 animate-pulse";
      break;
    case "error":
      displayLabel = label ?? "Error";
      variantClass = "bg-rose-500/10 text-rose-400 border-rose-500/20";
      dotClass = "bg-rose-400";
      break;
    case "skipped":
      displayLabel = label ?? "Skipped";
      variantClass = "bg-surface-muted text-subtle-foreground border-border";
      dotClass = "bg-subtle-foreground";
      break;
    case "not_connected":
    default:
      displayLabel = label ?? (status === "not_connected" ? "Not connected" : status);
      variantClass = "bg-surface-muted text-muted-foreground border-border";
      dotClass = "bg-muted-foreground/60";
      break;
  }

  return (
    <span
      data-slot="status-badge"
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border tabular-nums transition-colors",
        variantClass,
        className
      )}
      {...props}
    >
      {dot && <span className={cn("size-1.5 rounded-full shrink-0", dotClass)} />}
      <span>{displayLabel}</span>
    </span>
  );
}
