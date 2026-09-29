/**
 * lib/connectors/github.ts
 *
 * GitHub connector — fetches contribution data via the GitHub GraphQL API.
 * Uses a fine-grained PAT (owner token) stored in the local encrypted vault.
 * Device-side fetch only — no server proxy.
 *
 * Metric keys produced:
 *   github.contributions  — total contribution count for a day
 *   github.commits        — commit contributions
 *   github.pull_requests  — PR opened count
 *   github.active         — 1 if any activity that day, 0 otherwise
 */

import type { ConnectorAdapter, GitHubSettings, SyncResult, MetricEventInput } from "./types";

// ---------------------------------------------------------------------------
// GraphQL query — contribution calendar for a date range
// ---------------------------------------------------------------------------

const CONTRIBUTIONS_QUERY = `
  query Contributions($from: DateTime!, $to: DateTime!) {
    viewer {
      login
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
        commitContributionsByRepository {
          contributions(first: 100) {
            nodes {
              occurredAt
              commitCount
            }
          }
        }
        pullRequestContributionsByRepository {
          contributions(first: 100) {
            nodes {
              occurredAt
            }
          }
        }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Types for the GitHub GraphQL response
// ---------------------------------------------------------------------------

interface ContributionDay {
  date: string;
  contributionCount: number;
}

interface GHContributionsResponse {
  data: {
    viewer: {
      login: string;
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: { contributionDays: ContributionDay[] }[];
        };
        commitContributionsByRepository: {
          contributions: { nodes: { occurredAt: string; commitCount: number }[] };
        }[];
        pullRequestContributionsByRepository: {
          contributions: { nodes: { occurredAt: string }[] };
        }[];
      };
    };
  };
  errors?: { message: string }[];
}

// ---------------------------------------------------------------------------
// Mocked data for development (no real PAT required)
// ---------------------------------------------------------------------------

export function buildMockedResult(fromDate: string, toDate: string, fetchedAt: string): SyncResult {
  const events: MetricEventInput[] = [];
  const start = new Date(fromDate + "T00:00:00Z");
  const end = new Date(toDate + "T00:00:00Z");

  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) {
    const dateStr = d.toISOString().slice(0, 10);
    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const contributions = isWeekend
      ? Math.floor(Math.random() * 5)
      : Math.floor(Math.random() * 12) + 1;
    const commits = Math.floor(contributions * 0.7);
    const prs = Math.random() < 0.15 ? 1 : 0;

    events.push(
      { metricKey: "github.contributions", date: dateStr, value: contributions, unit: "contributions", sourceEventId: `gh-contrib-${dateStr}`, observedAt: d.toISOString() },
      { metricKey: "github.commits",       date: dateStr, value: commits,       unit: "commits",       sourceEventId: `gh-commits-${dateStr}`,  observedAt: d.toISOString() },
      { metricKey: "github.pull_requests", date: dateStr, value: prs,           unit: "pull requests", sourceEventId: `gh-prs-${dateStr}`,      observedAt: d.toISOString() },
      { metricKey: "github.active",        date: dateStr, value: contributions > 0 ? 1 : 0, unit: "active", sourceEventId: `gh-active-${dateStr}`, observedAt: d.toISOString() },
    );
  }

  return { events, fetchedAt, latencyMs: 0, fromDate, toDate };
}

// ---------------------------------------------------------------------------
// Real GitHub GraphQL fetch
// ---------------------------------------------------------------------------

async function fetchGitHubContributions(
  token: string,
  fromDate: string,
  toDate: string,
): Promise<{ events: MetricEventInput[]; latencyMs: number; username: string }> {
  const t0 = Date.now();
  const from = `${fromDate}T00:00:00Z`;
  const to = `${toDate}T23:59:59Z`;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: CONTRIBUTIONS_QUERY, variables: { from, to } }),
  });

  const latencyMs = Date.now() - t0;

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as GHContributionsResponse;

  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${json.errors[0].message}`);
  }

  const collection = json.data.viewer.contributionsCollection;
  const username = json.data.viewer.login;

  // Aggregate per-day contribution counts
  const byDate = new Map<string, { contributions: number; commits: number; prs: number }>();

  for (const week of collection.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      byDate.set(day.date, { contributions: day.contributionCount, commits: 0, prs: 0 });
    }
  }

  // Layer in commit counts
  for (const repo of collection.commitContributionsByRepository) {
    for (const node of repo.contributions.nodes) {
      const date = node.occurredAt.slice(0, 10);
      const existing = byDate.get(date);
      if (existing) existing.commits += node.commitCount;
    }
  }

  // Layer in PR counts
  for (const repo of collection.pullRequestContributionsByRepository) {
    for (const node of repo.contributions.nodes) {
      const date = node.occurredAt.slice(0, 10);
      const existing = byDate.get(date);
      if (existing) existing.prs += 1;
    }
  }

  const events: MetricEventInput[] = [];
  for (const [date, counts] of byDate) {
    const observedAt = `${date}T12:00:00Z`;
    events.push(
      { metricKey: "github.contributions", date, value: counts.contributions, unit: "contributions", sourceEventId: `gh-contrib-${date}`, observedAt },
      { metricKey: "github.commits",       date, value: counts.commits,       unit: "commits",       sourceEventId: `gh-commits-${date}`,  observedAt },
      { metricKey: "github.pull_requests", date, value: counts.prs,           unit: "pull requests", sourceEventId: `gh-prs-${date}`,      observedAt },
      { metricKey: "github.active",        date, value: counts.contributions > 0 ? 1 : 0, unit: "active", sourceEventId: `gh-active-${date}`, observedAt },
    );
  }

  return { events, latencyMs, username };
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export const githubAdapter: ConnectorAdapter<GitHubSettings> = {
  id: "github",

  async validateToken(token: string): Promise<string> {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "{ viewer { login } }" }),
    });
    if (!res.ok) throw new Error(`Invalid token: ${res.status} ${res.statusText}`);
    const json = (await res.json()) as { data: { viewer: { login: string } }; errors?: { message: string }[] };
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data.viewer.login;
  },

  async sync(
    settings: GitHubSettings,
    token: string,
    fromDate: string,
    toDate: string,
  ): Promise<SyncResult> {
    const fetchedAt = new Date().toISOString();
    const isDev = process.env.NODE_ENV === "development" && token === "mock";

    if (isDev) {
      return buildMockedResult(fromDate, toDate, fetchedAt);
    }

    const { events, latencyMs } = await fetchGitHubContributions(token, fromDate, toDate);
    return { events, fetchedAt, latencyMs, fromDate, toDate };
  },
};
