/**
 * lib/db.ts
 *
 * Dexie (IndexedDB) database definition for Personal Analytics V1.
 *
 * Rules (do not reverse without updating context.md):
 *  - Every schema shape change = new version(N) + migration callback + upgrade test.
 *  - IDs are client-generated UUID v4 strings — never auto-increment.
 *  - Date keys are "YYYY-MM-DD" strings in the user's local timezone.
 *  - Timestamps (createdAt, updatedAt, etc.) are ISO 8601 UTC strings.
 *  - Soft-delete fields (deletedAt) are included but not yet wired to sync logic.
 *  - ConnectorConnection.encryptedCredential is never exported in backups.
 */

import Dexie, { type EntityTable } from "dexie";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schemas — used at write/import boundaries to validate data integrity
// ---------------------------------------------------------------------------

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  timezone: z.string().min(1), // IANA timezone string, e.g. "Asia/Kolkata"
  createdAt: z.string().datetime(),
  preferences: z.object({
    firstDayOfWeek: z.number().int().min(0).max(6).default(1), // 0=Sun, 1=Mon
    theme: z.enum(["system", "light", "dark"]).default("system"),
  }),
});

export const DailyLogSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD in user timezone
  timezone: z.string().min(1),
  note: z.string().default(""),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().default(null),
});

export const TaskTemplateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  defaultTargetValue: z.number().positive().nullable().default(null),
  unit: z.string().max(50).nullable().default(null),
  category: z.string().max(50).nullable().default(null),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().default(null),
});

export const TaskInstanceSchema = z.object({
  id: z.string().uuid(),
  dailyLogId: z.string().uuid(),
  templateId: z.string().uuid().nullable().default(null), // null = ad-hoc task
  title: z.string().min(1).max(200),
  targetValue: z.number().positive().nullable().default(null), // null = binary task
  completedValue: z.number().min(0).default(0),
  unit: z.string().max(50).nullable().default(null),
  status: z.enum(["todo", "done", "skipped"]).default("todo"),
  sortOrder: z.number().int().default(0),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().default(null),
  deletedAt: z.string().datetime().nullable().default(null),
});

export const ManualMetricSchema = z.object({
  id: z.string().uuid(),
  dailyLogId: z.string().uuid(),
  metricKey: z.string().min(1).max(100), // e.g. "exercise_minutes", "mobile_usage_minutes"
  value: z.number(),
  unit: z.string().max(50),
  source: z.literal("manual"),
  recordedAt: z.string().datetime(),
});

export const ConnectorConnectionSchema = z.object({
  id: z.string().uuid(),
  connectorId: z.enum(["github", "leetcode"]),
  displayName: z.string().max(200),
  status: z.enum(["not_connected", "connected", "error", "syncing"]).default("not_connected"),
  settings: z.record(z.unknown()).default({}), // connector-specific config (never credentials)
  encryptedCredential: z.string().nullable().default(null), // AES-GCM encrypted blob; NOT exported in backups
  lastSyncedAt: z.string().datetime().nullable().default(null),
  lastError: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const MetricEventSchema = z.object({
  id: z.string().uuid(),
  connectionId: z.string().uuid().nullable().default(null), // null = manual source
  metricKey: z.string().min(1).max(100), // e.g. "github.contributions", "leetcode.accepted"
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number(),
  unit: z.string().max(50),
  source: z.enum(["manual", "connector"]),
  sourceEventId: z.string().nullable().default(null), // for idempotent connector re-import
  observedAt: z.string().datetime(), // when the event actually occurred (provider time)
  importedAt: z.string().datetime(), // when we imported it into local DB
});

export const DashboardWidgetSchema = z.object({
  id: z.string().uuid(),
  metricKeys: z.array(z.string().min(1)).min(1),
  chartType: z.enum(["line", "bar", "area", "heatmap"]),
  range: z.union([
    z.enum(["7d", "30d", "90d"]),
    z.object({ from: z.string(), to: z.string() }),
  ]),
  aggregation: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  config: z.object({
    goalLine: z.number().nullable().default(null),
    rollingAverage: z.number().int().positive().nullable().default(null), // window in days
    title: z.string().nullable().default(null),
    color: z.string().nullable().default(null),
    visible: z.boolean().default(true),
  }).default({}),
  position: z.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// TypeScript types derived from Zod schemas
// ---------------------------------------------------------------------------

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type DailyLog = z.infer<typeof DailyLogSchema>;
export type TaskTemplate = z.infer<typeof TaskTemplateSchema>;
export type TaskInstance = z.infer<typeof TaskInstanceSchema>;
export type ManualMetric = z.infer<typeof ManualMetricSchema>;
export type ConnectorConnection = z.infer<typeof ConnectorConnectionSchema>;
export type MetricEvent = z.infer<typeof MetricEventSchema>;
export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>;

// ---------------------------------------------------------------------------
// Dexie database class
// ---------------------------------------------------------------------------

export class PersonalAnalyticsDB extends Dexie {
  userProfile!: EntityTable<UserProfile, "id">;
  dailyLogs!: EntityTable<DailyLog, "id">;
  taskTemplates!: EntityTable<TaskTemplate, "id">;
  taskInstances!: EntityTable<TaskInstance, "id">;
  manualMetrics!: EntityTable<ManualMetric, "id">;
  connectorConnections!: EntityTable<ConnectorConnection, "id">;
  metricEvents!: EntityTable<MetricEvent, "id">;
  dashboardWidgets!: EntityTable<DashboardWidget, "id">;

  constructor() {
    super("personal-analytics");

    /**
     * version(1) — initial schema
     *
     * Index syntax: "&" = primary key, "," separates indexes.
     * Compound indexes use "[field1+field2]" syntax.
     * Only fields needed for queries are indexed — Dexie stores all fields.
     *
     * Migration policy: adding a new version() block is mandatory for every
     * structural change. Include a migration callback + update the fixture in
     * tests/fixtures/backup-v1.json to cover the new shape.
     */
    this.version(1).stores({
      // Primary key = id (UUID). Additional indexes for common queries.
      userProfile: "&id",

      // Unique date per timezone bucket; query by date range.
      dailyLogs: "&id, date, timezone, deletedAt",

      // Look up active templates; soft-delete via deletedAt.
      taskTemplates: "&id, active, deletedAt",

      // Critical: query tasks by parent log; soft-delete support.
      taskInstances: "&id, dailyLogId, templateId, status, sortOrder, deletedAt",

      // Query manual metrics by log + key (e.g. all exercise entries for a log).
      manualMetrics: "&id, dailyLogId, metricKey",

      // One connection per connector type (github, leetcode).
      connectorConnections: "&id, connectorId, status",

      /**
       * Compound unique index: (connectionId, metricKey, date, sourceEventId)
       * Enforces idempotent connector imports — re-importing the same event
       * from the same source on the same date will hit this index and allow
       * an upsert rather than creating duplicates.
       */
      metricEvents:
        "&id, [connectionId+metricKey+date+sourceEventId], metricKey, date, source",

      // Widget layout is ordered by position.
      dashboardWidgets: "&id, position",
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton instance — import this everywhere; never call `new` elsewhere
// ---------------------------------------------------------------------------

export const db = new PersonalAnalyticsDB();
