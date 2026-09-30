"use client";

/**
 * app/dashboard/page.tsx — Refactored UI
 *
 * Data-driven analytical workspace:
 *  - 2-column desktop widget grid
 *  - Quiet Swiss editorial aesthetics with acid-lime accent
 *  - Reorder, config dialog, accessible data tables
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
  getDailyLogsInRange, getTasksForLog, getOrCreateProfile,
} from "@/lib/repositories";
import { operationalDate } from "@/lib/date";
import { generateId } from "@/lib/uuid";
import { resolveMetricData, applyRollingAverage, type DataPoint } from "@/lib/metrics/resolver";
import {
  METRIC_DEFINITIONS, METRIC_BY_KEY, metricLabel, getAllMetricDefinitions,
  type ChartType, type MetricDefinition,
} from "@/lib/metrics/definitions";
import { type CustomMetric } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChartWidget } from "@/components/ChartWidget";
import { MetricValue } from "@/components/ui/MetricValue";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlusIcon, RotateCcwIcon, FlameIcon, XIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";

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

export default function DashboardPage() {
  const [timezone, setTimezone] = useState("UTC");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getOrCreateProfile(),
  });

  const tz = profile?.timezone ?? timezone;
  const cutoff = profile?.preferences?.workdayCutoff ?? "00:00";
  const today = operationalDate(new Date(), tz, cutoff);

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

  // Widget mutations
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
      {/* Top Editorial Page Header */}
      <PageHeader
        title="Dashboard"
        description="Data-driven workspace with custom metric analytics."
        badge={
          streak > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
              <FlameIcon className="size-3 text-zinc-400" />
              <span>{streak}-day streak</span>
            </span>
          ) : undefined
        }
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="add-widget-btn"
              className="btn btn-primary btn-sm flex items-center gap-1.5 font-semibold"
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
              <PlusIcon className="size-3.5 stroke-[2.5]" />
              <span>Add Widget</span>
            </button>
            <button
              id="reset-widgets-btn"
              className="btn btn-ghost btn-sm flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={addDefaultWidgets}
            >
              <RotateCcwIcon className="size-3" />
              <span>Reset to Defaults</span>
            </button>
          </div>
        }
      />

      {/* Metrics Overview Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mb-6">
        <div className="card p-3 sm:p-4">
          <MetricValue label="Active Streak" value={`${streak} days`} size="sm" />
        </div>
        <div className="card p-3 sm:p-4">
          <MetricValue label="Visible Widgets" value={visibleWidgets.length} size="sm" />
        </div>
        <div className="card p-3 sm:p-4 col-span-2 sm:col-span-1">
          <MetricValue label="Logged Days" value={`${recentLogs.length} / 90`} size="sm" />
        </div>
      </div>

      {/* Widgets Grid */}
      {visibleWidgets.length === 0 ? (
        <EmptyState
          title="No visible widgets"
          description="Your dashboard has no active charts. Add a new widget or reset to default metrics."
          action={
            <button className="btn btn-primary btn-sm" onClick={addDefaultWidgets}>
              Reset to Defaults
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {visibleWidgets.map((widget, idx) => (
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
              customMetrics={profile?.preferences?.customMetrics}
            />
          ))}
        </div>
      )}

      {/* Hidden Widgets Section */}
      {widgets.some((w) => !w.config.visible) && (
        <div className="card mt-6 p-4 border-dashed border-border/80">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Hidden Widgets ({widgets.filter((w) => !w.config.visible).length})
          </h3>
          <div className="divide-y divide-border/40">
            {widgets.filter((w) => !w.config.visible).map((w) => (
              <div key={w.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground font-mono text-xs">
                  {w.config.title || metricLabel(w.metricKeys[0], profile?.preferences?.customMetrics)}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    className="btn btn-ghost btn-sm text-xs h-7"
                    onClick={() => toggleVisibility(w)}
                  >
                    Show widget
                  </button>
                  <button
                    id={`widget-hidden-delete-${w.id}`}
                    type="button"
                    className="btn-icon size-7 text-muted-foreground hover:text-destructive hover:border-destructive/30"
                    onClick={() => removeWidget.mutate(w.id)}
                    title="Remove widget"
                    aria-label="Remove widget"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Day Detail Panel */}
      {selectedDate && selectedDetail && (
        <div className="card card-raised mt-6 p-5 fade-in border-accent/30 max-w-xl">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Day Inspector
              </span>
              <h3 className="text-base font-semibold text-foreground">
                {format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}
              </h3>
            </div>
            <button
              className="btn-icon size-7 text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedDate(null)}
              aria-label="Close day detail"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          {selectedDetail.tasks.length === 0 ? (
            <p className="text-xs text-subtle-foreground font-mono py-2">
              No tasks logged for this day.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border/40">
              {selectedDetail.tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <span className={t.status === "done" ? "text-foreground" : "text-muted-foreground"}>
                    {t.title}
                  </span>
                  <span
                    className={`badge ${
                      t.status === "done"
                        ? "badge-success"
                        : t.status === "skipped"
                        ? "badge-muted"
                        : "badge-warning"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {selectedDetail.note && (
            <div className="mt-3.5 p-3 rounded-lg bg-surface-muted/60 border border-border/50">
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                &ldquo;{selectedDetail.note}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}

      {/* Widget Config Dialog */}
      {editingWidget && (
        <WidgetConfigDialog
          widget={editingWidget}
          isNew={!widgets.some((w) => w.id === editingWidget.id)}
          onSave={(w) => { saveWidget.mutate(w); setEditingWidget(null); }}
          onDelete={() => { removeWidget.mutate(editingWidget.id); setEditingWidget(null); }}
          onCancel={() => setEditingWidget(null)}
          customMetrics={profile?.preferences?.customMetrics}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MetricWidget Component
// ────────────────────────────────────────────────────────────────────────────

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
  customMetrics?: CustomMetric[];
}

function MetricWidget({
  widget, today, isFirst, isLast,
  onEdit, onDelete, onToggleVisible, onMoveUp, onMoveDown,
  onSelectDate, selectedDate, customMetrics,
}: MetricWidgetProps) {
  const metricKey = widget.metricKeys[0];
  const allMetricDefs = getAllMetricDefinitions(customMetrics);
  const def = allMetricDefs.find((d) => d.key === metricKey) ?? METRIC_BY_KEY[metricKey];
  const rangeStr = typeof widget.range === "string" ? widget.range : "30d";
  const from = computeFrom(rangeStr, today);
  const color = widget.config.color ?? def?.defaultColor ?? "var(--accent)";
  const title = widget.config.title || metricLabel(metricKey, customMetrics);

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

  const tableNode = hasData ? (
    <table className="w-full text-left text-xs border-collapse font-mono tabular-nums">
      <caption className="sr-only">{title} data table</caption>
      <thead>
        <tr className="border-b border-border/80 text-subtle-foreground text-[10px] uppercase">
          <th className="py-1 px-2 font-medium">Date</th>
          <th className="py-1 px-2 text-right font-medium">{unit || "Value"}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {data.map((row) => (
          <tr key={row.date} className="hover:bg-surface-muted/30">
            <td className="py-1 px-2 text-muted-foreground">
              {format(parseISO(row.date), "EEE, MMM d")}
            </td>
            <td className="py-1 px-2 text-right text-foreground">
              {row.value === null ? "—" : row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : undefined;

  return (
    <ChartWidget
      id={widget.id}
      title={title}
      unit={unit}
      range={rangeStr}
      chartType={widget.chartType}
      rollingAverage={widget.config.rollingAverage}
      isFirst={isFirst}
      isLast={isLast}
      onEdit={onEdit}
      onDelete={onDelete}
      onToggleVisible={onToggleVisible}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      tableContent={tableNode}
    >
      {isLoading ? (
        <div className="h-40 flex items-center justify-center">
          <span className="text-xs text-subtle-foreground font-mono animate-pulse">Loading data…</span>
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
    </ChartWidget>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Universal Chart (Line / Bar / Area)
// ────────────────────────────────────────────────────────────────────────────

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
  const isPrimary = color === "#a3ff12" || color === "var(--accent)";
  const primaryColor = isPrimary ? "var(--accent)" : color;
  const secondaryColor = "#71717a";

  const tooltipFormatter = (v: unknown) => [`${v}${unit ? " " + unit : ""}`, ""] as [string, string];
  const labelFormatter = (l: unknown) => {
    try { return format(parseISO(String(l)), "EEE, MMM d"); } catch { return String(l); }
  };

  const common = {
    data,
    onClick,
    margin: { top: 8, right: 12, left: 16, bottom: 4 },
  };

  const axisProps = {
    xAxis: (
      <XAxis
        dataKey="date"
        tickFormatter={shortDate}
        tick={{ fontSize: 10, fill: "var(--subtle-foreground)" }}
        axisLine={{ stroke: "var(--border)" }}
        tickLine={false}
      />
    ),
    yAxis: (
      <YAxis
        width={36}
        tick={{ fontSize: 10, fill: "var(--subtle-foreground)" }}
        axisLine={false}
        tickLine={false}
        tickFormatter={(val) => (unit === "%" ? `${val}%` : String(val))}
      />
    ),
    grid: <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.4} />,
    tooltip: (
      <Tooltip
        formatter={tooltipFormatter}
        labelFormatter={labelFormatter}
        contentStyle={{
          backgroundColor: "#111113",
          border: "1px solid rgba(244, 244, 245, 0.16)",
          borderRadius: 8,
          fontSize: 12,
          color: "#fafafa",
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
        }}
      />
    ),
    refLine: goalLine != null ? (
      <ReferenceLine y={goalLine} stroke="var(--subtle-foreground)" strokeDasharray="4 4" strokeWidth={1} />
    ) : null,
  };

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={160}>
        <LineChart {...common}>
          {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}{axisProps.tooltip}{axisProps.refLine}
          <Line
            type="monotone"
            dataKey="value"
            stroke={primaryColor}
            strokeWidth={1.75}
            dot={{ r: 2, fill: primaryColor, strokeWidth: 0 }}
            activeDot={{ r: 3.5, fill: primaryColor }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "area") {
    const gradId = `grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
    return (
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart {...common}>
          {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}{axisProps.tooltip}{axisProps.refLine}
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={primaryColor}
            strokeWidth={1.75}
            fill={`url(#${gradId})`}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Bar (default)
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart {...common}>
        {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}{axisProps.tooltip}{axisProps.refLine}
        <Bar dataKey="value" radius={[2, 2, 0, 0]}>
          {data.map((entry, i) => {
            const hasMetGoal = goalLine != null && (entry.value ?? 0) >= goalLine;
            const barFill = isPrimary
              ? "var(--accent)"
              : hasMetGoal
              ? "#a1a1aa"
              : secondaryColor;

            return (
              <Cell
                key={i}
                fill={barFill}
                opacity={entry.value === 0 || entry.value === null ? 0.15 : 0.85}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Heatmap Chart Component
// ────────────────────────────────────────────────────────────────────────────

function HeatmapChart({
  data, onSelect, selected,
}: { data: DataPoint[]; onSelect: (d: string) => void; selected: string | null }) {
  const max = Math.max(...data.map((d) => d.value ?? 0), 1);

  return (
    <div className="flex flex-wrap gap-1.5 py-1" role="grid" aria-label="Activity heatmap">
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
            className="size-5 rounded sm:size-5.5 transition-all outline-none"
            style={{
              backgroundColor: d.value == null ? "var(--surface-muted)" : "var(--accent)",
              opacity: d.value == null ? 0.2 : Math.max(0.25, intensity),
              boxShadow: isSelected ? "0 0 0 2px var(--background), 0 0 0 3px var(--accent)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Empty Chart State
// ────────────────────────────────────────────────────────────────────────────

function EmptyChartState({ metricKey, def }: { metricKey: string; def: MetricDefinition | undefined }) {
  return (
    <div className="empty-state py-6 text-center">
      {def?.source === "connector" ? (
        <p className="text-xs text-muted-foreground">
          No data available.{" "}
          <Link href="/connectors" className="text-accent underline underline-offset-2">
            Connect {def.connectorId === "github" ? "GitHub" : "LeetCode"} ↗
          </Link>{" "}
          to import activity.
        </p>
      ) : metricKey === "task.completion_percent" ? (
        <p className="text-xs text-muted-foreground">
          No tasks recorded.{" "}
          <Link href="/today" className="text-accent underline underline-offset-2">Log today ↗</Link>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          No data yet.{" "}
          <Link href="/today" className="text-accent underline underline-offset-2">Check in on Today ↗</Link>
        </p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Widget Config Dialog
// ────────────────────────────────────────────────────────────────────────────

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
  isNew?: boolean;
  onSave: (w: DashboardWidget) => void;
  onDelete?: () => void;
  onCancel: () => void;
  customMetrics?: CustomMetric[];
}

function WidgetConfigDialog({
  widget,
  isNew,
  onSave,
  onDelete,
  onCancel,
  customMetrics,
}: WidgetConfigDialogProps) {
  const allDefs = getAllMetricDefinitions(customMetrics);
  const [metricKey, setMetricKey] = useState(widget.metricKeys[0]);
  const [chartType, setChartType] = useState<ChartType>(widget.chartType);
  const [range, setRange] = useState(typeof widget.range === "string" ? widget.range : "30d");
  const [goalLine, setGoalLine] = useState(widget.config.goalLine?.toString() ?? "");
  const [rollingAvg, setRollingAvg] = useState(widget.config.rollingAverage?.toString() ?? "");
  const [title, setTitle] = useState(widget.config.title ?? "");
  const initialDef = allDefs.find((d) => d.key === widget.metricKeys[0]) || METRIC_BY_KEY[widget.metricKeys[0]];
  const [color, setColor] = useState(widget.config.color ?? initialDef?.defaultColor ?? "#a3ff12");

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

  const handleMetricChange = (key: string) => {
    setMetricKey(key);
    const def = allDefs.find((d) => d.key === key) || METRIC_BY_KEY[key];
    if (def) setColor(def.defaultColor);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="widget-config-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="card card-raised w-full max-w-lg p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/60">
          <h2 id="widget-config-title" className="text-base font-semibold text-foreground">
            {isNew ? "Add Widget" : "Configure Widget"}
          </h2>
          <button
            type="button"
            className="btn-icon size-7 text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Metric Source
            </label>
            <select
              id="widget-metric-select"
              value={metricKey}
              onChange={(e) => handleMetricChange(e.target.value)}
              className="input text-sm cursor-pointer"
            >
              {allDefs.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Chart Type
            </label>
            <div className="flex gap-2 flex-wrap">
              {CHART_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  id={`chart-type-${ct.value}`}
                  type="button"
                  className={`btn btn-sm ${chartType === ct.value ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setChartType(ct.value)}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Date Range
            </label>
            <div className="flex gap-2">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`btn btn-sm ${range === r.value ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setRange(r.value as "7d" | "30d" | "90d")}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Goal / Target line (optional)
            </label>
            <input
              id="widget-goal-line"
              type="number"
              placeholder="e.g. 100"
              value={goalLine}
              onChange={(e) => setGoalLine(e.target.value)}
              className="input input-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Rolling Average
            </label>
            <select
              id="widget-rolling-avg"
              value={rollingAvg}
              onChange={(e) => setRollingAvg(e.target.value)}
              className="input text-sm cursor-pointer"
            >
              {ROLLING_AVG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Title Override (optional)
            </label>
            <input
              id="widget-title"
              type="text"
              placeholder={metricLabel(metricKey, customMetrics)}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input input-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Series Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="widget-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-8 p-0.5 rounded border border-border bg-surface-muted cursor-pointer"
              />
              <span className="text-xs font-mono text-muted-foreground">{color}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2.5 mt-6 pt-4 border-t border-border/60">
          <div>
            {!isNew && onDelete && (
              <button
                id="widget-dialog-delete-btn"
                type="button"
                className="btn btn-ghost text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/20 text-xs px-3 h-8"
                onClick={onDelete}
              >
                <Trash2Icon className="size-3.5 mr-1.5" />
                Remove
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost text-xs px-3 h-8"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              id="widget-save-btn"
              className="btn btn-primary text-xs px-4 h-8"
              onClick={handleSave}
            >
              {isNew ? "Add Widget" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
