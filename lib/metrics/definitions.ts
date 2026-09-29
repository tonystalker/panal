/**
 * lib/metrics/definitions.ts
 *
 * Central registry of every metric key the app understands.
 * The dashboard reads from this — NO `if (connector === "github")` in UI code.
 *
 * Adding a new connector metric = add a MetricDefinition here.
 * The dashboard will auto-pick it up via the DashboardWidget config.
 */

export type AggregationType = "sum" | "last" | "max" | "avg";
export type ChartType = "line" | "bar" | "area" | "heatmap";
export type MissingDataPolicy = "zero" | "null"; // zero = show 0, null = show gap

export interface MetricDefinition {
  key: string;         // e.g. "github.contributions"
  label: string;       // human-readable, e.g. "GitHub Contributions"
  unit: string;        // e.g. "contributions"
  aggregation: AggregationType; // how to combine multiple events on the same day
  defaultChart: ChartType;
  defaultGoalLine: number | null;
  defaultColor: string;
  missingDataPolicy: MissingDataPolicy;
  /** Where the data comes from — "connector" or "manual" or "computed" */
  source: "connector" | "manual" | "computed";
  /** If source === "connector", which connectorId provides this metric */
  connectorId?: "github" | "leetcode";
  /**
   * For manual/computed metrics: function to resolve the data.
   * For connector metrics: data comes from MetricEvent table by metricKey.
   */
  manualMetricKey?: string; // if set, data comes from ManualMetric table
}

// ---------------------------------------------------------------------------
// All V1 metric definitions
// ---------------------------------------------------------------------------

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // ── Task completion (computed) ──────────────────────────────────────────
  {
    key: "task.completion_percent",
    label: "Task Completion",
    unit: "%",
    aggregation: "avg",
    defaultChart: "line",
    defaultGoalLine: 100,
    defaultColor: "#a3ff12",
    missingDataPolicy: "null",
    source: "computed",
  },

  // ── Manual metrics ───────────────────────────────────────────────────────
  {
    key: "manual.exercise_minutes",
    label: "Exercise",
    unit: "min",
    aggregation: "sum",
    defaultChart: "bar",
    defaultGoalLine: 30,
    defaultColor: "#57e389",
    missingDataPolicy: "zero",
    source: "manual",
    manualMetricKey: "exercise_minutes",
  },
  {
    key: "manual.dsa_problems",
    label: "DSA Problems (Manual)",
    unit: "problems",
    aggregation: "sum",
    defaultChart: "bar",
    defaultGoalLine: 3,
    defaultColor: "#f5c451",
    missingDataPolicy: "zero",
    source: "manual",
    manualMetricKey: "dsa_problems",
  },
  {
    key: "manual.mobile_usage_minutes",
    label: "Mobile Usage",
    unit: "min",
    aggregation: "sum",
    defaultChart: "line",
    defaultGoalLine: 180,
    defaultColor: "#ff6b6b",
    missingDataPolicy: "zero",
    source: "manual",
    manualMetricKey: "mobile_usage_minutes",
  },

  // ── GitHub connector metrics ─────────────────────────────────────────────
  {
    key: "github.contributions",
    label: "GitHub Contributions",
    unit: "contributions",
    aggregation: "sum",
    defaultChart: "bar",
    defaultGoalLine: null,
    defaultColor: "#a1a1aa",
    missingDataPolicy: "zero",
    source: "connector",
    connectorId: "github",
  },
  {
    key: "github.commits",
    label: "GitHub Commits",
    unit: "commits",
    aggregation: "sum",
    defaultChart: "bar",
    defaultGoalLine: null,
    defaultColor: "#71717a",
    missingDataPolicy: "zero",
    source: "connector",
    connectorId: "github",
  },
  {
    key: "github.pull_requests",
    label: "GitHub Pull Requests",
    unit: "PRs",
    aggregation: "sum",
    defaultChart: "bar",
    defaultGoalLine: null,
    defaultColor: "#a1a1aa",
    missingDataPolicy: "zero",
    source: "connector",
    connectorId: "github",
  },

  // ── LeetCode connector metrics ───────────────────────────────────────────
  {
    key: "leetcode.accepted",
    label: "LeetCode Accepted",
    unit: "problems",
    aggregation: "sum",
    defaultChart: "bar",
    defaultGoalLine: 2,
    defaultColor: "#f59e0b",
    missingDataPolicy: "zero",
    source: "connector",
    connectorId: "leetcode",
  },
  {
    key: "leetcode.easy",
    label: "LeetCode Easy",
    unit: "problems",
    aggregation: "sum",
    defaultChart: "bar",
    defaultGoalLine: null,
    defaultColor: "#22c55e",
    missingDataPolicy: "zero",
    source: "connector",
    connectorId: "leetcode",
  },
  {
    key: "leetcode.medium",
    label: "LeetCode Medium",
    unit: "problems",
    aggregation: "sum",
    defaultChart: "bar",
    defaultGoalLine: null,
    defaultColor: "#f59e0b",
    missingDataPolicy: "zero",
    source: "connector",
    connectorId: "leetcode",
  },
  {
    key: "leetcode.hard",
    label: "LeetCode Hard",
    unit: "problems",
    aggregation: "sum",
    defaultChart: "bar",
    defaultGoalLine: null,
    defaultColor: "#ef4444",
    missingDataPolicy: "zero",
    source: "connector",
    connectorId: "leetcode",
  },
  {
    key: "leetcode.active",
    label: "LeetCode Active Day",
    unit: "active",
    aggregation: "max",
    defaultChart: "heatmap",
    defaultGoalLine: null,
    defaultColor: "#f59e0b",
    missingDataPolicy: "zero",
    source: "connector",
    connectorId: "leetcode",
  },
];

/** Fast lookup by key */
export const METRIC_BY_KEY: Record<string, MetricDefinition> = Object.fromEntries(
  METRIC_DEFINITIONS.map((d) => [d.key, d]),
);

/**
 * Returns human-readable label for a metric key.
 * Falls back to the raw key if the metric isn't in the registry.
 */
export function metricLabel(key: string): string {
  return METRIC_BY_KEY[key]?.label ?? key;
}

// ---------------------------------------------------------------------------
// Default widget layout (used on first app load / after "Reset widgets")
// ---------------------------------------------------------------------------

export interface DefaultWidget {
  metricKey: string;
  chartType: ChartType;
  range: "7d" | "30d" | "90d";
}

export const DEFAULT_WIDGETS: DefaultWidget[] = [
  { metricKey: "task.completion_percent",   chartType: "line", range: "30d" },
  { metricKey: "manual.mobile_usage_minutes", chartType: "line", range: "7d" },
  { metricKey: "github.contributions",      chartType: "bar",  range: "30d" },
  { metricKey: "leetcode.accepted",         chartType: "bar",  range: "30d" },
  { metricKey: "manual.exercise_minutes",   chartType: "bar",  range: "7d"  },
  { metricKey: "manual.dsa_problems",       chartType: "bar",  range: "7d"  },
];
