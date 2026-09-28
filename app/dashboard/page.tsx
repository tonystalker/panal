"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { getDailyLogsInRange, getManualMetricsInRange, getTasksForLog, taskCompletionPercent } from "@/lib/repositories";
import { todayKey, dateRange } from "@/lib/date";
import { format, parseISO, subDays } from "date-fns";

type Range = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };

function useDateRange(range: Range, timezone: string) {
  const today = todayKey(timezone);
  const from = format(subDays(parseISO(today), RANGE_DAYS[range] - 1), "yyyy-MM-dd");
  return { from, to: today, keys: dateRange(from, today) };
}

export default function DashboardPage() {
  const [range, setRange] = useState<Range>("7d");
  const [timezone, setTimezone] = useState("UTC");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const { from, to, keys } = useDateRange(range, timezone);

  // Task completion data
  const { data: logs = [] } = useQuery({
    queryKey: ["logs-range", from, to],
    queryFn: () => getDailyLogsInRange(from, to),
    enabled: !!timezone,
  });

  const { data: taskCompletionData = [] } = useQuery({
    queryKey: ["task-completion", from, to, logs.map((l) => l.id)],
    queryFn: async () => {
      const results: { date: string; value: number | null }[] = [];
      const logMap = Object.fromEntries(logs.map((l) => [l.date, l]));
      for (const key of keys) {
        const log = logMap[key];
        if (!log) {
          results.push({ date: key, value: null });
          continue;
        }
        const tasks = await getTasksForLog(log.id);
        results.push({ date: key, value: tasks.length > 0 ? taskCompletionPercent(tasks) : null });
      }
      return results;
    },
    enabled: logs.length > 0,
  });

  // Manual metric data
  const { data: exerciseData = [] } = useQuery({
    queryKey: ["exercise", from, to],
    queryFn: () => getManualMetricsInRange("exercise_minutes", from, to),
    enabled: !!timezone,
  });

  const { data: dsaData = [] } = useQuery({
    queryKey: ["dsa", from, to],
    queryFn: () => getManualMetricsInRange("dsa_problems", from, to),
    enabled: !!timezone,
  });

  const { data: mobileData = [] } = useQuery({
    queryKey: ["mobile", from, to],
    queryFn: () => getManualMetricsInRange("mobile_usage_minutes", from, to),
    enabled: !!timezone,
  });

  // Build full date-indexed datasets (zero-fill missing days)
  function buildSeries(
    data: { date: string; value: number }[],
    allKeys: string[],
  ): { date: string; value: number }[] {
    const map = Object.fromEntries(data.map((d) => [d.date, d.value]));
    return allKeys.map((k) => ({ date: k, value: map[k] ?? 0 }));
  }

  const exerciseSeries = buildSeries(exerciseData, keys);
  const dsaSeries = buildSeries(dsaData, keys);
  const mobileSeries = buildSeries(mobileData, keys);

  function shortDate(dateKey: string) {
    return format(parseISO(dateKey), range === "90d" ? "MMM d" : "EEE");
  }

  // Selected day detail
  const { data: selectedDetail } = useQuery({
    queryKey: ["detail", selectedDate],
    queryFn: async () => {
      if (!selectedDate) return null;
      const log = logs.find((l) => l.date === selectedDate);
      if (!log) return { date: selectedDate, tasks: [], note: "" };
      const tasks = await getTasksForLog(log.id);
      return { date: selectedDate, tasks, note: log.note };
    },
    enabled: !!selectedDate,
  });

  // Streak calculation
  const today = todayKey(timezone);
  const logDates = new Set(logs.map((l) => l.date));
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = format(subDays(parseISO(today), i), "yyyy-MM-dd");
    if (logDates.has(d)) streak++;
    else break;
  }

  return (
    <div className="page fade-in">
      <header style={{ marginBottom: "1.5rem" }}>
        <h1>Dashboard</h1>
        {streak > 0 && (
          <p style={{ color: "var(--text-3)", fontSize: "0.8125rem", marginTop: "0.25rem" }}>
            🔥 {streak}-day streak
          </p>
        )}
      </header>

      {/* Range selector */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {(["7d", "30d", "90d"] as Range[]).map((r) => (
          <button
            key={r}
            id={`range-${r}`}
            className={`btn btn-sm ${range === r ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setRange(r)}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Task completion chart */}
      <ChartCard title="Task Completion %" unit="%">
        {taskCompletionData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart
              data={taskCompletionData}
              onClick={(e) => {
                const ev = e as { activePayload?: Array<{ payload?: { date?: string } }> } | null;
                if (ev?.activePayload) setSelectedDate(ev.activePayload[0]?.payload?.date ?? null);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}%`, "Completion"]} labelFormatter={(l) => l ? format(parseISO(String(l)), "EEE, MMM d") : ""} />
              <ReferenceLine y={100} stroke="var(--success)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent)" }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Streak heatmap */}
      <ChartCard title="Activity Streak" unit="">
        <StreakHeatmap keys={keys} logDates={logDates} onSelect={setSelectedDate} selected={selectedDate} />
      </ChartCard>

      {/* Exercise chart */}
      <ChartCard title="Exercise" unit="min">
        <MetricBarChart data={exerciseSeries} shortDate={shortDate} goalLine={30} color="#22c55e" />
      </ChartCard>

      {/* DSA chart */}
      <ChartCard title="DSA Problems" unit="solved">
        <MetricBarChart data={dsaSeries} shortDate={shortDate} goalLine={3} color="#f59e0b" />
      </ChartCard>

      {/* Mobile usage chart */}
      <ChartCard title="Mobile Usage" unit="min">
        <MetricBarChart data={mobileSeries} shortDate={shortDate} goalLine={180} color="#ef4444" />
      </ChartCard>

      {/* Daily detail panel */}
      {selectedDate && selectedDetail && (
        <div className="card fade-in" style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <h3>{format(parseISO(selectedDate), "EEE, MMM d")}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDate(null)}>Close</button>
          </div>
          {selectedDetail.tasks.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: "0.875rem" }}>No tasks logged.</p>
          ) : (
            selectedDetail.tasks.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", borderBottom: "1px solid var(--border)", fontSize: "0.875rem" }}>
                <span style={{ color: t.status === "done" ? "var(--success)" : t.status === "skipped" ? "var(--text-3)" : "var(--text)" }}>
                  {t.title}
                </span>
                <span className={`badge badge-${t.status === "done" ? "success" : t.status === "skipped" ? "muted" : "warning"}`}>
                  {t.status}
                </span>
              </div>
            ))
          )}
          {selectedDetail.note && (
            <p style={{ marginTop: "0.75rem", color: "var(--text-2)", fontSize: "0.875rem", fontStyle: "italic" }}>
              &ldquo;{selectedDetail.note}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ChartCard({ title, unit, children }: { title: string; unit: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h3 style={{ marginBottom: "0.75rem", color: "var(--text-2)" }}>
        {title}{unit && <span style={{ fontWeight: 400, color: "var(--text-3)", marginLeft: "0.25rem" }}>({unit})</span>}
      </h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="empty-state" style={{ padding: "1.5rem 0" }}>
      <p style={{ fontSize: "0.875rem" }}>No data yet — log your first day on Today.</p>
    </div>
  );
}

function MetricBarChart({
  data, shortDate, goalLine, color,
}: { data: { date: string; value: number }[]; shortDate: (d: string) => string; goalLine: number; color: string }) {
  const hasData = data.some((d) => d.value > 0);
  if (!hasData) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip labelFormatter={(l) => l ? format(parseISO(String(l)), "EEE, MMM d") : ""} />
        <ReferenceLine y={goalLine} stroke={color} strokeDasharray="4 4" opacity={0.6} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.value >= goalLine ? color : "var(--accent)"} opacity={entry.value === 0 ? 0.15 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function StreakHeatmap({
  keys, logDates, onSelect, selected,
}: { keys: string[]; logDates: Set<string>; onSelect: (d: string) => void; selected: string | null }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
      {keys.map((k) => {
        const active = logDates.has(k);
        const isSelected = k === selected;
        return (
          <button
            key={k}
            id={`heatmap-${k}`}
            title={format(parseISO(k), "EEE, MMM d")}
            onClick={() => onSelect(k)}
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "4px",
              border: isSelected ? "2px solid var(--accent)" : "none",
              background: active ? "var(--accent)" : "var(--bg-3)",
              opacity: active ? 0.9 : 0.3,
              cursor: "pointer",
              transition: "opacity 0.15s",
              padding: 0,
            }}
          />
        );
      })}
    </div>
  );
}
