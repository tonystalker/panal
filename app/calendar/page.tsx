"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getDailyLogsInRange, getTasksForLog, taskCompletionPercent } from "@/lib/repositories";
import { todayKey, dateRange } from "@/lib/date";
import { format, parseISO, startOfMonth, endOfMonth, getDay, subDays, addDays } from "date-fns";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricValue } from "@/components/ui/MetricValue";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ChevronLeftIcon, ChevronRightIcon, FlameIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const router = useRouter();
  const [timezone, setTimezone] = useState("UTC");
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const from = format(monthStart, "yyyy-MM-dd");
  const to = format(monthEnd, "yyyy-MM-dd");

  const { data: logs = [] } = useQuery({
    queryKey: ["logs-calendar", from, to],
    queryFn: () => getDailyLogsInRange(from, to),
    enabled: !!timezone,
  });

  const { data: completionMap = {} } = useQuery({
    queryKey: ["calendar-completion", from, to, logs.map((l) => l.id)],
    queryFn: async () => {
      const result: Record<string, number> = {};
      for (const log of logs) {
        const tasks = await getTasksForLog(log.id);
        if (tasks.length > 0) result[log.date] = taskCompletionPercent(tasks);
      }
      return result;
    },
    enabled: logs.length > 0,
  });

  // Streak calculation (from today backwards)
  const today = todayKey(timezone);
  const logDates = new Set(logs.map((l) => l.date));
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = format(subDays(parseISO(today), i), "yyyy-MM-dd");
    if (logDates.has(d)) streak++;
    else break;
  }

  // Calendar grid math
  const startDow = getDay(monthStart);
  const prefixDays = startDow;
  const allKeys = dateRange(from, to);

  // Restrained editorial cell styling
  function getCellStyles(pct: number | undefined, isToday: boolean, hasLog: boolean) {
    if (!hasLog) {
      return {
        bg: "bg-surface-muted/30 hover:bg-surface-muted/60",
        border: isToday ? "border-accent ring-1 ring-accent" : "border-border/50",
        text: "text-subtle-foreground",
      };
    }
    if (pct == null || pct === 0) {
      return {
        bg: "bg-surface-muted border-border",
        border: isToday ? "border-accent ring-1 ring-accent" : "border-border",
        text: "text-muted-foreground",
      };
    }
    if (pct >= 80) {
      return {
        bg: "bg-accent/15 border-accent/35 hover:bg-accent/25",
        border: isToday ? "border-accent ring-1 ring-accent" : "border-accent/30",
        text: "text-accent font-semibold",
      };
    }
    if (pct >= 50) {
      return {
        bg: "bg-white/12 border-white/20 hover:bg-white/18",
        border: isToday ? "border-accent ring-1 ring-accent" : "border-border-strong",
        text: "text-foreground font-medium",
      };
    }
    return {
      bg: "bg-white/6 border-white/10 hover:bg-white/10",
      border: isToday ? "border-accent ring-1 ring-accent" : "border-border",
      text: "text-muted-foreground",
    };
  }

  const avgCompletion =
    logs.length > 0
      ? `${Math.round(
          Object.values(completionMap).reduce((a, b) => a + b, 0) /
            Math.max(Object.values(completionMap).length, 1)
        )}%`
      : "—";

  return (
    <div className="page fade-in">
      {/* Editorial Page Header */}
      <PageHeader
        title="Calendar"
        description="Monthly completion patterns and activity history."
        badge={
          streak > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
              <FlameIcon className="size-3.5 fill-accent" />
              <span>🔥 {streak}-day streak</span>
            </span>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Calendar Grid (~60%) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="card p-4 sm:p-5 flex flex-col gap-4">
            {/* Month Navigator */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs flex items-center gap-1"
                onClick={() => setViewDate((d) => subDays(startOfMonth(d), 1))}
              >
                <ChevronLeftIcon className="size-3.5" />
                <span>Prev</span>
              </button>
              <h2 className="text-sm font-semibold tracking-tight text-foreground font-mono">
                {format(viewDate, "MMMM yyyy")}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs flex items-center gap-1"
                onClick={() => setViewDate((d) => addDays(endOfMonth(d), 1))}
              >
                <span>Next</span>
                <ChevronRightIcon className="size-3.5" />
              </button>
            </div>

            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono uppercase text-subtle-foreground font-medium py-1 border-b border-border/40">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Monthly activity calendar">
              {/* Blank Prefix Cells */}
              {Array.from({ length: prefixDays }, (_, i) => (
                <div key={`pre-${i}`} className="aspect-square" />
              ))}

              {/* Day Cells */}
              {allKeys.map((dateKey) => {
                const pct = completionMap[dateKey];
                const isToday = dateKey === today;
                const hasLog = logDates.has(dateKey);
                const dayNum = format(parseISO(dateKey), "d");
                const style = getCellStyles(pct, isToday, hasLog);

                return (
                  <button
                    key={dateKey}
                    id={`cal-day-${dateKey}`}
                    type="button"
                    onClick={() => router.push(`/today?date=${dateKey}`)}
                    title={`${format(parseISO(dateKey), "EEE, MMM d")}${pct != null ? ` · ${pct}% done` : ""}`}
                    className={cn(
                      "aspect-square rounded-lg border flex flex-col items-center justify-center p-1 text-xs font-mono tabular-nums transition-all outline-none",
                      style.bg,
                      style.border,
                      style.text
                    )}
                  >
                    <span>{dayNum}</span>
                    {pct != null && pct > 0 && (
                      <span className="text-[9px] opacity-75 mt-0.5 leading-none">
                        {pct}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Restrained Legend */}
            <div className="flex items-center gap-3 pt-2 border-t border-border/40 text-[11px] font-mono text-subtle-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-accent/25 border border-accent/40" />
                ≥80%
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-white/15 border border-white/25" />
                50–79%
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-white/6 border border-white/15" />
                1–49%
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-surface-muted/30 border border-border/50" />
                No log
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Month Summary & Scannable History (~40%) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Month Summary Metrics */}
          <div className="card p-4 sm:p-5 flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Month Summary
            </h3>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <MetricValue label="Days logged" value={logs.length} size="sm" />
              <MetricValue label="Current streak" value={`${streak}d`} size="sm" />
              <MetricValue label="Avg completion" value={avgCompletion} size="sm" />
            </div>
          </div>

          {/* History List */}
          {logs.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeading
                title="Recent Logged Days"
                description="Scannable history of daily check-ins"
              />
              <div className="card p-1 divide-y divide-border/60">
                {[...logs].reverse().slice(0, 7).map((log) => {
                  const pct = completionMap[log.date];
                  return (
                    <button
                      key={log.id}
                      id={`cal-log-${log.date}`}
                      type="button"
                      onClick={() => router.push(`/today?date=${log.date}`)}
                      className="w-full text-left p-3 hover:bg-surface-muted/40 transition-colors flex items-center justify-between gap-3 outline-none first:rounded-t-lg last:rounded-b-lg"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground">
                          {format(parseISO(log.date), "EEEE, MMM d")}
                        </span>
                        {log.note && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-xs">
                            {log.note}
                          </p>
                        )}
                      </div>
                      {pct != null && (
                        <span className="badge badge-accent font-mono shrink-0">
                          {pct}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
