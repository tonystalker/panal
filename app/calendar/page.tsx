"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getDailyLogsInRange, getTasksForLog, taskCompletionPercent } from "@/lib/repositories";
import { todayKey, dateRange } from "@/lib/date";
import { format, parseISO, startOfMonth, endOfMonth, getDay, subDays, addDays } from "date-fns";

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

  // Build calendar grid
  const startDow = getDay(monthStart); // 0=Sun
  const prefixDays = startDow; // days before month start
  const allKeys = dateRange(from, to);

  // Color by completion
  function cellColor(pct: number | undefined) {
    if (pct == null) return "var(--bg-3)";
    if (pct >= 80) return "#7c3aed";
    if (pct >= 50) return "#6d28d9";
    if (pct > 0) return "#4c1d95";
    return "var(--bg-3)";
  }

  return (
    <div className="page fade-in">
      <header style={{ marginBottom: "1rem" }}>
        <h1>Calendar</h1>
        {streak > 0 && (
          <p style={{ color: "var(--accent)", fontWeight: 600, fontSize: "0.9375rem", marginTop: "0.25rem" }}>
            🔥 {streak}-day streak
          </p>
        )}
      </header>

      {/* Month navigator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setViewDate((d) => subDays(startOfMonth(d), 1))}>
          ← Prev
        </button>
        <h2 style={{ fontWeight: 600 }}>{format(viewDate, "MMMM yyyy")}</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setViewDate((d) => addDays(endOfMonth(d), 1))}>
          Next →
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "4px" }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "0.6875rem", color: "var(--text-3)", padding: "0.25rem 0" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
        {/* Prefix blanks */}
        {Array.from({ length: prefixDays }, (_, i) => (
          <div key={`pre-${i}`} />
        ))}

        {/* Days */}
        {allKeys.map((dateKey) => {
          const pct = completionMap[dateKey];
          const isToday = dateKey === today;
          const hasLog = logDates.has(dateKey);
          const dayNum = format(parseISO(dateKey), "d");

          return (
            <button
              key={dateKey}
              id={`cal-day-${dateKey}`}
              onClick={() => router.push(`/today?date=${dateKey}`)}
              title={`${format(parseISO(dateKey), "EEE, MMM d")}${pct != null ? ` · ${pct}%` : ""}`}
              style={{
                aspectRatio: "1",
                borderRadius: "8px",
                background: hasLog ? cellColor(pct) : "var(--bg-3)",
                border: isToday ? "2px solid var(--accent)" : "none",
                color: hasLog ? "#fff" : "var(--text-3)",
                fontSize: "0.8125rem",
                fontWeight: isToday ? 700 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "opacity 0.15s",
                opacity: hasLog ? 1 : 0.5,
              }}
            >
              {dayNum}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--text-3)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span style={{ display: "inline-block", width: "12px", height: "12px", background: "#7c3aed", borderRadius: "3px" }} />
          ≥80% complete
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span style={{ display: "inline-block", width: "12px", height: "12px", background: "#6d28d9", borderRadius: "3px" }} />
          50–79%
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span style={{ display: "inline-block", width: "12px", height: "12px", background: "#4c1d95", borderRadius: "3px" }} />
          1–49%
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span style={{ display: "inline-block", width: "12px", height: "12px", background: "var(--bg-3)", borderRadius: "3px" }} />
          No log
        </span>
      </div>

      {/* Monthly summary */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>Month summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
          <Stat label="Days logged" value={logs.length} />
          <Stat label="Current streak" value={`${streak}d`} />
          <Stat label="Avg completion" value={
            logs.length > 0
              ? `${Math.round(Object.values(completionMap).reduce((a, b) => a + b, 0) / Math.max(Object.values(completionMap).length, 1))}%`
              : "—"
          } />
        </div>
      </div>

      {/* Recent log list */}
      {logs.length > 0 && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>Recent days</h2>
          {[...logs].reverse().slice(0, 7).map((log) => (
            <button
              key={log.id}
              id={`cal-log-${log.date}`}
              className="card"
              onClick={() => router.push(`/today?date=${log.date}`)}
              style={{ width: "100%", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}
            >
              <div>
                <span style={{ fontWeight: 500, fontSize: "0.9375rem" }}>
                  {format(parseISO(log.date), "EEE, MMM d")}
                </span>
                {log.note && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", marginTop: "0.125rem" }}>
                    {log.note.slice(0, 60)}{log.note.length > 60 ? "…" : ""}
                  </p>
                )}
              </div>
              {completionMap[log.date] != null && (
                <span className="badge badge-accent">{completionMap[log.date]}%</span>
              )}
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontWeight: 700, fontSize: "1.5rem", color: "var(--accent)" }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.125rem" }}>{label}</div>
    </div>
  );
}
