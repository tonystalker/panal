/**
 * tests/unit/connectors.test.ts
 *
 * Unit tests for the Milestone 2 connector layer:
 *   - MetricEventInput shape + normalization from mock GitHub data
 *   - buildMockedResult: date range coverage, four metric keys per day, active flag
 *   - SyncResult structure (fetchedAt, latencyMs, fromDate, toDate)
 *   - githubAdapter.sync in mock mode
 *   - persistSyncResult: insert, idempotent skip, value-change update
 *   - deleteConnectorEvents: wipes only connector rows for that connection
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildMockedResult } from "@/lib/connectors/github";
import { githubAdapter } from "@/lib/connectors/github";
import { persistSyncResult, deleteConnectorEvents } from "@/lib/connectors/sync";
import type { SyncResult } from "@/lib/connectors/types";
import { db } from "@/lib/db";
import { generateId } from "@/lib/uuid";
import { nowISO } from "@/lib/date";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FROM = "2025-01-06"; // Monday
const TO   = "2025-01-12"; // Sunday  (7 days)
const FETCHED_AT = "2025-01-12T12:00:00.000Z";

const METRIC_KEYS = [
  "github.contributions",
  "github.commits",
  "github.pull_requests",
  "github.active",
] as const;

/** Insert a minimal ConnectorConnection so persistSyncResult can find it */
async function seedConnection(connectorId: "github" | "leetcode" = "github") {
  const id = generateId();
  await db.connectorConnections.add({
    id,
    connectorId,
    displayName: "Test",
    status: "connected",
    settings: {},
    encryptedCredential: null,
    lastSyncedAt: null,
    lastError: null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
  return id;
}

// Fully reset the Dexie database between tests so no state bleeds across
beforeEach(async () => {
  await db.delete();
  await db.open();
});

// ---------------------------------------------------------------------------
// buildMockedResult — data shape
// ---------------------------------------------------------------------------

describe("buildMockedResult", () => {
  it("returns exactly 4 metric keys per day in the range", () => {
    const result = buildMockedResult(FROM, TO, FETCHED_AT);
    const days = 7;
    expect(result.events).toHaveLength(days * METRIC_KEYS.length);
  });

  it("covers every date in [from, to] for each metric key", () => {
    const result = buildMockedResult(FROM, TO, FETCHED_AT);
    const dates = new Set(result.events.map((e) => e.date));
    // 7 unique dates
    expect(dates.size).toBe(7);
    expect(dates.has(FROM)).toBe(true);
    expect(dates.has(TO)).toBe(true);
  });

  it("produces all four metric keys for each date", () => {
    const result = buildMockedResult(FROM, TO, FETCHED_AT);
    const byDate = new Map<string, Set<string>>();
    for (const ev of result.events) {
      if (!byDate.has(ev.date)) byDate.set(ev.date, new Set());
      byDate.get(ev.date)!.add(ev.metricKey);
    }
    for (const [, keys] of byDate) {
      for (const k of METRIC_KEYS) {
        expect(keys.has(k)).toBe(true);
      }
    }
  });

  it("sets github.active = 1 when contributions > 0, 0 otherwise", () => {
    const result = buildMockedResult(FROM, TO, FETCHED_AT);
    const byDate = new Map<string, Map<string, number>>();
    for (const ev of result.events) {
      if (!byDate.has(ev.date)) byDate.set(ev.date, new Map());
      byDate.get(ev.date)!.set(ev.metricKey, ev.value);
    }
    for (const [, keys] of byDate) {
      const contributions = keys.get("github.contributions") ?? 0;
      const active = keys.get("github.active");
      const expected = contributions > 0 ? 1 : 0;
      expect(active).toBe(expected);
    }
  });

  it("sourceEventId is stable and unique within a date for each metric key", () => {
    const result = buildMockedResult(FROM, TO, FETCHED_AT);
    const ids = result.events.map((e) => e.sourceEventId);
    const unique = new Set(ids);
    // No two events share the same sourceEventId
    expect(unique.size).toBe(result.events.length);
    // Each sourceEventId encodes the date
    for (const ev of result.events) {
      expect(ev.sourceEventId).toContain(ev.date);
    }
  });

  it("populates fetchedAt, fromDate, toDate on SyncResult", () => {
    const result = buildMockedResult(FROM, TO, FETCHED_AT);
    expect(result.fetchedAt).toBe(FETCHED_AT);
    expect(result.fromDate).toBe(FROM);
    expect(result.toDate).toBe(TO);
    expect(result.latencyMs).toBe(0);
  });

  it("single-day range returns exactly 4 events", () => {
    const result = buildMockedResult("2025-03-01", "2025-03-01", FETCHED_AT);
    expect(result.events).toHaveLength(4);
    expect(result.events.every((e) => e.date === "2025-03-01")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// githubAdapter.sync — mock mode
// ---------------------------------------------------------------------------

describe("githubAdapter.sync (mock mode via vi.stubEnv)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  it("returns a SyncResult with the correct date range when token=mock", async () => {
    const result = await githubAdapter.sync(
      { username: "test", includePrivate: false, syncDays: 7 },
      "mock",
      FROM,
      TO,
    );
    expect(result.fromDate).toBe(FROM);
    expect(result.toDate).toBe(TO);
    expect(result.events.length).toBe(7 * 4);
  });

  it("every event has a non-empty unit and a valid observedAt ISO string", async () => {
    const result = await githubAdapter.sync(
      { username: "test", includePrivate: false, syncDays: 7 },
      "mock",
      FROM,
      TO,
    );
    for (const ev of result.events) {
      expect(ev.unit.length).toBeGreaterThan(0);
      expect(() => new Date(ev.observedAt).toISOString()).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// persistSyncResult — idempotency
// ---------------------------------------------------------------------------

describe("persistSyncResult", () => {
  function makeSyncResult(overrides?: Partial<SyncResult>): SyncResult {
    return {
      fromDate: FROM,
      toDate: FROM, // single day to keep events small
      fetchedAt: FETCHED_AT,
      latencyMs: 120,
      events: [
        {
          metricKey: "github.contributions",
          date: FROM,
          value: 5,
          unit: "contributions",
          sourceEventId: `gh-contrib-${FROM}`,
          observedAt: `${FROM}T12:00:00Z`,
        },
        {
          metricKey: "github.commits",
          date: FROM,
          value: 3,
          unit: "commits",
          sourceEventId: `gh-commits-${FROM}`,
          observedAt: `${FROM}T12:00:00Z`,
        },
      ],
      ...overrides,
    };
  }

  it("inserts new events and returns correct counts", async () => {
    await seedConnection();
    const result = await persistSyncResult("github", makeSyncResult());
    expect(result.inserted).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("skips duplicate events with unchanged values on re-sync", async () => {
    await seedConnection();
    const sync = makeSyncResult();
    await persistSyncResult("github", sync);
    const result2 = await persistSyncResult("github", sync);
    expect(result2.inserted).toBe(0);
    expect(result2.updated).toBe(0);
    expect(result2.skipped).toBe(2);
  });

  it("updates events when value changes on re-sync (GitHub retroactive adjustment)", async () => {
    await seedConnection();
    await persistSyncResult("github", makeSyncResult());

    // Same sourceEventId, different value
    const updated = makeSyncResult({
      events: [
        {
          metricKey: "github.contributions",
          date: FROM,
          value: 9, // was 5
          unit: "contributions",
          sourceEventId: `gh-contrib-${FROM}`,
          observedAt: `${FROM}T12:00:00Z`,
        },
      ],
    });
    const result = await persistSyncResult("github", updated);
    expect(result.updated).toBe(1);
    expect(result.inserted).toBe(0);

    // Verify the DB row was actually updated
    const rows = await db.metricEvents.where("metricKey").equals("github.contributions").toArray();
    expect(rows[0].value).toBe(9);
  });

  it("updates ConnectorConnection.lastSyncedAt after a successful sync", async () => {
    await seedConnection();
    await persistSyncResult("github", makeSyncResult());
    const conn = await db.connectorConnections.where("connectorId").equals("github").first();
    expect(conn?.lastSyncedAt).toBe(FETCHED_AT);
    expect(conn?.status).toBe("connected");
    expect(conn?.lastError).toBeNull();
  });

  it("throws when no ConnectorConnection row exists", async () => {
    // No seed call — table is empty
    await expect(persistSyncResult("github", makeSyncResult())).rejects.toThrow(
      "No ConnectorConnection found for github",
    );
  });

  it("inserts events only for the correct connection (two connectors co-exist)", async () => {
    const ghId = await seedConnection("github");
    // Add a fake leetcode connection
    await db.connectorConnections.add({
      id: generateId(),
      connectorId: "leetcode",
      displayName: "LC",
      status: "connected",
      settings: {},
      encryptedCredential: null,
      lastSyncedAt: null,
      lastError: null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });

    await persistSyncResult("github", makeSyncResult());

    const events = await db.metricEvents.toArray();
    // All events belong to the github connection
    expect(events.every((e) => e.connectionId === ghId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deleteConnectorEvents
// ---------------------------------------------------------------------------

describe("deleteConnectorEvents", () => {
  it("deletes only events for the specified connector", async () => {
    await seedConnection("github");
    await persistSyncResult("github", {
      fromDate: FROM,
      toDate: FROM,
      fetchedAt: FETCHED_AT,
      latencyMs: 0,
      events: [
        { metricKey: "github.contributions", date: FROM, value: 3, unit: "contributions", sourceEventId: `gh-contrib-${FROM}`, observedAt: `${FROM}T12:00:00Z` },
        { metricKey: "github.commits",       date: FROM, value: 2, unit: "commits",       sourceEventId: `gh-commits-${FROM}`,  observedAt: `${FROM}T12:00:00Z` },
      ],
    });

    const before = await db.metricEvents.count();
    expect(before).toBe(2);

    const deleted = await deleteConnectorEvents("github");
    expect(deleted).toBe(2);

    const after = await db.metricEvents.count();
    expect(after).toBe(0);
  });

  it("returns 0 when no connection row exists", async () => {
    const count = await deleteConnectorEvents("github");
    expect(count).toBe(0);
  });
});
