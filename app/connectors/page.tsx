"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { nowISO } from "@/lib/date";
import { generateId } from "@/lib/uuid";
import { vaultStore, vaultRead, vaultClear } from "@/lib/connectors/vault";
import { githubAdapter } from "@/lib/connectors/github";
import { persistSyncResult, deleteConnectorEvents } from "@/lib/connectors/sync";
import { format, parseISO, subDays } from "date-fns";
import type { ConnectorConnection } from "@/lib/db";
import type { GitHubSettings } from "@/lib/connectors/types";

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useGitHubConnection() {
  return useQuery({
    queryKey: ["connector", "github"],
    queryFn: () =>
      db.connectorConnections.where("connectorId").equals("github").first(),
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
          🔒 <strong style={{ color: "var(--text-2)" }}>Privacy:</strong> Credentials are encrypted
          on your device using AES-GCM before being stored. They are never sent to any server other
          than the provider itself. Disconnect to wipe credentials at any time.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GitHub panel — full connect / sync / disconnect flow
// ---------------------------------------------------------------------------

type PanelView = "idle" | "connect-form" | "preview" | "disconnect-confirm";

function GitHubPanel() {
  const qc = useQueryClient();
  const { data: conn } = useGitHubConnection();
  const [view, setView] = useState<PanelView>("idle");
  const [pat, setPat] = useState("");
  const [includePrivate, setIncludePrivate] = useState(false);
  const [syncDays, setSyncDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ events: number; from: string; to: string; latencyMs: number } | null>(null);
  const [deleteHistory, setDeleteHistory] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }, []);

  // ── Validate token + preview data ─────────────────────────────────────────

  const previewMut = useMutation({
    mutationFn: async () => {
      setError(null);
      // Validate token
      const username = await githubAdapter.validateToken(pat).catch((e) => {
        throw new Error(`Token validation failed: ${(e as Error).message}`);
      });

      // Fetch a preview (7 days) to show before committing
      const to = new Date().toISOString().slice(0, 10);
      const from = format(subDays(parseISO(to), 6), "yyyy-MM-dd");
      const result = await githubAdapter.sync({ username, includePrivate, syncDays }, pat, from, to);

      return { username, result };
    },
    onSuccess: ({ username, result }) => {
      setPreview({
        events: result.events.length,
        from: result.fromDate,
        to: result.toDate,
        latencyMs: result.latencyMs,
      });
      // Store username in a temp var for the confirm step
      sessionStorage.setItem("gh-preview-username", username);
      setView("preview");
    },
    onError: (e: Error) => setError(e.message),
  });

  // ── Confirm connection + persist full sync ─────────────────────────────────

  const connectMut = useMutation({
    mutationFn: async () => {
      const username = sessionStorage.getItem("gh-preview-username") ?? "";
      const settings: GitHubSettings = { username, includePrivate, syncDays };

      // Persist encrypted credential
      await vaultStore("github", pat, settings as unknown as Record<string, unknown>, `GitHub (${username})`);

      // Full sync for configured range
      const to = new Date().toISOString().slice(0, 10);
      const from = format(subDays(parseISO(to), syncDays - 1), "yyyy-MM-dd");
      const token = await vaultRead("github");
      const result = await githubAdapter.sync(settings, token, from, to);
      await persistSyncResult("github", result);

      sessionStorage.removeItem("gh-preview-username");
      return result;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["connector", "github"] });
      qc.invalidateQueries({ queryKey: ["metricEvents"] });
      setPat("");
      setView("idle");
      showSuccess(
        `Connected. Synced ${result.events.length / 4} days` +
          (result.latencyMs ? ` (${result.latencyMs}ms)` : "") + ".",
      );
    },
    onError: (e: Error) => setError(e.message),
  });

  // ── Re-sync ────────────────────────────────────────────────────────────────

  const syncMut = useMutation({
    mutationFn: async () => {
      if (!conn) throw new Error("Not connected");
      const settings = conn.settings as unknown as GitHubSettings;
      const days = settings.syncDays ?? 30;
      const to = new Date().toISOString().slice(0, 10);
      const from = format(subDays(parseISO(to), days - 1), "yyyy-MM-dd");

      // Mark as syncing
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
        `Synced: +${counts.inserted} new, ${counts.updated} updated, ${counts.skipped} unchanged` +
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

  // ── Disconnect ─────────────────────────────────────────────────────────────

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
  const isBusy = previewMut.isPending || connectMut.isPending || syncMut.isPending || disconnectMut.isPending;

  return (
    <div className="card" style={{ marginBottom: "0.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
        <div style={{ color: "var(--text-2)", flexShrink: 0, marginTop: "2px" }}>
          <GitHubIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
            <h2 style={{ fontWeight: 600, fontSize: "1rem" }}>GitHub</h2>
            <StatusBadge conn={conn} />
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", marginBottom: "0.875rem" }}>
            Daily contributions · Commits · Pull requests
          </p>

          {/* Last sync info */}
          {conn?.lastSyncedAt && (
            <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginBottom: "0.625rem" }}>
              Last sync: {format(parseISO(conn.lastSyncedAt), "MMM d, yyyy 'at' HH:mm")}
              {conn.displayName && ` · ${conn.displayName}`}
            </p>
          )}

          {/* Error state */}
          {conn?.status === "error" && conn.lastError && (
            <div style={{ background: "#ef444420", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", padding: "0.625rem 0.75rem", marginBottom: "0.75rem", fontSize: "0.8125rem", color: "var(--danger)" }}>
              ⚠ {conn.lastError}
            </div>
          )}

          {/* Success message */}
          {successMsg && (
            <div style={{ background: "#22c55e20", border: "1px solid var(--success)", borderRadius: "var(--radius-sm)", padding: "0.625rem 0.75rem", marginBottom: "0.75rem", fontSize: "0.8125rem", color: "var(--success)" }}>
              ✓ {successMsg}
            </div>
          )}

          {/* Error from mutation */}
          {error && (
            <div style={{ background: "#ef444420", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", padding: "0.625rem 0.75rem", marginBottom: "0.75rem", fontSize: "0.8125rem", color: "var(--danger)" }}>
              ⚠ {error}
              <button onClick={() => setError(null)} style={{ marginLeft: "0.5rem", background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.75rem" }}>✕</button>
            </div>
          )}

          {/* ── Connect form ── */}
          {!isConnected && view !== "preview" && (
            <>
              {view === "idle" && (
                <button
                  id="connector-connect-github"
                  className="btn btn-primary btn-sm"
                  onClick={() => { setView("connect-form"); setError(null); }}
                >
                  Connect
                </button>
              )}

              {view === "connect-form" && (
                <ConnectForm
                  pat={pat}
                  onPatChange={setPat}
                  includePrivate={includePrivate}
                  onIncludePrivateChange={setIncludePrivate}
                  syncDays={syncDays}
                  onSyncDaysChange={setSyncDays}
                  onSubmit={() => previewMut.mutate()}
                  onCancel={() => { setView("idle"); setError(null); setPat(""); }}
                  busy={isBusy}
                />
              )}
            </>
          )}

          {/* ── Preview step ── */}
          {view === "preview" && preview && (
            <PreviewPanel
              preview={preview}
              onConfirm={() => connectMut.mutate()}
              onBack={() => setView("connect-form")}
              busy={isBusy}
            />
          )}

          {/* ── Connected actions ── */}
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

function StatusBadge({ conn }: { conn: ConnectorConnection | undefined }) {
  if (!conn || conn.status === "not_connected")
    return <span className="badge badge-muted">Not connected</span>;
  if (conn.status === "connected")
    return <span className="badge badge-success">Connected</span>;
  if (conn.status === "syncing")
    return <span className="badge badge-accent">Syncing…</span>;
  return <span className="badge badge-danger">Error — action needed</span>;
}

function ConnectForm({
  pat, onPatChange, includePrivate, onIncludePrivateChange,
  syncDays, onSyncDaysChange, onSubmit, onCancel, busy,
}: {
  pat: string; onPatChange: (v: string) => void;
  includePrivate: boolean; onIncludePrivateChange: (v: boolean) => void;
  syncDays: number; onSyncDaysChange: (v: number) => void;
  onSubmit: () => void; onCancel: () => void; busy: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <div>
        <label htmlFor="gh-pat" style={{ fontSize: "0.8125rem", fontWeight: 500, display: "block", marginBottom: "0.375rem" }}>
          Personal Access Token
          <a
            href="https://github.com/settings/tokens?type=beta"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "var(--accent)" }}
          >
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
          Fine-grained PAT. Minimum scope: read-only access to your contributions. Encrypted locally — never sent to any server.
        </p>
      </div>

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

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          id="gh-preview-btn"
          className="btn btn-primary btn-sm"
          onClick={onSubmit}
          disabled={!pat.trim() || busy}
        >
          {busy ? "Validating…" : "Validate & preview"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function PreviewPanel({
  preview, onConfirm, onBack, busy,
}: {
  preview: { events: number; from: string; to: string; latencyMs: number };
  onConfirm: () => void; onBack: () => void; busy: boolean;
}) {
  const days = preview.events / 4;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ background: "var(--bg-3)", borderRadius: "var(--radius-sm)", padding: "0.875rem" }}>
        <p style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.375rem" }}>Preview (7 days)</p>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>
          {days} days of activity from {format(parseISO(preview.from), "MMM d")} → {format(parseISO(preview.to), "MMM d")}
        </p>
        {preview.latencyMs > 0 && (
          <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
            GitHub latency: {preview.latencyMs}ms — data is not real-time
          </p>
        )}
      </div>
      <p style={{ fontSize: "0.8125rem", color: "var(--text-3)" }}>
        Confirm to connect and sync the full selected range.
      </p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          id="gh-confirm-connect-btn"
          className="btn btn-primary btn-sm"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Connecting…" : "Connect & sync"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onBack} disabled={busy}>
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
          Your encrypted token will be wiped immediately.
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

function LeetCodeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" />
    </svg>
  );
}
