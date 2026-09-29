/**
 * lib/metrics/resolver.ts
 *
 * Resolves metric data for a given key and date range.
 * Called by dashboard widgets — no connector-specific branching in UI code.
 *
 * Returns an array of { date: YYYY-MM-DD, value: number | null } covering
 * every day in the range (null = no data, 0 = explicit zero).
 */

import { db } from "@/lib/db";
import { getDailyLogsInRange, getTasksForLog, taskCompletionPercent, getManualMetricsInRange } from "@/lib/repositories";
import { dateRange } from "@/lib/date";
import { METRIC_BY_KEY, type MetricDefinition } from "./definitions";

export interface DataPoint {
  date: string;
  value: number | null;
}

/**
 * Fetch data for a single metric key over a date range.
 * Returns one DataPoint per day in [from, to].
 */
export async function resolveMetricData(
  metricKey: string,
  from: string,
  to: string,
): Promise<DataPoint[]> {
  const def = METRIC_BY_KEY[metricKey];
  if (!def) {
    // Unknown metric — return empty
    return dateRange(from, to).map((date) => ({ date, value: null }));
  }

  const allDates = dateRange(from, to);

  if (def.source === "computed") {
    return resolveComputedMetric(def, from, to, allDates);
  }

  if (def.source === "manual") {
    return resolveManualMetric(def, from, to, allDates);
  }

  if (def.source === "connector") {
    return resolveConnectorMetric(def, from, to, allDates);
  }

  return allDates.map((date) => ({ date, value: null }));
}

// ---------------------------------------------------------------------------
// Computed (task completion %)
// ---------------------------------------------------------------------------

async function resolveComputedMetric(
  def: MetricDefinition,
  from: string,
  to: string,
  allDates: string[],
): Promise<DataPoint[]> {
  if (def.key === "task.completion_percent") {
    const logs = await getDailyLogsInRange(from, to);
    const logMap = Object.fromEntries(logs.map((l) => [l.date, l]));
    const results: DataPoint[] = [];

    for (const date of allDates) {
      const log = logMap[date];
      if (!log) {
        results.push({ date, value: def.missingDataPolicy === "zero" ? 0 : null });
        continue;
      }
      const tasks = await getTasksForLog(log.id);
      const value = tasks.length > 0 ? taskCompletionPercent(tasks) : null;
      results.push({ date, value });
    }
    return results;
  }

  return allDates.map((date) => ({ date, value: null }));
}

// ---------------------------------------------------------------------------
// Manual metrics
// ---------------------------------------------------------------------------

async function resolveManualMetric(
  def: MetricDefinition,
  from: string,
  to: string,
  allDates: string[],
): Promise<DataPoint[]> {
  const rawKey = def.manualMetricKey;
  if (!rawKey) return allDates.map((d) => ({ date: d, value: null }));

  const data = await getManualMetricsInRange(rawKey, from, to);
  const map = Object.fromEntries(data.map((d) => [d.date, d.value]));

  return allDates.map((date) => {
    const v = map[date];
    if (v === undefined) {
      return { date, value: def.missingDataPolicy === "zero" ? 0 : null };
    }
    return { date, value: v };
  });
}

// ---------------------------------------------------------------------------
// Connector metrics (from MetricEvent table)
// ---------------------------------------------------------------------------

async function resolveConnectorMetric(
  def: MetricDefinition,
  from: string,
  to: string,
  allDates: string[],
): Promise<DataPoint[]> {
  const events = await db.metricEvents
    .where("metricKey")
    .equals(def.key)
    .and((e) => e.date >= from && e.date <= to)
    .toArray();

  // Aggregate (most connector metrics use "sum" — one event per day, so this is a no-op usually)
  const aggregated = new Map<string, number>();
  for (const e of events) {
    const current = aggregated.get(e.date) ?? 0;
    if (def.aggregation === "sum") {
      aggregated.set(e.date, current + e.value);
    } else if (def.aggregation === "max") {
      aggregated.set(e.date, Math.max(current, e.value));
    } else {
      // last / avg — just overwrite for now (connector data is one-per-day)
      aggregated.set(e.date, e.value);
    }
  }

  return allDates.map((date) => {
    const v = aggregated.get(date);
    if (v === undefined) {
      return { date, value: def.missingDataPolicy === "zero" ? 0 : null };
    }
    return { date, value: v };
  });
}

// ---------------------------------------------------------------------------
// Rolling average helper
// ---------------------------------------------------------------------------

/**
 * Apply a rolling average window to a data series.
 * Null values are excluded from the window calculation.
 */
export function applyRollingAverage(data: DataPoint[], windowDays: number): DataPoint[] {
  return data.map((point, i) => {
    if (point.value === null) return point;

    const windowStart = Math.max(0, i - windowDays + 1);
    const window = data.slice(windowStart, i + 1).filter((p) => p.value !== null);
    if (window.length === 0) return point;

    const avg = window.reduce((sum, p) => sum + (p.value ?? 0), 0) / window.length;
    return { date: point.date, value: Math.round(avg * 10) / 10 };
  });
}
