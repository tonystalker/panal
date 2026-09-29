/**
 * lib/connectors/types.ts
 *
 * Generic connector adapter interface for V1.
 * All connectors (GitHub, LeetCode, …) implement ConnectorAdapter.
 * No catalog/marketplace — only named, hardcoded adapters for now.
 */

export type ConnectorId = "github" | "leetcode";

/** A single normalized data point from a connector */
export interface MetricEventInput {
  metricKey: string;        // e.g. "github.contributions"
  date: string;             // YYYY-MM-DD in user timezone
  value: number;
  unit: string;             // e.g. "contributions"
  sourceEventId: string;    // stable dedup key from the provider
  observedAt: string;       // ISO UTC string: when the activity actually happened
}

/** Outcome of a sync operation */
export interface SyncResult {
  events: MetricEventInput[];
  fetchedAt: string;    // ISO UTC
  latencyMs: number;    // provider round-trip time for display
  fromDate: string;     // YYYY-MM-DD — earliest date fetched
  toDate: string;       // YYYY-MM-DD — latest date fetched
}

/** Settings stored in ConnectorConnection.settings (never credentials) */
export interface GitHubSettings {
  username: string;
  includePrivate: boolean;
  syncDays: number;   // how many days back to fetch (default 30)
}

/** Generic adapter interface every connector must implement */
export interface ConnectorAdapter<TSettings = Record<string, unknown>> {
  readonly id: ConnectorId;

  /**
   * Fetch and normalize data from the provider.
   * Credentials come from the local encrypted vault — never passed by the caller.
   * @param settings  Persisted connector-specific config
   * @param token     Decrypted credential for this sync (never stored raw)
   * @param fromDate  YYYY-MM-DD
   * @param toDate    YYYY-MM-DD
   */
  sync(settings: TSettings, token: string, fromDate: string, toDate: string): Promise<SyncResult>;

  /**
   * Validate a token without persisting anything.
   * Returns the authenticated username on success, throws on failure.
   */
  validateToken(token: string): Promise<string>;
}
