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

// ---------------------------------------------------------------------------
// LeetCode connector — Milestone 3
// ---------------------------------------------------------------------------

import { buildMockedLeetCodeResult, leetcodeAdapter } from "@/lib/connectors/leetcode";

const LC_FROM = "2025-01-06";
const LC_TO   = "2025-01-12";
const LC_FETCHED = "2025-01-12T12:00:00.000Z";
const LC_METRIC_KEYS = [
  "leetcode.accepted",
  "leetcode.easy",
  "leetcode.medium",
  "leetcode.hard",
  "leetcode.active",
] as const;

describe("buildMockedLeetCodeResult", () => {
  it("covers all days in range", () => {
    const result = buildMockedLeetCodeResult(LC_FROM, LC_TO, LC_FETCHED);
    const dates = new Set(result.events.map((e) => e.date));
    expect(dates.size).toBe(7);
    for (const d of ["2025-01-06","2025-01-07","2025-01-08","2025-01-09","2025-01-10","2025-01-11","2025-01-12"]) {
      expect(dates.has(d)).toBe(true);
    }
  });

  it("emits exactly 5 metric keys per day", () => {
    const result = buildMockedLeetCodeResult(LC_FROM, LC_TO, LC_FETCHED);
    const perDay = new Map<string, Set<string>>();
    for (const e of result.events) {
      if (!perDay.has(e.date)) perDay.set(e.date, new Set());
      perDay.get(e.date)!.add(e.metricKey);
    }
    for (const [, keys] of perDay) {
      expect(keys.size).toBe(5);
      for (const k of LC_METRIC_KEYS) expect(keys.has(k)).toBe(true);
    }
  });

  it("leetcode.active is 1 when accepted > 0, else 0", () => {
    const result = buildMockedLeetCodeResult(LC_FROM, LC_TO, LC_FETCHED);
    for (const date of ["2025-01-06","2025-01-07","2025-01-08","2025-01-09","2025-01-10","2025-01-11","2025-01-12"]) {
      const accepted = result.events.find((e) => e.metricKey === "leetcode.accepted" && e.date === date)!.value;
      const active   = result.events.find((e) => e.metricKey === "leetcode.active"   && e.date === date)!.value;
      expect(active).toBe(accepted > 0 ? 1 : 0);
    }
  });

  it("source event IDs are unique per day and metric", () => {
    const result = buildMockedLeetCodeResult(LC_FROM, LC_TO, LC_FETCHED);
    const ids = result.events.map((e) => e.sourceEventId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fills SyncResult metadata", () => {
    const result = buildMockedLeetCodeResult(LC_FROM, LC_TO, LC_FETCHED, "testuser");
    expect(result.fetchedAt).toBe(LC_FETCHED);
    expect(result.fromDate).toBe(LC_FROM);
    expect(result.toDate).toBe(LC_TO);
    expect(result.latencyMs).toBe(0);
  });
});

describe("leetcodeAdapter.sync (mock mode)", () => {
  it("returns mock result in development mode", async () => {
    const result = await leetcodeAdapter.sync({ username: "testuser", syncDays: 7 }, "mock", LC_FROM, LC_TO);
    expect(result.events.length).toBe(7 * 5);
    expect(result.fromDate).toBe(LC_FROM);
    expect(result.toDate).toBe(LC_TO);
  });
});

describe("persistSyncResult — LeetCode", () => {
  beforeEach(async () => { await db.metricEvents.clear(); await db.connectorConnections.clear(); });

  it("inserts LeetCode events and marks connection synced", async () => {
    await seedConnection("leetcode");
    const result = buildMockedLeetCodeResult(LC_FROM, LC_TO, LC_FETCHED);
    const counts = await persistSyncResult("leetcode", result);
    expect(counts.inserted).toBe(result.events.length);
    expect(counts.updated).toBe(0);
    const conn = await db.connectorConnections.where("connectorId").equals("leetcode").first();
    expect(conn?.status).toBe("connected");
    expect(conn?.lastSyncedAt).toBe(LC_FETCHED);
  });

  it("is idempotent — re-importing same events skips them", async () => {
    await seedConnection("leetcode");
    const result = buildMockedLeetCodeResult(LC_FROM, LC_TO, LC_FETCHED);
    await persistSyncResult("leetcode", result);
    const second = await persistSyncResult("leetcode", result);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(result.events.length);
  });
});

