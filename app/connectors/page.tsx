"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { nowISO } from "@/lib/date";
import { vaultStore, vaultRead, vaultClear } from "@/lib/connectors/vault";
import { githubAdapter } from "@/lib/connectors/github";
import { leetcodeAdapter } from "@/lib/connectors/leetcode";
import type { LeetCodeSettings } from "@/lib/connectors/leetcode";
import { requestDeviceCode, pollForToken } from "@/lib/connectors/github-oauth";
import { persistSyncResult, deleteConnectorEvents } from "@/lib/connectors/sync";
import { format, parseISO, subDays } from "date-fns";
import type { ConnectorConnection } from "@/lib/db";
import type { GitHubSettings } from "@/lib/connectors/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConnectorPanel } from "@/components/ConnectorPanel";
import {
  ShieldCheckIcon,
  RefreshCwIcon,
  CheckIcon,
  AlertTriangleIcon,
  ExternalLinkIcon,
  UnplugIcon,
  KeyRoundIcon,
} from "lucide-react";

const HAS_OAUTH = !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

// ---------------------------------------------------------------------------
// Data Hooks
// ---------------------------------------------------------------------------

function useGitHubConnection() {
  return useQuery({
    queryKey: ["connector", "github"],
    queryFn: () =>
      db.connectorConnections
        .where("connectorId")
        .equals("github")
        .first()
        .then((r) => r ?? null),
  });
}

function useLeetCodeConnection() {
  return useQuery({
    queryKey: ["connector", "leetcode"],
    queryFn: () =>
      db.connectorConnections
        .where("connectorId")
        .equals("leetcode")
        .first()
        .then((r) => r ?? null),
  });
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ConnectorsPage() {
  return (
    <div className="page fade-in">
      <PageHeader
        title="Connectors"
        description="Connect developer services to import metrics automatically. All data and credentials remain on-device."
      />

      <div className="flex flex-col gap-6 max-w-3xl">
        <GitHubPanel />
        <LeetCodePanel />

        {/* Privacy Note */}
        <div className="p-4 rounded-xl border border-border/60 bg-surface-muted/40 flex items-start gap-3">
          <ShieldCheckIcon className="size-4 text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground font-medium">Privacy First:</strong> Connector credentials are encrypted on-device using AES-GCM before being stored. Tokens are transmitted directly to the respective service API and never forwarded to any intermediary servers.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GitHub Panel
// ---------------------------------------------------------------------------

type PanelView = "idle" | "waiting-auth" | "syncing" | "disconnect-confirm" | "pat-fallback";

function GitHubPanel() {
  const qc = useQueryClient();
  const { data: conn } = useGitHubConnection();

  const [view, setView] = useState<PanelView>("idle");
  const [includePrivate, setIncludePrivate] = useState(false);
  const [syncDays, setSyncDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deleteHistory, setDeleteHistory] = useState(false);

  // OAuth device flow state
  const [userCode, setUserCode] = useState<string>("");
  const [verificationUri, setVerificationUri] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // PAT fallback state
  const [pat, setPat] = useState("");

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 6000);
  }, []);

  const finaliseConnection = useCallback(
    async (token: string) => {
      setView("syncing");
      try {
        const username = await githubAdapter.validateToken(token);
        const settings: GitHubSettings = { username, includePrivate, syncDays };
        await vaultStore("github", token, settings as unknown as Record<string, unknown>, `GitHub (${username})`);

        const to = new Date().toISOString().slice(0, 10);
        const from = format(subDays(parseISO(to), syncDays - 1), "yyyy-MM-dd");
        const vaultToken = await vaultRead("github");
        const result = await githubAdapter.sync(settings, vaultToken, from, to);
        await persistSyncResult("github", result);

        qc.invalidateQueries({ queryKey: ["connector", "github"] });
        qc.invalidateQueries({ queryKey: ["metricEvents"] });
        setPat("");
        setView("idle");
        showSuccess(
          `Connected as @${username}. Synced ${Math.round(result.events.length / 4)} days` +
            (result.latencyMs ? ` (${result.latencyMs}ms)` : "") + ".",
        );
      } catch (e) {
        setView("idle");
        setError((e as Error).message);
      }
    },
    [includePrivate, syncDays, qc, showSuccess],
  );

  const oauthMut = useMutation({
    mutationFn: async () => {
      setError(null);
      const challenge = await requestDeviceCode(includePrivate);
      setUserCode(challenge.userCode);
      setVerificationUri(challenge.verificationUri);
      setExpiresAt(challenge.expiresAt);
      setView("waiting-auth");

      window.open(challenge.verificationUri, "_blank", "noopener,noreferrer");

      const abort = new AbortController();
      abortRef.current = abort;

      const token = await pollForToken(challenge, abort.signal);
      return token;
    },
    onSuccess: (token) => finaliseConnection(token),
    onError: (e: Error) => {
      if (e.message !== "Cancelled") setError(e.message);
      setView("idle");
    },
  });

  const cancelOAuth = useCallback(() => {
    abortRef.current?.abort();
    setView("idle");
    setUserCode("");
  }, []);

  const patMut = useMutation({
    mutationFn: async () => {
      if (!pat.trim()) throw new Error("Enter a personal access token.");
      return pat.trim();
    },
    onSuccess: (token) => finaliseConnection(token),
    onError: (e: Error) => setError(e.message),
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      if (!conn) throw new Error("Not connected");
      const settings = conn.settings as unknown as GitHubSettings;
      const days = settings.syncDays ?? 30;
      const to = new Date().toISOString().slice(0, 10);
      const from = format(subDays(parseISO(to), days - 1), "yyyy-MM-dd");
      await db.connectorConnections.update(conn.id, { status: "syncing", updatedAt: nowISO() });
      qc.invalidateQueries({ queryKey: ["connector", "github"] });
      const token = await vaultRead("github");
      const result = await githubAdapter.sync(settings, token, from, to);
      return persistSyncResult("github", result).then((counts) => ({ counts, result }));
    },
    onSuccess: ({ counts, result }) => {
      qc.invalidateQueries({ queryKey: ["connector", "github"] });
      qc.invalidateQueries({ queryKey: ["metricEvents"] });
      showSuccess(
        `Synced: +${counts.inserted} new, ${counts.updated} updated` +
          (result.latencyMs ? ` · ${result.latencyMs}ms` : "") + ".",
      );
    },
    onError: async (e: Error) => {
      if (conn) {
        await db.connectorConnections.update(conn.id, {
          status: "error",
          lastError: e.message,
          updatedAt: nowISO(),
        });
        qc.invalidateQueries({ queryKey: ["connector", "github"] });
      }
      setError(e.message);
    },
  });

  const disconnectMut = useMutation({
    mutationFn: async () => {
      await vaultClear("github");
      if (deleteHistory && conn) {
        await deleteConnectorEvents("github");
        await db.connectorConnections.delete(conn.id);
      } else if (conn) {
        await db.connectorConnections.update(conn.id, {
          status: "not_connected",
          encryptedCredential: null,
          updatedAt: nowISO(),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connector", "github"] });
      qc.invalidateQueries({ queryKey: ["metricEvents"] });
      setView("idle");
      setDeleteHistory(false);
      showSuccess("GitHub disconnected" + (deleteHistory ? " and history deleted." : "."));
    },
    onError: (e: Error) => setError(e.message),
  });

  const isConnected = conn?.status === "connected" || conn?.status === "syncing" || conn?.status === "error";
  const isBusy = oauthMut.isPending || patMut.isPending || syncMut.isPending || disconnectMut.isPending || view === "syncing";

  return (
    <ConnectorPanel
      id="github"
      name="GitHub"
      icon={<GitHubIcon />}
      description="Daily contributions · Commits · Pull requests"
      connection={conn ?? null}
    >
      {/* Error Callout */}
      {conn?.status === "error" && conn.lastError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs mb-3 flex items-start gap-2">
          <AlertTriangleIcon className="size-3.5 shrink-0 mt-0.5" />
          <span>{conn.lastError}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangleIcon className="size-3.5 shrink-0" />
            {error}
          </span>
          <button onClick={() => setError(null)} className="text-xs hover:text-foreground">✕</button>
        </div>
      )}

      {/* Success Callout */}
      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs mb-3 flex items-center gap-2">
          <CheckIcon className="size-3.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Disconnected View */}
      {!isConnected && view === "idle" && (
        <div className="flex flex-col gap-3.5 pt-1">
          <p className="text-xs text-muted-foreground">
            Authorize via GitHub OAuth Device Flow or provide a Personal Access Token to import your contribution activity.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="connector-connect-github"
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              onClick={() => (HAS_OAUTH ? oauthMut.mutate() : setView("pat-fallback"))}
              disabled={isBusy}
            >
              <KeyRoundIcon className="size-3.5" />
              <span>{isBusy ? "Connecting…" : HAS_OAUTH ? "Connect with GitHub" : "Enter Token"}</span>
            </button>
            {HAS_OAUTH && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs"
                onClick={() => setView("pat-fallback")}
              >
                Use Token instead
              </button>
            )}
          </div>
        </div>
      )}

      {/* Device Flow Waiting */}
      {view === "waiting-auth" && userCode && (
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-surface-muted/60">
          <p className="text-xs text-muted-foreground">Enter this verification code on GitHub:</p>
          <div className="p-3 rounded-lg bg-surface border border-border text-center">
            <span className="font-mono text-2xl font-bold tracking-widest text-accent">
              {userCode}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span className="animate-pulse">Waiting for authorization…</span>
            <button className="btn btn-ghost btn-sm text-xs h-7" onClick={cancelOAuth}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* PAT Fallback */}
      {view === "pat-fallback" && (
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-surface-muted/60">
          <div>
            <label htmlFor="gh-pat" className="block text-xs font-medium text-foreground mb-1">
              Personal Access Token
            </label>
            <input
              id="gh-pat"
              type="password"
              className="input font-mono text-xs"
              placeholder="ghp_… or github_pat_…"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              autoComplete="off"
            />
            <p className="text-[11px] text-subtle-foreground mt-1">
              Minimum scope: <code className="text-muted-foreground">read:user</code>. Encrypted immediately on-device.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="gh-pat-connect-btn"
              className="btn btn-primary btn-sm"
              onClick={() => patMut.mutate()}
              disabled={!pat.trim() || isBusy}
            >
              {isBusy ? "Connecting…" : "Connect"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setView("idle"); setError(null); setPat(""); }}
              disabled={isBusy}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Connected View */}
      {isConnected && view === "idle" && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            id="connector-sync-github"
            className="btn btn-ghost btn-sm flex items-center gap-1.5"
            onClick={() => syncMut.mutate()}
            disabled={isBusy}
          >
            <RefreshCwIcon className={`size-3.5 ${syncMut.isPending ? "animate-spin" : ""}`} />
            <span>{syncMut.isPending ? "Syncing…" : "Sync Now"}</span>
          </button>
          <button
            id="connector-disconnect-github"
            className="btn btn-ghost btn-sm text-xs text-muted-foreground hover:text-destructive"
            onClick={() => setView("disconnect-confirm")}
            disabled={isBusy}
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Disconnect Confirmation */}
      {view === "disconnect-confirm" && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 flex flex-col gap-3">
          <p className="text-xs text-foreground font-medium">Disconnect GitHub?</p>
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              id="gh-delete-history"
              checked={deleteHistory}
              onChange={(e) => setDeleteHistory(e.target.checked)}
              className="mt-0.5"
            />
            <span>Also remove all previously imported GitHub metrics</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              id="gh-confirm-disconnect-btn"
              className="btn btn-danger btn-sm"
              onClick={() => disconnectMut.mutate()}
              disabled={isBusy}
            >
              {isBusy ? "Disconnecting…" : "Yes, disconnect"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setView("idle")}
              disabled={isBusy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </ConnectorPanel>
  );
}

// ---------------------------------------------------------------------------
// LeetCode Panel
// ---------------------------------------------------------------------------

function LeetCodePanel() {
  const qc = useQueryClient();
  const { data: conn } = useLeetCodeConnection();

  const [username, setUsername] = useState("");
  const [syncDays, setSyncDays] = useState(30);
  const [view, setView] = useState<"idle" | "disconnect-confirm">("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deleteHistory, setDeleteHistory] = useState(false);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }, []);

  const connectMut = useMutation({
    mutationFn: async () => {
      setError(null);
      const uname = username.trim();
      if (!uname) throw new Error("Enter a LeetCode username.");

      const settings: LeetCodeSettings = { username: uname, syncDays };
      await vaultStore(
        "leetcode",
        process.env.NODE_ENV === "development" ? "mock" : uname,
        settings as unknown as Record<string, unknown>,
        `LeetCode (@${uname})`,
      );

      const to = new Date().toISOString().slice(0, 10);
      const from = format(subDays(parseISO(to), syncDays - 1), "yyyy-MM-dd");
      const token = await vaultRead("leetcode");
      const result = await leetcodeAdapter.sync(settings, token, from, to);
      await persistSyncResult("leetcode", result);

      qc.invalidateQueries({ queryKey: ["connector", "leetcode"] });
      qc.invalidateQueries({ queryKey: ["metricEvents"] });
      showSuccess(`Connected as @${uname}`);
      setUsername("");
    },
    onError: (e: Error) => setError(e.message),
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      if (!conn) throw new Error("Not connected");
      const settings = conn.settings as unknown as LeetCodeSettings;
      const days = settings.syncDays ?? 30;
      const to = new Date().toISOString().slice(0, 10);
      const from = format(subDays(parseISO(to), days - 1), "yyyy-MM-dd");

      await db.connectorConnections.update(conn.id, { status: "syncing", updatedAt: nowISO() });
      qc.invalidateQueries({ queryKey: ["connector", "leetcode"] });

      const result = await leetcodeAdapter.sync(settings, settings.username, from, to);
      const counts = await persistSyncResult("leetcode", result);
      return { counts, result };
    },
    onSuccess: ({ counts }) => {
      qc.invalidateQueries({ queryKey: ["connector", "leetcode"] });
      qc.invalidateQueries({ queryKey: ["metricEvents"] });
      showSuccess(`Synced: +${counts.inserted} new entries.`);
    },
    onError: async (e: Error) => {
      if (conn) {
        await db.connectorConnections.update(conn.id, {
          status: "error",
          lastError: e.message,
          updatedAt: nowISO(),
        });
        qc.invalidateQueries({ queryKey: ["connector", "leetcode"] });
      }
      setError(e.message);
    },
  });

  const disconnectMut = useMutation({
    mutationFn: async () => {
      await vaultClear("leetcode");
      if (deleteHistory && conn) {
        await deleteConnectorEvents("leetcode");
        await db.connectorConnections.delete(conn.id);
      } else if (conn) {
        await db.connectorConnections.update(conn.id, {
          status: "not_connected",
          encryptedCredential: null,
          updatedAt: nowISO(),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connector", "leetcode"] });
      qc.invalidateQueries({ queryKey: ["metricEvents"] });
      setView("idle");
      setDeleteHistory(false);
      showSuccess("LeetCode disconnected.");
    },
    onError: (e: Error) => setError(e.message),
  });

  const isConnected = conn?.status === "connected" || conn?.status === "syncing" || conn?.status === "error";
  const isBusy = connectMut.isPending || syncMut.isPending || disconnectMut.isPending;

  return (
    <ConnectorPanel
      id="leetcode"
      name="LeetCode"
      icon={<LeetCodeIcon />}
      description="Problems solved (Easy, Medium, Hard) · Submission heatmaps"
      connection={conn ?? null}
    >
      {/* Error Callout */}
      {conn?.status === "error" && conn.lastError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs mb-3 flex items-start gap-2">
          <AlertTriangleIcon className="size-3.5 shrink-0 mt-0.5" />
          <span>{conn.lastError}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangleIcon className="size-3.5 shrink-0" />
            {error}
          </span>
          <button onClick={() => setError(null)} className="text-xs hover:text-foreground">✕</button>
        </div>
      )}

      {/* Success Callout */}
      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs mb-3 flex items-center gap-2">
          <CheckIcon className="size-3.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Disconnected View */}
      {!isConnected && (
        <div className="flex flex-col gap-3.5 pt-1">
          <p className="text-xs text-muted-foreground">
            Enter your public LeetCode username to import your submissions and problem stats. No password required.
          </p>
          <div className="flex items-center gap-2.5 max-w-md">
            <input
              id="lc-username"
              type="text"
              placeholder="LeetCode username (e.g. mockuser)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input font-mono text-xs flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && username.trim() && !isBusy) connectMut.mutate();
              }}
            />
            <button
              id="connector-connect-leetcode"
              className="btn btn-primary btn-sm shrink-0"
              onClick={() => connectMut.mutate()}
              disabled={!username.trim() || isBusy}
            >
              {isBusy ? "Connecting…" : "Connect"}
            </button>
          </div>
        </div>
      )}

      {/* Connected View */}
      {isConnected && view === "idle" && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            id="connector-sync-leetcode"
            className="btn btn-ghost btn-sm flex items-center gap-1.5"
            onClick={() => syncMut.mutate()}
            disabled={isBusy}
          >
            <RefreshCwIcon className={`size-3.5 ${syncMut.isPending ? "animate-spin" : ""}`} />
            <span>{syncMut.isPending ? "Syncing…" : "Sync Now"}</span>
          </button>
          <button
            id="connector-disconnect-leetcode"
            className="btn btn-ghost btn-sm text-xs text-muted-foreground hover:text-destructive"
            onClick={() => setView("disconnect-confirm")}
            disabled={isBusy}
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Disconnect Confirmation */}
      {view === "disconnect-confirm" && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 flex flex-col gap-3">
          <p className="text-xs text-foreground font-medium">Disconnect LeetCode?</p>
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              id="lc-delete-history"
              checked={deleteHistory}
              onChange={(e) => setDeleteHistory(e.target.checked)}
              className="mt-0.5"
            />
            <span>Also remove all previously imported LeetCode metrics</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              id="lc-confirm-disconnect-btn"
              className="btn btn-danger btn-sm"
              onClick={() => disconnectMut.mutate()}
              disabled={isBusy}
            >
              {isBusy ? "Disconnecting…" : "Yes, disconnect"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setView("idle")}
              disabled={isBusy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </ConnectorPanel>
  );
}

// ---------------------------------------------------------------------------
// Provider Icons
// ---------------------------------------------------------------------------

function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function LeetCodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M8 21H3v-5" />
      <path d="M21 3 14 10" />
      <path d="m3 21 7-7" />
      <path d="M18 14a6 6 0 1 1-12 0" />
    </svg>
  );
}
