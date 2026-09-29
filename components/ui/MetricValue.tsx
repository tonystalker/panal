import * as React from "react";
import { cn } from "@/lib/utils";

interface MetricValueProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string | number;
  deltaType?: "positive" | "negative" | "neutral";
  size?: "default" | "sm" | "lg";
}

export function MetricValue({
  label,
  value,
  unit,
  delta,
  deltaType = "neutral",
  size = "default",
  className,
  ...props
}: MetricValueProps) {
  const valueSizeClass = {
    sm: "text-lg font-semibold tracking-tight",
    default: "text-2xl font-medium tracking-tight",
    lg: "text-3xl font-medium tracking-tight",
  }[size];

  const deltaColorClass = {
    positive: "text-emerald-400",
    negative: "text-rose-400",
    neutral: "text-muted-foreground",
  }[deltaType];

  return (
    <div data-slot="metric-value" className={cn("flex flex-col gap-1", className)} {...props}>
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground select-none">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className={cn("text-foreground tabular-nums", valueSizeClass)}>
          {value}
        </span>
        {unit && (
          <span className="text-xs text-subtle-foreground font-normal">
            {unit}
          </span>
        )}
        {delta !== undefined && (
          <span className={cn("text-xs tabular-nums ml-1 font-medium", deltaColorClass)}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
