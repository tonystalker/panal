"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { nowISO } from "@/lib/date";
import { generateId } from "@/lib/uuid";
import { vaultStore, vaultRead, vaultClear } from "@/lib/connectors/vault";
import { githubAdapter } from "@/lib/connectors/github";
import { requestDeviceCode, pollForToken } from "@/lib/connectors/github-oauth";
import { persistSyncResult, deleteConnectorEvents } from "@/lib/connectors/sync";
import { format, parseISO, subDays } from "date-fns";
import type { ConnectorConnection } from "@/lib/db";
import type { GitHubSettings } from "@/lib/connectors/types";

const HAS_OAUTH = !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

// ---------------------------------------------------------------------------
// Data hook
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConnectorsPage() {
  return (
    <div className="page fade-in">
      <header style={{ marginBottom: "1.5rem" }}>
        <h1>Connectors</h1>
        <p style={{ color: "var(--text-3)", fontSize: "0.875rem", marginTop: "0.375rem" }}>
          Connect services to import metrics automatically. All data is fetched on your device.
        </p>
      </header>

      <GitHubPanel />

      {/* LeetCode — Milestone 3 */}
      <div className="card" style={{ marginBottom: "0.75rem", opacity: 0.5 }}>
        <div style={{ display: "flex", gap: "0.875rem", alignItems: "center" }}>
          <LeetCodeIcon />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <h2 style={{ fontWeight: 600, fontSize: "1rem" }}>LeetCode</h2>
              <span className="badge badge-muted">Milestone 3</span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
              Accepted problems · Easy / Medium / Hard
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem", padding: "1rem", background: "var(--bg-3)" }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", lineHeight: 1.6 }}>
          🔒 <strong style={{ color: "var(--text-2)" }}>Privacy:</strong> Your OAuth token is
          encrypted on-device using AES-GCM before being stored. It is sent only to GitHub's
          API — never to any other server.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GitHub panel
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

  // ── After we have a token (from either OAuth or PAT) ─────────────────────

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
        const counts = await persistSyncResult("github", result);

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

  // ── OAuth Device Flow ─────────────────────────────────────────────────────

  const oauthMut = useMutation({
    mutationFn: async () => {
      setError(null);
      const challenge = await requestDeviceCode(includePrivate);
      setUserCode(challenge.userCode);
      setVerificationUri(challenge.verificationUri);
      setExpiresAt(challenge.expiresAt);
      setView("waiting-auth");

      // Open GitHub authorization page automatically
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

  // ── PAT fallback ──────────────────────────────────────────────────────────

  const patMut = useMutation({
    mutationFn: async () => {
      if (!pat.trim()) throw new Error("Enter a personal access token.");
      return pat.trim();
    },
    onSuccess: (token) => finaliseConnection(token),
    onError: (e: Error) => setError(e.message),
  });

  // ── Re-sync ───────────────────────────────────────────────────────────────

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

  // ── Disconnect ────────────────────────────────────────────────────────────

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
    <div className="card" style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
        <div style={{ color: "var(--text-2)", flexShrink: 0, marginTop: "2px" }}>
          <GitHubIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title + badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
            <h2 style={{ fontWeight: 600, fontSize: "1rem" }}>GitHub</h2>
            <StatusBadge conn={conn} />
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", marginBottom: "0.875rem" }}>
            Daily contributions · Commits · Pull requests
          </p>

          {/* Last sync */}
          {conn?.lastSyncedAt && (
            <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginBottom: "0.625rem" }}>
              Last sync: {format(parseISO(conn.lastSyncedAt), "MMM d, yyyy 'at' HH:mm")}
              {conn.displayName && <> · <strong style={{ color: "var(--text-2)" }}>{conn.displayName}</strong></>}
            </p>
          )}

          {/* Error from GitHub */}
          {conn?.status === "error" && conn.lastError && (
            <div style={alertStyle("danger")}>⚠ {conn.lastError}</div>
          )}

          {/* Mutation error */}
          {error && (
            <div style={alertStyle("danger")}>
              ⚠ {error}
              <button onClick={() => setError(null)} style={dismissBtn}>✕</button>
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div style={alertStyle("success")}>✓ {successMsg}</div>
          )}

          {/* ── Not connected: primary OAuth flow ── */}
          {!isConnected && view === "idle" && (
            <ConnectView
              hasOAuth={HAS_OAUTH}
              includePrivate={includePrivate}
              onIncludePrivateChange={setIncludePrivate}
              syncDays={syncDays}
              onSyncDaysChange={setSyncDays}
              onOAuth={() => oauthMut.mutate()}
              onUsePat={() => setView("pat-fallback")}
              busy={isBusy}
            />
          )}

          {/* ── Waiting for GitHub authorization ── */}
          {view === "waiting-auth" && userCode && (
            <DeviceFlowWaiting
              userCode={userCode}
              verificationUri={verificationUri}
              expiresAt={expiresAt}
              onCancel={cancelOAuth}
            />
          )}

          {/* ── Syncing after auth ── */}
          {view === "syncing" && (
            <p style={{ fontSize: "0.875rem", color: "var(--text-3)" }}>
              Authorized ✓ — syncing your GitHub activity…
            </p>
          )}

          {/* ── PAT fallback ── */}
          {view === "pat-fallback" && (
            <PatFallback
              pat={pat}
              onPatChange={setPat}
              onSubmit={() => patMut.mutate()}
              onCancel={() => { setView("idle"); setError(null); setPat(""); }}
              busy={isBusy}
            />
          )}

          {/* ── Connected: sync / disconnect ── */}
          {isConnected && view === "idle" && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                id="connector-sync-github"
                className="btn btn-ghost btn-sm"
                onClick={() => syncMut.mutate()}
                disabled={isBusy || conn.status === "syncing"}
              >
                {conn.status === "syncing" ? "Syncing…" : "Sync now"}
              </button>
              <button
                id="connector-disconnect-github"
                className="btn btn-ghost btn-sm"
                style={{ color: "var(--danger)" }}
                onClick={() => { setView("disconnect-confirm"); setError(null); }}
                disabled={isBusy}
              >
                Disconnect
              </button>
            </div>
          )}

          {/* ── Disconnect confirm ── */}
          {view === "disconnect-confirm" && (
            <DisconnectPanel
              deleteHistory={deleteHistory}
              onDeleteHistoryChange={setDeleteHistory}
              onConfirm={() => disconnectMut.mutate()}
              onCancel={() => setView("idle")}
              busy={isBusy}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectView({
  hasOAuth, includePrivate, onIncludePrivateChange, syncDays, onSyncDaysChange,
  onOAuth, onUsePat, busy,
}: {
  hasOAuth: boolean;
  includePrivate: boolean; onIncludePrivateChange: (v: boolean) => void;
  syncDays: number; onSyncDaysChange: (v: number) => void;
  onOAuth: () => void; onUsePat: () => void; busy: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {/* Options */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.8125rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            id="gh-include-private"
            checked={includePrivate}
            onChange={(e) => onIncludePrivateChange(e.target.checked)}
          />
          Include private repository activity
        </label>

        <div>
          <label htmlFor="gh-sync-days" style={{ fontSize: "0.8125rem", fontWeight: 500, display: "block", marginBottom: "0.375rem" }}>
            Sync range
          </label>
          <select
            id="gh-sync-days"
            className="input"
            value={syncDays}
            onChange={(e) => onSyncDaysChange(Number(e.target.value))}
            style={{ width: "100%" }}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Primary: OAuth */}
      {hasOAuth ? (
        <div>
          <button
            id="connector-connect-github"
            className="btn btn-primary btn-sm"
            onClick={onOAuth}
            disabled={busy}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <GitHubIconSmall />
            {busy ? "Opening GitHub…" : "Connect with GitHub"}
          </button>
          <button
            onClick={onUsePat}
            style={{ marginTop: "0.5rem", background: "none", border: "none", color: "var(--text-3)", fontSize: "0.75rem", cursor: "pointer", padding: 0 }}
          >
            Use a personal access token instead →
          </button>
        </div>
      ) : (
        /* No client ID configured — show PAT inline */
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ background: "var(--bg-3)", borderRadius: "var(--radius-sm)", padding: "0.625rem 0.75rem", fontSize: "0.75rem", color: "var(--text-3)" }}>
            Set <code>NEXT_PUBLIC_GITHUB_CLIENT_ID</code> in <code>.env.local</code> to enable one-click GitHub sign-in.
          </div>
          <button
            id="connector-connect-github"
            className="btn btn-primary btn-sm"
            onClick={onUsePat}
            disabled={busy}
          >
            Connect with a personal access token
          </button>
        </div>
      )}
    </div>
  );
}

function DeviceFlowWaiting({
  userCode, verificationUri, expiresAt, onCancel,
}: {
  userCode: string; verificationUri: string; expiresAt: number; onCancel: () => void;
}) {
  const minutesLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / 60_000));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {/* Code box */}
      <div style={{ background: "var(--bg-3)", borderRadius: "var(--radius)", padding: "1.25rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginBottom: "0.5rem" }}>
          Enter this code on GitHub to authorize:
        </p>
        <p style={{
          fontFamily: "monospace",
          fontSize: "2rem",
          fontWeight: 700,
          letterSpacing: "0.2em",
          color: "var(--accent)",
        }}>
          {userCode}
        </p>
        <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.375rem" }}>
          Expires in ~{minutesLeft} min
        </p>
      </div>

      {/* Step-by-step */}
      <ol style={{ paddingLeft: "1.125rem", fontSize: "0.8125rem", color: "var(--text-2)", lineHeight: 1.8, margin: 0 }}>
        <li>A GitHub tab opened automatically — if not, go to <a href={verificationUri} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>github.com/login/device</a></li>
        <li>Enter the code above and click <strong>Continue</strong></li>
        <li>Authorize <strong>panal</strong> and return here</li>
      </ol>

      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
          <PulsingDot /> Waiting for authorization…
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ marginLeft: "auto" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function PatFallback({
  pat, onPatChange, onSubmit, onCancel, busy,
}: {
  pat: string; onPatChange: (v: string) => void;
  onSubmit: () => void; onCancel: () => void; busy: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <label htmlFor="gh-pat" style={{ fontSize: "0.8125rem", fontWeight: 500, display: "block", marginBottom: "0.375rem" }}>
          Personal Access Token
          <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener noreferrer" style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "var(--accent)" }}>
            Create one ↗
          </a>
        </label>
        <input
          id="gh-pat"
          type="password"
          className="input"
          placeholder="github_pat_…"
          value={pat}
          onChange={(e) => onPatChange(e.target.value)}
          style={{ width: "100%", fontFamily: "monospace" }}
          autoComplete="off"
        />
        <p style={{ fontSize: "0.6875rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
          Minimum scope: <code>read:user</code>. Encrypted on-device immediately.
        </p>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          id="gh-pat-connect-btn"
          className="btn btn-primary btn-sm"
          onClick={onSubmit}
          disabled={!pat.trim() || busy}
        >
          {busy ? "Connecting…" : "Connect"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>
          Back
        </button>
      </div>
    </div>
  );
}

function DisconnectPanel({
  deleteHistory, onDeleteHistoryChange, onConfirm, onCancel, busy,
}: {
  deleteHistory: boolean; onDeleteHistoryChange: (v: boolean) => void;
  onConfirm: () => void; onCancel: () => void; busy: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ background: "#ef444415", border: "1px solid #ef444440", borderRadius: "var(--radius-sm)", padding: "0.875rem" }}>
        <p style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.375rem", color: "var(--danger)" }}>
          Disconnect GitHub?
        </p>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>
          Your token will be wiped immediately from the local vault.
        </p>
      </div>
      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", fontSize: "0.8125rem", cursor: "pointer" }}>
        <input
          type="checkbox"
          id="gh-delete-history"
          checked={deleteHistory}
          onChange={(e) => onDeleteHistoryChange(e.target.checked)}
          style={{ marginTop: "2px" }}
        />
        <span>
          Also delete all imported GitHub metric history
          <br />
          <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
            Leave unchecked to keep past data in your charts after disconnecting.
          </span>
        </span>
      </label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          id="gh-confirm-disconnect-btn"
          className="btn btn-ghost btn-sm"
          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Disconnecting…" : "Disconnect"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ conn }: { conn: ConnectorConnection | undefined }) {
  if (!conn || conn.status === "not_connected")
    return <span className="badge badge-muted">Not connected</span>;
  if (conn.status === "connected")
    return <span className="badge badge-success">Connected</span>;
  if (conn.status === "syncing")
    return <span className="badge badge-accent">Syncing…</span>;
  return <span className="badge badge-danger">Error — action needed</span>;
}

function PulsingDot() {
  return (
    <span style={{
      display: "inline-block",
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: "var(--accent)",
      marginRight: "0.375rem",
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function alertStyle(type: "danger" | "success"): React.CSSProperties {
  return {
    background: type === "danger" ? "#ef444420" : "#22c55e20",
    border: `1px solid ${type === "danger" ? "var(--danger)" : "var(--success)"}`,
    borderRadius: "var(--radius-sm)",
    padding: "0.625rem 0.75rem",
    marginBottom: "0.75rem",
    fontSize: "0.8125rem",
    color: type === "danger" ? "var(--danger)" : "var(--success)",
  };
}

const dismissBtn: React.CSSProperties = {
  marginLeft: "0.5rem",
  background: "none",
  border: "none",
  color: "var(--danger)",
  cursor: "pointer",
  fontSize: "0.75rem",
};

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function GitHubIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

function GitHubIconSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

function LeetCodeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" />
    </svg>
  );
}
