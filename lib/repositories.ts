/**
 * lib/repositories.ts
 *
 * Repository functions for all V1 entities.
 * All writes validate through Zod schemas defined in lib/db.ts.
 * All IDs are generated here using lib/uuid.ts.
 * Date keys are YYYY-MM-DD in the user's timezone.
 */

import { db } from "./db";
import {
  DailyLog,
  DailyLogSchema,
  TaskInstance,
  TaskInstanceSchema,
  ManualMetric,
  ManualMetricSchema,
  UserProfile,
  UserProfileSchema,
  CustomMetric,
  DashboardWidget,
  DashboardWidgetSchema,
} from "./db";
import { generateId } from "./uuid";
import { nowISO } from "./date";

// ---------------------------------------------------------------------------
// UserProfile
// ---------------------------------------------------------------------------

export async function getOrCreateProfile(timezone?: string): Promise<UserProfile> {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const existing = await db.userProfile.toCollection().first();
  if (existing) {
    const parsed = UserProfileSchema.parse(existing);
    if (
      !existing.preferences?.workdayCutoff ||
      !existing.preferences?.customMetrics ||
      !existing.preferences?.hiddenDefaultMetrics
    ) {
      await db.userProfile.update(existing.id, { preferences: parsed.preferences });
    }
    return parsed;
  }
  const profile = UserProfileSchema.parse({
    id: generateId(),
    timezone: tz,
    createdAt: nowISO(),
    preferences: {
      firstDayOfWeek: 1,
      theme: "system",
      workdayCutoff: "00:00",
      customMetrics: [],
      hiddenDefaultMetrics: [],
    },
  });
  await db.userProfile.add(profile);
  return profile;
}

export async function getDailyLogByDate(dateKey: string): Promise<DailyLog | null> {
  const log = await db.dailyLogs.where("date").equals(dateKey).and((l) => l.deletedAt === null).first();
  return log ?? null;
}

export async function updateProfile(patch: Partial<UserProfile>): Promise<void> {
  const profile = await db.userProfile.toCollection().first();
  if (!profile) return;
  await db.userProfile.update(profile.id, patch);
}

export async function addCustomMetric(data: {
  key?: string;
  label: string;
  unit: string;
  goalLine?: number | null;
  defaultChart?: "line" | "bar" | "area";
  addToDashboard?: boolean;
}): Promise<CustomMetric> {
  const profile = await getOrCreateProfile();
  const currentCustom = profile.preferences.customMetrics ?? [];
  const existingCustomKeys = new Set(currentCustom.map((m) => m.key));

  let key = data.key;
  if (!key || existingCustomKeys.has(key)) {
    const slug =
      (data.key || data.label)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || `metric_${Date.now()}`;

    key = slug;
    let counter = 1;
    while (existingCustomKeys.has(key)) {
      key = `${slug}_${counter++}`;
    }
  }

  const metric: CustomMetric = {
    key,
    label: data.label.trim(),
    unit: data.unit.trim() || "",
    defaultGoalLine: data.goalLine ?? null,
    defaultChart: data.defaultChart ?? "bar",
    createdAt: nowISO(),
  };

  const updatedCustom = [...currentCustom, metric];
  await updateProfile({
    preferences: {
      ...profile.preferences,
      customMetrics: updatedCustom,
    },
  });

  if (data.addToDashboard !== false) {
    const currentWidgets = await getDashboardWidgets();
    const newWidget = DashboardWidgetSchema.parse({
      id: generateId(),
      metricKeys: [`manual.${metric.key}`],
      chartType: metric.defaultChart ?? "bar",
      range: "30d",
      aggregation: "daily",
      config: {
        goalLine: metric.defaultGoalLine ?? null,
        rollingAverage: null,
        title: metric.label,
        color: "#00d2ff",
        visible: true,
      },
      position: currentWidgets.length,
    });
    await db.dashboardWidgets.add(newWidget);
  }

  return metric;
}

export async function deleteCustomMetric(key: string): Promise<void> {
  const profile = await getOrCreateProfile();
  const updatedCustom = (profile.preferences.customMetrics ?? []).filter((m) => m.key !== key);
  await updateProfile({
    preferences: {
      ...profile.preferences,
      customMetrics: updatedCustom,
    },
  });

  // Also clean up widgets tracking this metric
  const widgets = await getDashboardWidgets();
  for (const w of widgets) {
    if (w.metricKeys.includes(`manual.${key}`)) {
      await deleteWidget(w.id);
    }
  }
}

export async function hideDefaultMetric(key: string): Promise<void> {
  const profile = await getOrCreateProfile();
  const currentHidden = profile.preferences.hiddenDefaultMetrics ?? [];
  if (!currentHidden.includes(key)) {
    await updateProfile({
      preferences: {
        ...profile.preferences,
        hiddenDefaultMetrics: [...currentHidden, key],
      },
    });
  }
}

export async function restoreDefaultMetric(key: string): Promise<void> {
  const profile = await getOrCreateProfile();
  const currentHidden = profile.preferences.hiddenDefaultMetrics ?? [];
  await updateProfile({
    preferences: {
      ...profile.preferences,
      hiddenDefaultMetrics: currentHidden.filter((k) => k !== key),
    },
  });
}

// ---------------------------------------------------------------------------
// DailyLog
// ---------------------------------------------------------------------------

export async function getOrCreateDailyLog(dateKey: string, timezone: string): Promise<DailyLog> {
  const existing = await db.dailyLogs.where("date").equals(dateKey).first();
  if (existing) return existing;
  const log = DailyLogSchema.parse({
    id: generateId(),
    date: dateKey,
    timezone,
    note: "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    deletedAt: null,
  });
  await db.dailyLogs.add(log);
  return log;
}

export async function updateDailyLog(id: string, patch: Partial<DailyLog>): Promise<void> {
  await db.dailyLogs.update(id, { ...patch, updatedAt: nowISO() });
}

export async function getDailyLogsInRange(from: string, to: string): Promise<DailyLog[]> {
  return db.dailyLogs
    .where("date")
    .between(from, to, true, true)
    .and((log) => log.deletedAt === null)
    .sortBy("date");
}

// ---------------------------------------------------------------------------
// TaskInstance
// ---------------------------------------------------------------------------

export async function getTasksForLog(dailyLogId: string): Promise<TaskInstance[]> {
  return db.taskInstances
    .where("dailyLogId")
    .equals(dailyLogId)
    .and((t) => t.deletedAt === null)
    .sortBy("sortOrder");
}

export async function createTask(
  dailyLogId: string,
  data: Pick<TaskInstance, "title" | "targetValue" | "unit">,
  sortOrder: number,
): Promise<TaskInstance> {
  const task = TaskInstanceSchema.parse({
    id: generateId(),
    dailyLogId,
    templateId: null,
    title: data.title,
    targetValue: data.targetValue ?? null,
    completedValue: 0,
    unit: data.unit ?? null,
    status: "todo",
    sortOrder,
    createdAt: nowISO(),
    completedAt: null,
    deletedAt: null,
  });
  await db.taskInstances.add(task);
  return task;
}

export async function updateTask(id: string, patch: Partial<TaskInstance>): Promise<void> {
  await db.taskInstances.update(id, patch);
}

export async function completeTask(id: string): Promise<void> {
  await db.taskInstances.update(id, { status: "done", completedAt: nowISO() });
}

export async function skipTask(id: string): Promise<void> {
  await db.taskInstances.update(id, { status: "skipped" });
}

export async function reopenTask(id: string): Promise<void> {
  await db.taskInstances.update(id, { status: "todo", completedAt: null });
}

export async function softDeleteTask(id: string): Promise<void> {
  await db.taskInstances.update(id, { deletedAt: nowISO() });
}

export async function reorderTasks(orderedIds: string[]): Promise<void> {
  await db.transaction("rw", db.taskInstances, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.taskInstances.update(orderedIds[i], { sortOrder: i });
    }
  });
}

// ---------------------------------------------------------------------------
// ManualMetric
// ---------------------------------------------------------------------------

export async function getManualMetricsForLog(dailyLogId: string): Promise<ManualMetric[]> {
  return db.manualMetrics.where("dailyLogId").equals(dailyLogId).toArray();
}

export async function upsertManualMetric(
  dailyLogId: string,
  metricKey: string,
  value: number,
  unit: string,
): Promise<ManualMetric> {
  const existing = await db.manualMetrics
    .where("dailyLogId")
    .equals(dailyLogId)
    .and((m) => m.metricKey === metricKey)
    .first();

  if (existing) {
    await db.manualMetrics.update(existing.id, { value });
    return { ...existing, value };
  }

  const metric = ManualMetricSchema.parse({
    id: generateId(),
    dailyLogId,
    metricKey,
    value,
    unit,
    source: "manual",
    recordedAt: nowISO(),
  });
  await db.manualMetrics.add(metric);
  return metric;
}

export async function getManualMetricsInRange(
  metricKey: string,
  from: string,
  to: string,
): Promise<Array<{ date: string; value: number }>> {
  // Get all daily logs in range, then join with manual metrics
  const logs = await getDailyLogsInRange(from, to);
  const logIds = logs.map((l) => l.id);
  const logIdToDate = Object.fromEntries(logs.map((l) => [l.id, l.date]));

  const metrics = await db.manualMetrics
    .where("dailyLogId")
    .anyOf(logIds)
    .and((m) => m.metricKey === metricKey)
    .toArray();

  return metrics.map((m) => ({ date: logIdToDate[m.dailyLogId] ?? "", value: m.value }));
}

// ---------------------------------------------------------------------------
// Dashboard Widget
// ---------------------------------------------------------------------------

export async function getDashboardWidgets(): Promise<DashboardWidget[]> {
  return db.dashboardWidgets.orderBy("position").toArray();
}

export async function upsertDashboardWidget(widget: DashboardWidget): Promise<void> {
  const validated = DashboardWidgetSchema.parse(widget);
  await db.dashboardWidgets.put(validated);
}

export async function deleteWidget(id: string): Promise<void> {
  await db.dashboardWidgets.delete(id);
}

export async function reorderWidgets(orderedIds: string[]): Promise<void> {
  await db.transaction("rw", db.dashboardWidgets, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.dashboardWidgets.update(orderedIds[i], { position: i });
    }
  });
}

/**
 * Seed the default widget layout if no widgets exist yet.
 * Called on first dashboard load.
 */
export async function seedDefaultWidgets(): Promise<void> {
  const count = await db.dashboardWidgets.count();
  if (count > 0) return;

  const { DEFAULT_WIDGETS, METRIC_BY_KEY } = await import("./metrics/definitions");

  const widgets: DashboardWidget[] = DEFAULT_WIDGETS.map((dw, i) => {
    const def = METRIC_BY_KEY[dw.metricKey];
    return DashboardWidgetSchema.parse({
      id: generateId(),
      metricKeys: [dw.metricKey],
      chartType: dw.chartType,
      range: dw.range,
      aggregation: "daily",
      config: {
        goalLine: def?.defaultGoalLine ?? null,
        rollingAverage: null,
        title: null,
        color: def?.defaultColor ?? null,
        visible: true,
      },
      position: i,
    });
  });

  await db.dashboardWidgets.bulkAdd(widgets);
}

/**
 * Remove legacy default manual widgets (e.g. exercise_minutes, mobile_usage_minutes, dsa_problems)
 * if the user has not explicitly added them to customMetrics.
 */
export async function cleanupUnaddedManualWidgets(): Promise<void> {
  const profile = await getOrCreateProfile();
  const addedKeys = new Set((profile.preferences.customMetrics ?? []).map((m) => `manual.${m.key}`));
  const legacyKeys = new Set(["manual.exercise_minutes", "manual.dsa_problems", "manual.mobile_usage_minutes"]);

  const widgets = await getDashboardWidgets();
  for (const w of widgets) {
    const isLegacyUnadded = w.metricKeys.some((k) => legacyKeys.has(k) && !addedKeys.has(k));
    if (isLegacyUnadded) {
      await deleteWidget(w.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Task completion math — pure functions (no DB calls)
// ---------------------------------------------------------------------------

/** Task completion % = done tasks / total non-skipped tasks (×100). */
export function taskCompletionPercent(tasks: TaskInstance[]): number {
  const active = tasks.filter((t) => t.status !== "skipped");
  if (active.length === 0) return 0;
  const done = active.filter((t) => t.status === "done").length;
  return Math.round((done / active.length) * 100);
}

/** Target progress % = sum(completedValue) / sum(targetValue) for quantitative tasks (×100). */
export function targetProgressPercent(tasks: TaskInstance[]): number {
  const quantitative = tasks.filter(
    (t) => t.targetValue != null && t.targetValue > 0 && t.status !== "skipped",
  );
  if (quantitative.length === 0) return 0;
  const totalTarget = quantitative.reduce((sum, t) => sum + (t.targetValue ?? 0), 0);
  const totalDone = quantitative.reduce((sum, t) => sum + t.completedValue, 0);
  if (totalTarget === 0) return 0;
  return Math.round((totalDone / totalTarget) * 100);
}
