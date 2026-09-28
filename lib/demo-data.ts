/**
 * lib/demo-data.ts
 *
 * Seeds realistic demo data into the local Dexie database.
 * Only invoked when the user explicitly clicks "Load demo data" in Settings.
 * Never auto-injected on first load.
 */

import { db } from "./db";
import { generateId } from "./uuid";
import { nowISO, toDateKey } from "./date";

export async function loadDemoData(timezone: string): Promise<void> {
  // Clear existing data first
  await db.transaction(
    "rw",
    [
      db.dailyLogs,
      db.taskInstances,
      db.manualMetrics,
      db.dashboardWidgets,
    ],
    async () => {
      await db.dailyLogs.clear();
      await db.taskInstances.clear();
      await db.manualMetrics.clear();
      await db.dashboardWidgets.clear();
    },
  );

  const today = new Date();
  const days = 14; // 2 weeks of demo data

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86_400_000);
    const dateKey = toDateKey(date, timezone);
    const logId = generateId();

    await db.dailyLogs.add({
      id: logId,
      date: dateKey,
      timezone,
      note: i === 0 ? "Today — let's get focused." : "",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      deletedAt: null,
    });

    // Tasks
    const tasks = [
      { title: "Solve DSA problems", targetValue: 5, unit: "problems", completedValue: Math.floor(Math.random() * 6), status: "todo" as const },
      { title: "Morning run", targetValue: null, unit: null, completedValue: 1, status: Math.random() > 0.3 ? "done" as const : "todo" as const },
      { title: "Read technical articles", targetValue: 2, unit: "articles", completedValue: Math.random() > 0.4 ? 2 : 1, status: "todo" as const },
      { title: "Review pull requests", targetValue: null, unit: null, completedValue: 1, status: Math.random() > 0.4 ? "done" as const : "todo" as const },
    ];

    for (let j = 0; j < tasks.length; j++) {
      const t = tasks[j];
      const isDone = t.status === "done" ||
        (t.targetValue != null && t.completedValue >= (t.targetValue ?? 0));
      await db.taskInstances.add({
        id: generateId(),
        dailyLogId: logId,
        templateId: null,
        title: t.title,
        targetValue: t.targetValue ?? null,
        completedValue: t.completedValue,
        unit: t.unit ?? null,
        status: isDone ? "done" : t.status,
        sortOrder: j,
        createdAt: nowISO(),
        completedAt: isDone ? nowISO() : null,
        deletedAt: null,
      });
    }

    // Manual metrics
    await db.manualMetrics.add({
      id: generateId(),
      dailyLogId: logId,
      metricKey: "exercise_minutes",
      value: Math.floor(Math.random() * 45) + 15,
      unit: "minutes",
      source: "manual",
      recordedAt: nowISO(),
    });

    await db.manualMetrics.add({
      id: generateId(),
      dailyLogId: logId,
      metricKey: "mobile_usage_minutes",
      value: Math.floor(Math.random() * 120) + 60,
      unit: "minutes",
      source: "manual",
      recordedAt: nowISO(),
    });

    await db.manualMetrics.add({
      id: generateId(),
      dailyLogId: logId,
      metricKey: "dsa_problems",
      value: Math.floor(Math.random() * 5) + 1,
      unit: "problems",
      source: "manual",
      recordedAt: nowISO(),
    });
  }

  // Default dashboard widgets
  await db.dashboardWidgets.bulkAdd([
    {
      id: generateId(),
      metricKeys: ["task_completion_percent"],
      chartType: "line",
      range: "7d",
      aggregation: "daily",
      config: { goalLine: 100, rollingAverage: null, title: "Task Completion %", color: null, visible: true },
      position: 0,
    },
    {
      id: generateId(),
      metricKeys: ["exercise_minutes"],
      chartType: "bar",
      range: "7d",
      aggregation: "daily",
      config: { goalLine: 30, rollingAverage: null, title: "Exercise (min)", color: null, visible: true },
      position: 1,
    },
    {
      id: generateId(),
      metricKeys: ["dsa_problems"],
      chartType: "bar",
      range: "7d",
      aggregation: "daily",
      config: { goalLine: 3, rollingAverage: null, title: "DSA Problems", color: null, visible: true },
      position: 2,
    },
    {
      id: generateId(),
      metricKeys: ["mobile_usage_minutes"],
      chartType: "line",
      range: "7d",
      aggregation: "daily",
      config: { goalLine: 180, rollingAverage: null, title: "Mobile Usage (min)", color: null, visible: true },
      position: 3,
    },
  ]);
}
