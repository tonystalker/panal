/**
 * lib/connectors/sync.ts
 *
 * Persists a SyncResult into IndexedDB:
 *   - Upserts MetricEvent rows using the compound unique index so re-syncing is idempotent.
 *   - Updates ConnectorConnection.lastSyncedAt / lastError.
 *   - Returns counts for the UI to display.
 */

import { db } from "@/lib/db";
import { nowISO } from "@/lib/date";
import { generateId } from "@/lib/uuid";
import type { SyncResult } from "./types";
import type { ConnectorId } from "./types";

export interface PersistResult {
  inserted: number;
  updated: number;
  skipped: number;
}

export async function persistSyncResult(
  connectorId: ConnectorId,
  result: SyncResult,
): Promise<PersistResult> {
  const row = await db.connectorConnections
    .where("connectorId")
    .equals(connectorId)
    .first();

  if (!row) throw new Error(`No ConnectorConnection found for ${connectorId}`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  await db.transaction("rw", db.metricEvents, db.connectorConnections, async () => {
    for (const ev of result.events) {
      // Look up by compound index: [connectionId+metricKey+date+sourceEventId]
      const existing = await db.metricEvents
        .where("[connectionId+metricKey+date+sourceEventId]")
        .equals([row.id, ev.metricKey, ev.date, ev.sourceEventId])
        .first();

      if (existing) {
        if (existing.value !== ev.value) {
          // Value changed (e.g. GitHub retroactively adjusts contribution counts)
          await db.metricEvents.update(existing.id, {
            value: ev.value,
            importedAt: result.fetchedAt,
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        await db.metricEvents.add({
          id: generateId(),
          connectionId: row.id,
          metricKey: ev.metricKey,
          date: ev.date,
          value: ev.value,
          unit: ev.unit,
          source: "connector",
          sourceEventId: ev.sourceEventId,
          observedAt: ev.observedAt,
          importedAt: result.fetchedAt,
        });
        inserted++;
      }
    }

    // Update sync timestamp on the connection row
    await db.connectorConnections.update(row.id, {
      status: "connected",
      lastSyncedAt: result.fetchedAt,
      lastError: null,
      updatedAt: nowISO(),
    });
  });

  return { inserted, updated, skipped };
}

/**
 * Delete all MetricEvents imported from a given connector connection.
 * Called on disconnect when the user chooses to wipe historical imports.
 */
export async function deleteConnectorEvents(connectorId: ConnectorId): Promise<number> {
  const row = await db.connectorConnections
    .where("connectorId")
    .equals(connectorId)
    .first();
  if (!row) return 0;

  const keys = await db.metricEvents
    .where("source")
    .equals("connector")
    .and((e) => e.connectionId === row.id)
    .primaryKeys();

  await db.metricEvents.bulkDelete(keys as string[]);
  return keys.length;
}
