"use client";

/**
 * app/dashboard/page.tsx — Milestone 3
 *
 * Fully data-driven dashboard. Widgets are loaded from DashboardWidget table
 * and rendered via MetricDefinition registry. No `if (connector === "github")`.
 *
 * Features:
 *  - Configurable chart type (line / bar / area / heatmap) per widget
 *  - Configurable date range, goal line, rolling average, color, title
 *  - Reorder (up/down) and hide/show widgets
 *  - Keyboard-accessible charts + collapsible tabular data alternative
 *  - First-load seeds default widget layout
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { db } from "@/lib/db";
import type { DashboardWidget } from "@/lib/db";
import {
  getDashboardWidgets, upsertDashboardWidget, deleteWidget,
  reorderWidgets, seedDefaultWidgets,
  getDailyLogsInRange, getTasksForLog, taskCompletionPercent,
} from "@/lib/repositories";
import { todayKey, dateRange } from "@/lib/date";
import { generateId } from "@/lib/uuid";
import { resolveMetricData, applyRollingAverage, type DataPoint } from "@/lib/metrics/resolver";
import {
  METRIC_DEFINITIONS, METRIC_BY_KEY, metricLabel,
  type ChartType, type MetricDefinition,
} from "@/lib/metrics/definitions";
import Link from "next/link";

type Range = "7d" | "30d" | "90d";
const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeFrom(range: string, today: string): string {
  if (range === "7d") return format(subDays(parseISO(today), 6), "yyyy-MM-dd");
  if (range === "30d") return format(subDays(parseISO(today), 29), "yyyy-MM-dd");
  if (range === "90d") return format(subDays(parseISO(today), 89), "yyyy-MM-dd");
  if (typeof range === "object") return (range as { from: string }).from;
  return format(subDays(parseISO(today), 6), "yyyy-MM-dd");
}

function shortDate(dateKey: string, rangeStr: string) {
  try {
    return format(parseISO(dateKey), rangeStr === "90d" ? "MMM d" : "EEE");
  } catch {
    return dateKey;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [timezone, setTimezone] = useState("UTC");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const today = todayKey(timezone);

  // Seed default widgets on first load
  useEffect(() => {
    if (!timezone || timezone === "UTC") return;
    seedDefaultWidgets().then(() => qc.invalidateQueries({ queryKey: ["widgets"] }));
  }, [timezone, qc]);

  const { data: widgets = [] } = useQuery({
    queryKey: ["widgets"],
    queryFn: getDashboardWidgets,
    enabled: !!timezone,
  });

  const visibleWidgets = widgets.filter((w) => w.config.visible);

  // Streak calculation
  const { data: recentLogs = [] } = useQuery({
    queryKey: ["logs-recent"],
    queryFn: () => getDailyLogsInRange(format(subDays(parseISO(today), 89), "yyyy-MM-dd"), today),
    enabled: !!timezone,
  });

  const logDates = new Set(recentLogs.map((l) => l.date));
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = format(subDays(parseISO(today), i), "yyyy-MM-dd");
    if (logDates.has(d)) streak++;
    else break;
  }

  // Widget mutation helpers
  const saveWidget = useMutation({
    mutationFn: upsertDashboardWidget,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["widgets"] }),
  });

  const removeWidget = useMutation({
    mutationFn: deleteWidget,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["widgets"] }),
  });

  const reorder = useMutation({
    mutationFn: reorderWidgets,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["widgets"] }),
  });

  const toggleVisibility = (widget: DashboardWidget) => {
    saveWidget.mutate({ ...widget, config: { ...widget.config, visible: !widget.config.visible } });
  };

  const moveWidget = (id: string, direction: "up" | "down") => {
    const ids = widgets.map((w) => w.id);
    const idx = ids.indexOf(id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === ids.length - 1) return;
    const newIds = [...ids];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newIds[idx], newIds[swapIdx]] = [newIds[swapIdx], newIds[idx]];
    reorder.mutate(newIds);
  };

  const addDefaultWidgets = async () => {
    await db.dashboardWidgets.clear();
    await qc.invalidateQueries({ queryKey: ["widgets"] });
    await seedDefaultWidgets();
    await qc.invalidateQueries({ queryKey: ["widgets"] });
  };

  // Selected day detail
  const { data: selectedDetail } = useQuery({
    queryKey: ["detail", selectedDate],
    queryFn: async () => {
      if (!selectedDate) return null;
      const log = recentLogs.find((l) => l.date === selectedDate);
      if (!log) return { date: selectedDate, tasks: [], note: "" };
      const tasks = await getTasksForLog(log.id);
      return { date: selectedDate, tasks, note: log.note };
    },
    enabled: !!selectedDate,
  });

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

      {/* Widget toolbar */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button
          id="add-widget-btn"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            setEditingWidget({
              id: generateId(),
              metricKeys: [METRIC_DEFINITIONS[0].key],
              chartType: "bar",
              range: "30d",
              aggregation: "daily",
              config: { goalLine: null, rollingAverage: null, title: null, color: null, visible: true },
              position: widgets.length,
            })
          }
        >
          + Add Widget
        </button>
        <button id="reset-widgets-btn" className="btn btn-ghost btn-sm" onClick={addDefaultWidgets}>
          Reset to Defaults
        </button>
        {widgets.some((w) => !w.config.visible) && (
          <span style={{ fontSize: "0.75rem", color: "var(--text-3)", alignSelf: "center" }}>
            {widgets.filter((w) => !w.config.visible).length} hidden
          </span>
        )}
      </div>

      {/* Widgets */}
      {visibleWidgets.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ color: "var(--text-3)" }}>No visible widgets. Add one or reset to defaults.</p>
        </div>
      ) : (
        visibleWidgets.map((widget, idx) => (
          <MetricWidget
            key={widget.id}
            widget={widget}
            today={today}
            isFirst={idx === 0}
            isLast={idx === visibleWidgets.length - 1}
            onEdit={() => setEditingWidget(widget)}
            onDelete={() => removeWidget.mutate(widget.id)}
            onToggleVisible={() => toggleVisibility(widget)}
            onMoveUp={() => moveWidget(widget.id, "up")}
            onMoveDown={() => moveWidget(widget.id, "down")}
            onSelectDate={setSelectedDate}
            selectedDate={selectedDate}
          />
        ))
      )}

      {/* Hidden widgets list */}
      {widgets.some((w) => !w.config.visible) && (
        <div className="card" style={{ marginTop: "1rem", padding: "0.75rem 1rem" }}>
          <h3 style={{ marginBottom: "0.5rem", color: "var(--text-2)", fontSize: "0.875rem" }}>
            Hidden widgets
          </h3>
          {widgets.filter((w) => !w.config.visible).map((w) => (
            <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.25rem 0" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--text-3)" }}>
                {w.config.title || metricLabel(w.metricKeys[0])}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleVisibility(w)}>
                Show
              </button>
            </div>
          ))}
        </div>
      )}

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
              <div
                key={t.id}
                style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", borderBottom: "1px solid var(--border)", fontSize: "0.875rem" }}
              >
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

      {/* Widget config dialog */}
      {editingWidget && (
        <WidgetConfigDialog
          widget={editingWidget}
          onSave={(w) => { saveWidget.mutate(w); setEditingWidget(null); }}
          onCancel={() => setEditingWidget(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricWidget
// ---------------------------------------------------------------------------

interface MetricWidgetProps {
  widget: DashboardWidget;
  today: string;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisible: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSelectDate: (d: string) => void;
  selectedDate: string | null;
}

function MetricWidget({
  widget, today, isFirst, isLast,
  onEdit, onDelete, onToggleVisible, onMoveUp, onMoveDown,
  onSelectDate, selectedDate,
}: MetricWidgetProps) {
  const [showTable, setShowTable] = useState(false);
  const metricKey = widget.metricKeys[0];
  const def = METRIC_BY_KEY[metricKey];
  const rangeStr = typeof widget.range === "string" ? widget.range : "30d";
  const from = computeFrom(rangeStr, today);
  const color = widget.config.color ?? def?.defaultColor ?? "var(--accent)";
  const title = widget.config.title || metricLabel(metricKey);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["metric", metricKey, from, today],
    queryFn: () => resolveMetricData(metricKey, from, today),
  });

  const data: DataPoint[] = rawData
    ? widget.config.rollingAverage
      ? applyRollingAverage(rawData, widget.config.rollingAverage)
      : rawData
    : [];

  const hasData = data.some((d) => d.value !== null && d.value > 0);
  const unit = def?.unit ?? "";
  const goalLine = widget.config.goalLine;

  const handleChartClick = useCallback((e: unknown) => {
    const ev = e as { activePayload?: Array<{ payload?: { date?: string } }> } | null;
    if (ev?.activePayload) onSelectDate(ev.activePayload[0]?.payload?.date ?? "");
  }, [onSelectDate]);

  const shortD = (dateKey: string) => shortDate(dateKey, rangeStr);

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      {/* Widget header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <div>
          <h3 style={{ color: "var(--text-2)" }}>
            {title}
            {unit && <span style={{ fontWeight: 400, color: "var(--text-3)", marginLeft: "0.25rem" }}>({unit})</span>}
          </h3>
          <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.125rem" }}>
            {rangeStr} · {widget.chartType}
            {widget.config.rollingAverage && ` · ${widget.config.rollingAverage}d avg`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button aria-label="Move up" className="btn btn-ghost btn-sm" onClick={onMoveUp} disabled={isFirst} style={{ padding: "0.25rem 0.5rem" }}>↑</button>
          <button aria-label="Move down" className="btn btn-ghost btn-sm" onClick={onMoveDown} disabled={isLast} style={{ padding: "0.25rem 0.5rem" }}>↓</button>
          <button aria-label="Configure widget" id={`widget-config-${widget.id}`} className="btn btn-ghost btn-sm" onClick={onEdit} style={{ padding: "0.25rem 0.5rem" }}>⚙</button>
          <button aria-label="Hide widget" className="btn btn-ghost btn-sm" onClick={onToggleVisible} style={{ padding: "0.25rem 0.5rem" }}>−</button>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--text-3)", fontSize: "0.875rem" }}>Loading…</p>
        </div>
      ) : !hasData ? (
        <EmptyChartState metricKey={metricKey} def={def} />
      ) : widget.chartType === "heatmap" ? (
        <HeatmapChart data={data} onSelect={onSelectDate} selected={selectedDate} />
      ) : (
        <UniversalChart
          data={data}
          chartType={widget.chartType}
          color={color}
          goalLine={goalLine}
          unit={unit}
          shortDate={shortD}
          onClick={handleChartClick}
        />
      )}

      {/* Tabular alternative toggle */}
      {hasData && (
        <div style={{ marginTop: "0.5rem" }}>
          <button
            className="btn btn-ghost btn-sm"
            aria-expanded={showTable}
            aria-controls={`table-${widget.id}`}
            onClick={() => setShowTable((s) => !s)}
            style={{ fontSize: "0.75rem", color: "var(--text-3)" }}
          >
            {showTable ? "▲ Hide table" : "▼ Show data table"}
          </button>
          {showTable && (
            <div id={`table-${widget.id}`} style={{ marginTop: "0.5rem", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <caption className="sr-only">{title} data</caption>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.25rem 0.5rem", color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}>Date</th>
                    <th style={{ textAlign: "right", padding: "0.25rem 0.5rem", color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}>{unit || "Value"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.date} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.25rem 0.5rem", color: "var(--text-2)" }}>
                        {format(parseISO(row.date), "EEE, MMM d")}
                      </td>
                      <td style={{ padding: "0.25rem 0.5rem", textAlign: "right", color: row.value === null ? "var(--text-3)" : "var(--text)" }}>
                        {row.value === null ? "—" : row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Universal chart (line / bar / area)
// ---------------------------------------------------------------------------

interface UniversalChartProps {
  data: DataPoint[];
  chartType: ChartType;
  color: string;
  goalLine: number | null;
  unit: string;
  shortDate: (d: string) => string;
  onClick: (e: unknown) => void;
}

function UniversalChart({ data, chartType, color, goalLine, unit, shortDate, onClick }: UniversalChartProps) {
  const tooltipFormatter = (v: unknown) => [`${v}${unit ? " " + unit : ""}`, ""] as [string, string];
  const labelFormatter = (l: unknown) => {
    try { return format(parseISO(String(l)), "EEE, MMM d"); } catch { return String(l); }
  };

  const common = {
    data,
    onClick,
  };

  const axisProps = {
    xAxis: <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} />,
    yAxis: <YAxis tick={{ fontSize: 11 }} unit={unit ? ` ${unit}` : ""} />,
    grid: <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />,
    tooltip: <Tooltip formatter={tooltipFormatter} labelFormatter={labelFormatter} contentStyle={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />,
    refLine: goalLine != null ? <ReferenceLine y={goalLine} stroke={color} strokeDasharray="4 4" opacity={0.6} /> : null,
  };

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={160}>
        <LineChart {...common}>
          {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}{axisProps.tooltip}{axisProps.refLine}
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart {...common}>
          {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}{axisProps.tooltip}{axisProps.refLine}
          <defs>
            <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${color.replace("#", "")})`} connectNulls={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // bar (default)
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart {...common}>
        {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}{axisProps.tooltip}{axisProps.refLine}
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={goalLine != null && (entry.value ?? 0) >= goalLine ? color : "var(--accent)"}
              opacity={entry.value === 0 || entry.value === null ? 0.15 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Heatmap chart
// ---------------------------------------------------------------------------

function HeatmapChart({
  data, onSelect, selected,
}: { data: DataPoint[]; onSelect: (d: string) => void; selected: string | null }) {
  const max = Math.max(...data.map((d) => d.value ?? 0), 1);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }} role="grid" aria-label="Activity heatmap">
      {data.map((d) => {
        const intensity = d.value == null ? 0 : d.value / max;
        const isSelected = d.date === selected;
        return (
          <button
            key={d.date}
            role="gridcell"
            id={`heatmap-cell-${d.date}`}
            aria-label={`${format(parseISO(d.date), "EEE, MMM d")}: ${d.value ?? "no data"}`}
            title={`${format(parseISO(d.date), "EEE, MMM d")}: ${d.value ?? "no data"}`}
            onClick={() => onSelect(d.date)}
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "4px",
              border: isSelected ? "2px solid var(--accent)" : "none",
              background: d.value == null ? "var(--bg-3)" : "var(--accent)",
              opacity: d.value == null ? 0.15 : Math.max(0.2, intensity),
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

// ---------------------------------------------------------------------------
// Empty chart state
// ---------------------------------------------------------------------------

function EmptyChartState({ metricKey, def }: { metricKey: string; def: MetricDefinition | undefined }) {
  return (
    <div className="empty-state" style={{ padding: "1.5rem 0" }}>
      {def?.source === "connector" ? (
        <p style={{ fontSize: "0.875rem" }}>
          No data.{" "}
          <Link href="/connectors" style={{ color: "var(--accent)" }}>
            Connect {def.connectorId === "github" ? "GitHub" : "LeetCode"} ↗
          </Link>{" "}
          to import data.
        </p>
      ) : metricKey === "task.completion_percent" ? (
        <p style={{ fontSize: "0.875rem" }}>
          No task data.{" "}
          <Link href="/today" style={{ color: "var(--accent)" }}>Log your day ↗</Link>
        </p>
      ) : (
        <p style={{ fontSize: "0.875rem" }}>
          No data yet.{" "}
          <Link href="/today" style={{ color: "var(--accent)" }}>Log your first day ↗</Link>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget config dialog
// ---------------------------------------------------------------------------

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "bar", label: "Bar" },
  { value: "area", label: "Area" },
  { value: "heatmap", label: "Calendar Heatmap" },
];

const RANGE_OPTIONS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const ROLLING_AVG_OPTIONS = [
  { value: "", label: "None" },
  { value: "3", label: "3-day" },
  { value: "7", label: "7-day" },
  { value: "14", label: "14-day" },
];

interface WidgetConfigDialogProps {
  widget: DashboardWidget;
  onSave: (w: DashboardWidget) => void;
  onCancel: () => void;
}

function WidgetConfigDialog({ widget, onSave, onCancel }: WidgetConfigDialogProps) {
  const [metricKey, setMetricKey] = useState(widget.metricKeys[0]);
  const [chartType, setChartType] = useState<ChartType>(widget.chartType);
  const [range, setRange] = useState(typeof widget.range === "string" ? widget.range : "30d");
  const [goalLine, setGoalLine] = useState(widget.config.goalLine?.toString() ?? "");
  const [rollingAvg, setRollingAvg] = useState(widget.config.rollingAverage?.toString() ?? "");
  const [title, setTitle] = useState(widget.config.title ?? "");
  const [color, setColor] = useState(widget.config.color ?? METRIC_BY_KEY[widget.metricKeys[0]]?.defaultColor ?? "#7c3aed");

  const handleSave = () => {
    onSave({
      ...widget,
      metricKeys: [metricKey],
      chartType,
      range: range as "7d" | "30d" | "90d",
      config: {
        ...widget.config,
        goalLine: goalLine ? parseFloat(goalLine) : null,
        rollingAverage: rollingAvg ? parseInt(rollingAvg, 10) : null,
        title: title.trim() || null,
        color: color || null,
        visible: true,
      },
    });
  };

  // When metric changes, update color default
  const handleMetricChange = (key: string) => {
    setMetricKey(key);
    const def = METRIC_BY_KEY[key];
    if (def) setColor(def.defaultColor);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="widget-config-title"
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="card fade-in"
        style={{
          width: "100%", maxWidth: 520,
          borderRadius: "var(--radius) var(--radius) 0 0",
          maxHeight: "90vh", overflowY: "auto",
          padding: "1.5rem",
        }}
      >
        <h2 id="widget-config-title" style={{ marginBottom: "1.25rem" }}>Configure Widget</h2>

        <Field label="Metric">
          <select
            id="widget-metric-select"
            value={metricKey}
            onChange={(e) => handleMetricChange(e.target.value)}
            style={selectStyle}
          >
            {METRIC_DEFINITIONS.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Chart type">
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {CHART_TYPES.map((ct) => (
              <button
                key={ct.value}
                id={`chart-type-${ct.value}`}
                className={`btn btn-sm ${chartType === ct.value ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setChartType(ct.value)}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Date range">
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.value}
                className={`btn btn-sm ${range === r.value ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setRange(r.value as "7d" | "30d" | "90d")}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Goal / target line (optional)">
          <input
            id="widget-goal-line"
            type="number"
            placeholder="e.g. 100"
            value={goalLine}
            onChange={(e) => setGoalLine(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Rolling average">
          <select
            id="widget-rolling-avg"
            value={rollingAvg}
            onChange={(e) => setRollingAvg(e.target.value)}
            style={selectStyle}
          >
            {ROLLING_AVG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Title override (optional)">
          <input
            id="widget-title"
            type="text"
            placeholder={metricLabel(metricKey)}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Color">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <input
              id="widget-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 40, height: 32, padding: 2, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-3)", cursor: "pointer" }}
            />
            <span style={{ fontSize: "0.8125rem", color: "var(--text-3)" }}>{color}</span>
          </div>
        </Field>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button id="widget-save-btn" className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
            Save
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label style={{ display: "block", fontSize: "0.8125rem", color: "var(--text-3)", marginBottom: "0.375rem" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-3)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};
