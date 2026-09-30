/**
 * tests/unit/metrics.test.ts
 *
 * Unit tests for the Milestone 3 metric definitions and resolver:
 *   - All expected metric keys are registered
 *   - MetricDefinition fields are valid
 *   - applyRollingAverage computes correct averages
 *   - resolveMetricData returns DataPoints for all dates in range
 */

import { describe, it, expect } from "vitest";
import {
  METRIC_DEFINITIONS,
  METRIC_BY_KEY,
  metricLabel,
  DEFAULT_WIDGETS,
  customMetricToDefinition,
  getAllMetricDefinitions,
} from "@/lib/metrics/definitions";
import type { CustomMetric } from "@/lib/db";
import { applyRollingAverage } from "@/lib/metrics/resolver";
import type { DataPoint } from "@/lib/metrics/resolver";

// ---------------------------------------------------------------------------
// Metric definitions registry
// ---------------------------------------------------------------------------

describe("METRIC_DEFINITIONS registry", () => {
  it("contains at least one metric per source type", () => {
    const sources = new Set(METRIC_DEFINITIONS.map((d) => d.source));
    expect(sources.has("computed")).toBe(true);
    expect(sources.has("manual")).toBe(true);
    expect(sources.has("connector")).toBe(true);
  });

  it("all keys are unique", () => {
    const keys = METRIC_DEFINITIONS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("task.completion_percent is registered", () => {
    expect(METRIC_BY_KEY["task.completion_percent"]).toBeDefined();
  });

  it("all expected manual metric keys are registered", () => {
    const manualKeys = [
      "manual.exercise_minutes",
      "manual.dsa_problems",
      "manual.mobile_usage_minutes",
    ];
    for (const k of manualKeys) {
      expect(METRIC_BY_KEY[k]).toBeDefined();
      expect(METRIC_BY_KEY[k].source).toBe("manual");
    }
  });

  it("all expected GitHub metric keys are registered", () => {
    const ghKeys = ["github.contributions", "github.commits", "github.pull_requests"];
    for (const k of ghKeys) {
      expect(METRIC_BY_KEY[k]).toBeDefined();
      expect(METRIC_BY_KEY[k].source).toBe("connector");
      expect(METRIC_BY_KEY[k].connectorId).toBe("github");
    }
  });

  it("all expected LeetCode metric keys are registered", () => {
    const lcKeys = ["leetcode.accepted", "leetcode.easy", "leetcode.medium", "leetcode.hard", "leetcode.active"];
    for (const k of lcKeys) {
      expect(METRIC_BY_KEY[k]).toBeDefined();
      expect(METRIC_BY_KEY[k].source).toBe("connector");
      expect(METRIC_BY_KEY[k].connectorId).toBe("leetcode");
    }
  });

  it("each definition has required fields", () => {
    for (const def of METRIC_DEFINITIONS) {
      expect(typeof def.key).toBe("string");
      expect(def.key.length).toBeGreaterThan(0);
      expect(typeof def.label).toBe("string");
      expect(typeof def.unit).toBe("string");
      expect(["sum", "last", "max", "avg"]).toContain(def.aggregation);
      expect(["line", "bar", "area", "heatmap"]).toContain(def.defaultChart);
      expect(typeof def.defaultColor).toBe("string");
      expect(["zero", "null"]).toContain(def.missingDataPolicy);
    }
  });

  it("connector metrics have connectorId set", () => {
    const connectorMetrics = METRIC_DEFINITIONS.filter((d) => d.source === "connector");
    for (const def of connectorMetrics) {
      expect(def.connectorId).toBeDefined();
    }
  });

  it("manual metrics have manualMetricKey set", () => {
    const manualMetrics = METRIC_DEFINITIONS.filter((d) => d.source === "manual");
    for (const def of manualMetrics) {
      expect(def.manualMetricKey).toBeDefined();
    }
  });
});

describe("metricLabel", () => {
  it("returns human-readable label for known keys", () => {
    expect(metricLabel("github.contributions")).toBe("GitHub Contributions");
    expect(metricLabel("leetcode.accepted")).toBe("LeetCode Accepted");
    expect(metricLabel("task.completion_percent")).toBe("Task Completion");
  });

  it("returns the raw key for unknown metrics", () => {
    expect(metricLabel("unknown.metric.key")).toBe("unknown.metric.key");
  });
});

describe("DEFAULT_WIDGETS", () => {
  it("references only registered metric keys", () => {
    for (const dw of DEFAULT_WIDGETS) {
      expect(METRIC_BY_KEY[dw.metricKey]).toBeDefined();
    }
  });

  it("uses valid chart types", () => {
    const validTypes = ["line", "bar", "area", "heatmap"];
    for (const dw of DEFAULT_WIDGETS) {
      expect(validTypes).toContain(dw.chartType);
    }
  });

  it("uses valid date ranges", () => {
    const validRanges = ["7d", "30d", "90d"];
    for (const dw of DEFAULT_WIDGETS) {
      expect(validRanges).toContain(dw.range);
    }
  });
});

// ---------------------------------------------------------------------------
// applyRollingAverage
// ---------------------------------------------------------------------------

describe("applyRollingAverage", () => {
  const makePoints = (values: (number | null)[]): DataPoint[] =>
    values.map((value, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      value,
    }));

  it("returns same length as input", () => {
    const data = makePoints([1, 2, 3, 4, 5]);
    const result = applyRollingAverage(data, 3);
    expect(result.length).toBe(5);
  });

  it("3-day window: first point is itself", () => {
    const data = makePoints([6, 3, 9]);
    const result = applyRollingAverage(data, 3);
    expect(result[0].value).toBe(6);
  });

  it("3-day window: second point averages [6, 3]", () => {
    const data = makePoints([6, 3, 9]);
    const result = applyRollingAverage(data, 3);
    expect(result[1].value).toBe(4.5);
  });

  it("3-day window: third point averages [6, 3, 9]", () => {
    const data = makePoints([6, 3, 9]);
    const result = applyRollingAverage(data, 3);
    expect(result[2].value).toBe(6);
  });

  it("passes through null values unchanged", () => {
    const data = makePoints([1, null, 3]);
    const result = applyRollingAverage(data, 3);
    expect(result[1].value).toBeNull();
  });

  it("excludes nulls from window calculation", () => {
    // Window of [1, null] should average only [1] = 1
    // Window of [1, null, 3] for index 2: non-null values are [1, 3], avg = 2
    const data = makePoints([1, null, 3]);
    const result = applyRollingAverage(data, 3);
    expect(result[2].value).toBe(2);
  });

  it("1-day window: all values unchanged", () => {
    const data = makePoints([5, 10, 15]);
    const result = applyRollingAverage(data, 1);
    expect(result[0].value).toBe(5);
    expect(result[1].value).toBe(10);
    expect(result[2].value).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Custom metric registration and helpers
// ---------------------------------------------------------------------------

describe("Custom metrics registry and formatting", () => {
  const sampleCustomMetric: CustomMetric = {
    key: "water_intake",
    label: "Water Intake",
    unit: "glasses",
    defaultGoalLine: 8,
    defaultChart: "bar",
    createdAt: "2026-10-01T00:00:00Z",
  };

  it("customMetricToDefinition converts a CustomMetric correctly", () => {
    const def = customMetricToDefinition(sampleCustomMetric);
    expect(def.key).toBe("manual.water_intake");
    expect(def.label).toBe("Water Intake");
    expect(def.unit).toBe("glasses");
    expect(def.defaultGoalLine).toBe(8);
    expect(def.defaultChart).toBe("bar");
    expect(def.source).toBe("manual");
    expect(def.manualMetricKey).toBe("water_intake");
  });

  it("getAllMetricDefinitions merges default and custom definitions", () => {
    const all = getAllMetricDefinitions([sampleCustomMetric]);
    expect(all.length).toBe(METRIC_DEFINITIONS.length + 1);
    const found = all.find((d) => d.key === "manual.water_intake");
    expect(found).toBeDefined();
    expect(found?.label).toBe("Water Intake");
  });

  it("metricLabel resolves custom metrics and fallback titles", () => {
    expect(metricLabel("manual.water_intake", [sampleCustomMetric])).toBe("Water Intake");
    expect(metricLabel("water_intake", [sampleCustomMetric])).toBe("Water Intake");
    // Fallback when not in custom list but has manual prefix
    expect(metricLabel("manual.sleep_hours")).toBe("Sleep Hours");
    // Default metrics still resolve
    expect(metricLabel("task.completion_percent")).toBe("Task Completion");
  });

  it("addCustomMetric avoids colliding with built-in manualMetricKey", async () => {
    const { addCustomMetric } = await import("@/lib/repositories");
    // "Exercise Minutes" would slugify to "exercise_minutes", which collides with built-in manualMetricKey
    const metric = await addCustomMetric({
      label: "Exercise Minutes",
      unit: "min",
      addToDashboard: false,
    });
    expect(metric.key).toBe("exercise_minutes_1");
  });

  it("deleteCustomMetric only removes widgets matching manual.${key}", async () => {
    const { deleteCustomMetric, getDashboardWidgets, upsertDashboardWidget } = await import("@/lib/repositories");
    const { generateId } = await import("@/lib/uuid");
    
    // Add a widget using manual.water_intake and another using bare water_intake
    const widget1Id = generateId();
    const widget2Id = generateId();

    const widget1 = {
      id: widget1Id,
      metricKeys: ["manual.water_intake"],
      chartType: "bar" as const,
      range: "30d" as const,
      aggregation: "daily" as const,
      config: {
        goalLine: null,
        rollingAverage: null,
        title: "Water Intake",
        color: null,
        visible: true,
      },
      position: 0,
    };

    const widget2 = {
      id: widget2Id,
      metricKeys: ["water_intake"], // unrelated bare key
      chartType: "bar" as const,
      range: "30d" as const,
      aggregation: "daily" as const,
      config: {
        goalLine: null,
        rollingAverage: null,
        title: "Bare Key",
        color: null,
        visible: true,
      },
      position: 1,
    };

    await upsertDashboardWidget(widget1);
    await upsertDashboardWidget(widget2);

    await deleteCustomMetric("water_intake");

    const remaining = await getDashboardWidgets();
    const ids = remaining.map((w) => w.id);
    expect(ids).not.toContain(widget1Id);
    expect(ids).toContain(widget2Id);
  });
});
