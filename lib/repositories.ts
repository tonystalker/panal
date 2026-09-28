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
  if (existing) return existing;
  const profile = UserProfileSchema.parse({
    id: generateId(),
    timezone: tz,
    createdAt: nowISO(),
    preferences: { firstDayOfWeek: 1, theme: "system" },
  });
  await db.userProfile.add(profile);
  return profile;
}

export async function updateProfile(patch: Partial<UserProfile>): Promise<void> {
  const profile = await db.userProfile.toCollection().first();
  if (!profile) return;
  await db.userProfile.update(profile.id, patch);
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
