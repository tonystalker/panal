"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { getOrCreateProfile, updateProfile } from "@/lib/repositories";
import { encryptBackup, decryptBackup, type BackupEnvelope } from "@/lib/crypto";
import { loadDemoData } from "@/lib/demo-data";
import { nowISO } from "@/lib/date";
import { generateId } from "@/lib/uuid";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
].sort();

export default function SettingsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDemoConfirm, setShowDemoConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getOrCreateProfile,
  });

  const showStatus = (type: "success" | "error", msg: string) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 4000);
  };

  // Timezone update
  const updateTz = useMutation({
    mutationFn: (tz: string) => updateProfile({ timezone: tz }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      showStatus("success", "Timezone updated.");
    },
  });

  // Export readable JSON
  const exportJSON = async () => {
    try {
      const [dailyLogs, taskInstances, manualMetrics, metricEvents, dashboardWidgets, userProfile] =
        await Promise.all([
          db.dailyLogs.toArray(),
          db.taskInstances.toArray(),
          db.manualMetrics.toArray(),
          db.metricEvents.toArray(),
          db.dashboardWidgets.toArray(),
          db.userProfile.toArray(),
        ]);
      const data = {
        exportedAt: nowISO(),
        schemaVersion: 1,
        tables: {
          userProfile,
          dailyLogs,
          taskInstances,
          manualMetrics,
          connectorConnections: [],
          metricEvents,
          dashboardWidgets,
        },
      };
      downloadFile(JSON.stringify(data, null, 2), "panal-export.json", "application/json");
      showStatus("success", "JSON export downloaded.");
    } catch (e) {
      showStatus("error", `Export failed: ${(e as Error).message}`);
    }
  };

  // Export CSV (tasks only)
  const exportCSV = async () => {
    try {
      const tasks = await db.taskInstances.toArray();
      const logs = await db.dailyLogs.toArray();
      const logMap = Object.fromEntries(logs.map((l) => [l.id, l.date]));
      const rows = [
        ["date", "title", "status", "targetValue", "completedValue", "unit"].join(","),
        ...tasks.map((t) =>
          [logMap[t.dailyLogId] ?? "", `"${t.title}"`, t.status, t.targetValue ?? "", t.completedValue, t.unit ?? ""].join(","),
        ),
      ];
      downloadFile(rows.join("\n"), "panal-tasks.csv", "text/csv");
      showStatus("success", "CSV export downloaded.");
    } catch (e) {
      showStatus("error", `CSV export failed: ${(e as Error).message}`);
    }
  };

  // Encrypted backup export
  const exportEncrypted = async () => {
    if (!exportPassphrase) {
      showStatus("error", "Enter a passphrase before exporting.");
      return;
    }
    try {
      const [dailyLogs, taskInstances, manualMetrics, metricEvents, dashboardWidgets, userProfile] =
        await Promise.all([
          db.dailyLogs.toArray(),
          db.taskInstances.toArray(),
          db.manualMetrics.toArray(),
          db.metricEvents.toArray(),
          db.dashboardWidgets.toArray(),
          db.userProfile.toArray(),
        ]);
      const payload = {
        schemaVersion: 1,
        exportedAt: nowISO(),
        tables: {
          userProfile,
          dailyLogs,
          taskInstances,
          manualMetrics,
          connectorConnections: [],
          metricEvents,
          dashboardWidgets,
        },
      };
      const deviceId = profile?.id ?? generateId();
      const envelope = await encryptBackup(payload, exportPassphrase, deviceId);
      downloadFile(JSON.stringify(envelope, null, 2), "panal.panal-backup", "application/json");
      setExportPassphrase("");
      showStatus("success", "Encrypted backup exported. Keep this file and passphrase safe.");
    } catch (e) {
      showStatus("error", `Backup failed: ${(e as Error).message}`);
    }
  };

  // Import encrypted backup
  const importEncrypted = async () => {
    if (!importFile) {
      showStatus("error", "Choose a .panal-backup file first.");
      return;
    }
    if (!importPassphrase) {
      showStatus("error", "Enter the backup passphrase.");
      return;
    }
    try {
      const text = await importFile.text();
      const envelope = JSON.parse(text) as BackupEnvelope;
      const payload = (await decryptBackup(envelope, importPassphrase)) as {
        tables: {
          userProfile: Parameters<typeof db.userProfile.bulkAdd>[0];
          dailyLogs: Parameters<typeof db.dailyLogs.bulkAdd>[0];
          taskInstances: Parameters<typeof db.taskInstances.bulkAdd>[0];
          manualMetrics: Parameters<typeof db.manualMetrics.bulkAdd>[0];
          metricEvents: Parameters<typeof db.metricEvents.bulkAdd>[0];
          dashboardWidgets: Parameters<typeof db.dashboardWidgets.bulkAdd>[0];
        };
      };

      if (!confirm(`This will replace all local data with the backup from ${envelope.exportedAt}. Continue?`)) return;

      await db.transaction(
        "rw",
        [db.userProfile, db.dailyLogs, db.taskInstances, db.manualMetrics, db.connectorConnections, db.metricEvents, db.dashboardWidgets],
        async () => {
          await db.userProfile.clear();
          await db.dailyLogs.clear();
          await db.taskInstances.clear();
          await db.manualMetrics.clear();
          await db.connectorConnections.clear();
          await db.metricEvents.clear();
          await db.dashboardWidgets.clear();
          const t = payload.tables;
          if (t.userProfile?.length) await db.userProfile.bulkAdd(t.userProfile);
          if (t.dailyLogs?.length) await db.dailyLogs.bulkAdd(t.dailyLogs);
          if (t.taskInstances?.length) await db.taskInstances.bulkAdd(t.taskInstances);
          if (t.manualMetrics?.length) await db.manualMetrics.bulkAdd(t.manualMetrics);
          if (t.metricEvents?.length) await db.metricEvents.bulkAdd(t.metricEvents);
          if (t.dashboardWidgets?.length) await db.dashboardWidgets.bulkAdd(t.dashboardWidgets);
        },
      );

      qc.invalidateQueries();
      setImportFile(null);
      setImportPassphrase("");
      showStatus("success", "Backup imported successfully.");
    } catch (e) {
      showStatus("error", (e as Error).message);
    }
  };

  // Delete all data
  const deleteAll = async () => {
    await db.transaction(
      "rw",
      [db.userProfile, db.dailyLogs, db.taskInstances, db.manualMetrics, db.connectorConnections, db.metricEvents, db.dashboardWidgets],
      async () => {
        await db.userProfile.clear();
        await db.dailyLogs.clear();
        await db.taskInstances.clear();
        await db.manualMetrics.clear();
        await db.connectorConnections.clear();
        await db.metricEvents.clear();
        await db.dashboardWidgets.clear();
      },
    );
    qc.invalidateQueries();
    setShowDeleteConfirm(false);
    showStatus("success", "All local data deleted.");
  };

  // Load demo data
  const loadDemo = async () => {
    const tz = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    await loadDemoData(tz);
    qc.invalidateQueries();
    setShowDemoConfirm(false);
    showStatus("success", "Demo data loaded. Check Today and Dashboard.");
  };

  return (
    <div className="page fade-in">
      <header style={{ marginBottom: "1.5rem" }}>
        <h1>Settings</h1>
      </header>

      {/* Status toast */}
      {status && (
        <div
          className="fade-in"
          style={{
            background: status.type === "success" ? "#166534" : "#7f1d1d",
            color: status.type === "success" ? "#86efac" : "#fca5a5",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-sm)",
            marginBottom: "1rem",
            fontSize: "0.875rem",
          }}
        >
          {status.msg}
        </div>
      )}

      {/* Preferences */}
      <section>
        <h2 style={{ marginBottom: "0.75rem" }}>Preferences</h2>
        <div className="card">
          <label htmlFor="timezone-select" style={{ fontSize: "0.875rem", color: "var(--text-2)", display: "block", marginBottom: "0.375rem" }}>
            Timezone
          </label>
          <select
            id="timezone-select"
            className="input"
            value={profile?.timezone ?? "UTC"}
            onChange={(e) => updateTz.mutate(e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Privacy */}
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Privacy</h2>
        <div className="card" style={{ background: "var(--bg-3)" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--text-2)", lineHeight: 1.7 }}>
            🔒 <strong>Local-first.</strong> All your data lives only on this device in IndexedDB.
            No account. No server receives your personal data. Network is only used to load the app.
          </p>
          <p style={{ fontSize: "0.875rem", color: "var(--text-3)", marginTop: "0.5rem", lineHeight: 1.7 }}>
            Connector credentials are stored in an encrypted local vault. They are never sent to external servers except the respective provider (GitHub, LeetCode) during sync.
          </p>
        </div>
      </section>

      {/* Export */}
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Export</h2>
        <div className="card">
          <p style={{ fontSize: "0.875rem", color: "var(--text-3)", marginBottom: "0.875rem" }}>
            Download a readable copy of your data. Not encrypted — store securely.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button id="export-json-btn" className="btn btn-ghost btn-sm" onClick={exportJSON}>
              Download JSON
            </button>
            <button id="export-csv-btn" className="btn btn-ghost btn-sm" onClick={exportCSV}>
              Download CSV
            </button>
          </div>
        </div>
      </section>

      {/* Encrypted backup */}
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Encrypted Backup</h2>

        {/* Export */}
        <div className="card" style={{ marginBottom: "0.75rem" }}>
          <h3 style={{ marginBottom: "0.5rem", fontSize: "0.9375rem" }}>Export backup</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", marginBottom: "0.75rem" }}>
            AES-GCM encrypted with your passphrase. Keep the file <em>and</em> the passphrase — losing both makes the backup unrecoverable.
          </p>
          <input
            id="export-passphrase"
            className="input input-sm"
            type="password"
            placeholder="Backup passphrase"
            value={exportPassphrase}
            onChange={(e) => setExportPassphrase(e.target.value)}
            style={{ marginBottom: "0.5rem" }}
          />
          <button id="export-backup-btn" className="btn btn-primary btn-sm" onClick={exportEncrypted}>
            Export .panal-backup
          </button>
        </div>

        {/* Import */}
        <div className="card">
          <h3 style={{ marginBottom: "0.5rem", fontSize: "0.9375rem" }}>Import backup</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", marginBottom: "0.75rem" }}>
            Importing will <strong style={{ color: "var(--warning)" }}>replace all local data</strong>. A confirmation prompt will appear.
          </p>
          <input
            id="import-file-input"
            ref={fileInputRef}
            type="file"
            accept=".panal-backup,application/json"
            style={{ display: "none" }}
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
          />
          <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} style={{ marginBottom: "0.5rem" }}>
            {importFile ? `📄 ${importFile.name}` : "Choose file…"}
          </button>
          <input
            id="import-passphrase"
            className="input input-sm"
            type="password"
            placeholder="Backup passphrase"
            value={importPassphrase}
            onChange={(e) => setImportPassphrase(e.target.value)}
            style={{ marginBottom: "0.5rem", marginTop: "0.5rem" }}
          />
          <button id="import-backup-btn" className="btn btn-primary btn-sm" onClick={importEncrypted}>
            Import backup
          </button>
        </div>
      </section>

      {/* Demo data */}
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Demo Data</h2>
        <div className="card">
          <p style={{ fontSize: "0.875rem", color: "var(--text-3)", marginBottom: "0.75rem" }}>
            Load 2 weeks of realistic sample data to explore the app. This will clear existing data.
          </p>
          {showDemoConfirm ? (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button id="demo-confirm-btn" className="btn btn-primary btn-sm" onClick={loadDemo}>
                Yes, load demo data
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDemoConfirm(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button id="load-demo-btn" className="btn btn-ghost btn-sm" onClick={() => setShowDemoConfirm(true)}>
              Load demo data
            </button>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section style={{ marginTop: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "0.75rem", color: "var(--danger)" }}>Danger Zone</h2>
        <div className="card" style={{ border: "1px solid #7f1d1d" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--text-3)", marginBottom: "0.875rem" }}>
            Permanently delete all local data. This cannot be undone.
          </p>
          {showDeleteConfirm ? (
            <div>
              <p style={{ fontSize: "0.875rem", color: "var(--danger)", marginBottom: "0.5rem", fontWeight: 600 }}>
                Are you absolutely sure? All data will be gone forever.
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button id="delete-confirm-btn" className="btn btn-danger btn-sm" onClick={deleteAll}>
                  Yes, delete everything
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button id="delete-all-btn" className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}>
              Delete all local data
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
