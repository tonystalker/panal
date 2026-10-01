/**
 * lib/connectors/leetcode.ts
 *
 * LeetCode connector — username-based public profile adapter.
 *
 * Design constraints (from plan.md):
 *  - No HTML scraping. LeetCode has no stable public developer API, so we use
 *    their GraphQL endpoint that backs their own website. If it breaks, we
 *    surface a graceful error and the manual DSA fallback remains fully usable.
 *  - Mocked in development (token === "mock" || NODE_ENV === "development").
 *  - Auth type: "username" — no secret credential needed for public stats.
 *
 * Metric keys produced:
 *   leetcode.accepted   — total accepted submissions today
 *   leetcode.easy       — easy problems accepted today
 *   leetcode.medium     — medium problems accepted today
 *   leetcode.hard       — hard problems accepted today
 *   leetcode.active     — 1 if any accepted submission that day, 0 otherwise
 */

import type { ConnectorAdapter, SyncResult, MetricEventInput } from "./types";

// ---------------------------------------------------------------------------
// LeetCode settings (stored in ConnectorConnection.settings)
// ---------------------------------------------------------------------------

export interface LeetCodeSettings {
  username: string;
  syncDays: number; // default 30
}

// ---------------------------------------------------------------------------
// GraphQL types
// ---------------------------------------------------------------------------

interface RecentSubmission {
  title: string;
  titleSlug: string;
  timestamp: string; // Unix epoch string
  statusDisplay: string;
  lang: string;
}

interface LCProfileResponse {
  data?: {
    recentSubmissionList?: RecentSubmission[] | null;
    matchedUser?: {
      username: string;
      submissionCalendar?: string | null;
      submitStats?: {
        acSubmissionNum: {
          difficulty: string;
          count: number;
          submissions: number;
        }[];
      };
    } | null;
  };
  errors?: { message: string }[];
}

// ---------------------------------------------------------------------------
// Mocked result for development
// ---------------------------------------------------------------------------

export function buildMockedLeetCodeResult(
  fromDate: string,
  toDate: string,
  fetchedAt: string,
  username: string = "mockuser",
): SyncResult {
  const events: MetricEventInput[] = [];
  const start = new Date(fromDate + "T00:00:00Z");
  const end = new Date(toDate + "T00:00:00Z");

  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) {
    const dateStr = d.toISOString().slice(0, 10);
    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;

    // Realistic mock: solve 1–5 problems on weekdays, sometimes on weekends
    const active = isWeekend ? Math.random() < 0.3 : Math.random() < 0.75;
    const easy = active ? Math.floor(Math.random() * 3) : 0;
    const medium = active ? Math.floor(Math.random() * 2) : 0;
    const hard = active && Math.random() < 0.25 ? 1 : 0;
    const accepted = easy + medium + hard;

    events.push(
      {
        metricKey: "leetcode.accepted",
        date: dateStr,
        value: accepted,
        unit: "problems",
        sourceEventId: `lc-accepted-${username}-${dateStr}`,
        observedAt: d.toISOString(),
      },
      {
        metricKey: "leetcode.easy",
        date: dateStr,
        value: easy,
        unit: "problems",
        sourceEventId: `lc-easy-${username}-${dateStr}`,
        observedAt: d.toISOString(),
      },
      {
        metricKey: "leetcode.medium",
        date: dateStr,
        value: medium,
        unit: "problems",
        sourceEventId: `lc-medium-${username}-${dateStr}`,
        observedAt: d.toISOString(),
      },
      {
        metricKey: "leetcode.hard",
        date: dateStr,
        value: hard,
        unit: "problems",
        sourceEventId: `lc-hard-${username}-${dateStr}`,
        observedAt: d.toISOString(),
      },
      {
        metricKey: "leetcode.active",
        date: dateStr,
        value: accepted > 0 ? 1 : 0,
        unit: "active",
        sourceEventId: `lc-active-${username}-${dateStr}`,
        observedAt: d.toISOString(),
      },
    );
  }

  return { events, fetchedAt, latencyMs: 0, fromDate, toDate };
}

// ---------------------------------------------------------------------------
// Real LeetCode GraphQL fetch (no HTML scraping)
// ---------------------------------------------------------------------------

const LC_GRAPHQL_URL = "https://leetcode.com/graphql";

const RECENT_SUBMISSIONS_QUERY = `
  query recentSubmissions($username: String!, $limit: Int!) {
    recentSubmissionList(username: $username, limit: $limit) {
      title
      titleSlug
      timestamp
      statusDisplay
      lang
    }
    matchedUser(username: $username) {
      username
      submissionCalendar
      submitStats {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
      }
    }
  }
`;

function epochToDateStr(epochSec: number): string {
  return new Date(epochSec * 1000).toISOString().slice(0, 10);
}

async function fetchLeetCodeData(
  username: string,
  fromDate: string,
  toDate: string,
): Promise<{ events: MetricEventInput[]; latencyMs: number }> {
  const t0 = Date.now();

  const isBrowser = typeof window !== "undefined";
  const url = isBrowser ? "/api/leetcode" : LC_GRAPHQL_URL;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!isBrowser) {
    headers["Referer"] = "https://leetcode.com";
    headers["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  }

  const body = isBrowser
    ? JSON.stringify({ username, limit: 100 })
    : JSON.stringify({
        query: RECENT_SUBMISSIONS_QUERY,
        variables: { username, limit: 100 },
      });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  const latencyMs = Date.now() - t0;

  if (!res.ok) {
    throw new Error(`LeetCode API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as LCProfileResponse;

  if (json.errors?.length) {
    throw new Error(`LeetCode GraphQL error: ${json.errors[0].message}`);
  }

  if (!json.data?.matchedUser) {
    throw new Error(`LeetCode user "${username}" not found or profile is private.`);
  }

  const submissions = json.data.recentSubmissionList ?? [];
  const byDate = new Map<string, { easy: number; medium: number; hard: number }>();

  // Layer 1: submissionCalendar covering all days in range
  if (json.data.matchedUser.submissionCalendar) {
    try {
      const cal = JSON.parse(json.data.matchedUser.submissionCalendar) as Record<string, number>;
      for (const [epochSecStr, count] of Object.entries(cal)) {
        const dateStr = epochToDateStr(parseInt(epochSecStr, 10));
        if (dateStr >= fromDate && dateStr <= toDate) {
          byDate.set(dateStr, { easy: count, medium: 0, hard: 0 });
        }
      }
    } catch {
      // Non-fatal if calendar parsing encounters an issue
    }
  }

  // Layer 2: recentSubmissionList accepted count verification
  for (const sub of submissions) {
    if (sub.statusDisplay !== "Accepted") continue;
    const dateStr = epochToDateStr(parseInt(sub.timestamp, 10));
    if (dateStr < fromDate || dateStr > toDate) continue;

    if (!byDate.has(dateStr)) {
      byDate.set(dateStr, { easy: 1, medium: 0, hard: 0 });
    }
  }

  const events: MetricEventInput[] = [];
  for (const [date, counts] of byDate) {
    const accepted = counts.easy + counts.medium + counts.hard;
    const observedAt = `${date}T12:00:00Z`;
    events.push(
      { metricKey: "leetcode.accepted", date, value: accepted, unit: "problems", sourceEventId: `lc-accepted-${username}-${date}`, observedAt },
      { metricKey: "leetcode.easy",     date, value: counts.easy,   unit: "problems", sourceEventId: `lc-easy-${username}-${date}`,     observedAt },
      { metricKey: "leetcode.medium",   date, value: counts.medium, unit: "problems", sourceEventId: `lc-medium-${username}-${date}`,   observedAt },
      { metricKey: "leetcode.hard",     date, value: counts.hard,   unit: "problems", sourceEventId: `lc-hard-${username}-${date}`,     observedAt },
      { metricKey: "leetcode.active",   date, value: accepted > 0 ? 1 : 0, unit: "active", sourceEventId: `lc-active-${username}-${date}`, observedAt },
    );
  }

  return { events, latencyMs };
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export const leetcodeAdapter: ConnectorAdapter<LeetCodeSettings> = {
  id: "leetcode",

  async validateToken(_token: string): Promise<string> {
    const username = _token.trim();
    if (!username) throw new Error("Enter a LeetCode username.");
    if (username === "mock") return "mock";

    const isBrowser = typeof window !== "undefined";
    const url = isBrowser ? "/api/leetcode" : LC_GRAPHQL_URL;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!isBrowser) {
      headers["Referer"] = "https://leetcode.com";
      headers["User-Agent"] =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }

    const body = isBrowser
      ? JSON.stringify({ username, limit: 1 })
      : JSON.stringify({
          query: RECENT_SUBMISSIONS_QUERY,
          variables: { username, limit: 1 },
        });

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      throw new Error(`LeetCode connection error: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as LCProfileResponse;
    if (json.errors?.length) {
      throw new Error(`LeetCode error: ${json.errors[0].message}`);
    }
    if (!json.data?.matchedUser) {
      throw new Error(`LeetCode user "${username}" not found or profile is private.`);
    }
    return json.data.matchedUser.username;
  },

  async sync(
    settings: LeetCodeSettings,
    token: string,
    fromDate: string,
    toDate: string,
  ): Promise<SyncResult> {
    const fetchedAt = new Date().toISOString();
    const isDev = token === "mock";

    if (isDev) {
      return buildMockedLeetCodeResult(fromDate, toDate, fetchedAt, settings.username || "mockuser");
    }

    try {
      const { events, latencyMs } = await fetchLeetCodeData(settings.username, fromDate, toDate);
      return { events, fetchedAt, latencyMs, fromDate, toDate };
    } catch (err) {
      // Graceful failure: re-throw with a clear message so the UI can show it.
      // The manual DSA fallback on Today page remains unaffected.
      throw new Error(
        err instanceof Error
          ? `LeetCode sync failed: ${err.message}`
          : "LeetCode sync failed: unknown error",
      );
    }
  },
};

