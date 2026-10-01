"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOrCreateProfile, updateProfile } from "@/lib/repositories";
import { encryptBackup, decryptBackup, type BackupEnvelope } from "@/lib/crypto";
import { loadDemoData } from "@/lib/demo-data";
import { nowISO } from "@/lib/date";
import { generateId } from "@/lib/uuid";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";

const backupPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string().optional(),
  tables: z.object({
    userProfile: z.array(z.record(z.string(), z.unknown())).optional().default([]),
    dailyLogs: z.array(z.record(z.string(), z.unknown())).optional().default([]),
    taskInstances: z.array(z.record(z.string(), z.unknown())).optional().default([]),
    manualMetrics: z.array(z.record(z.string(), z.unknown())).optional().default([]),
    connectorConnections: z.array(z.record(z.string(), z.unknown())).optional().default([]),
    metricEvents: z.array(z.record(z.string(), z.unknown())).optional().default([]),
    dashboardWidgets: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  }),
});

import {
  ShieldCheckIcon,
  DownloadIcon,
  UploadIcon,
  DatabaseIcon,
  Trash2Icon,
  KeyRoundIcon,
  GlobeIcon,
  ClockIcon,
  CheckIcon,
  AlertTriangleIcon,
} from "lucide-react";

const WORKDAY_CUTOFF_OPTIONS = [
  { value: "00:00", label: "12:00 AM (Midnight — Default)" },
  { value: "01:00", label: "1:00 AM" },
  { value: "02:00", label: "2:00 AM" },
  { value: "03:00", label: "3:00 AM" },
  { value: "04:00", label: "4:00 AM" },
  { value: "05:00", label: "5:00 AM" },
  { value: "06:00", label: "6:00 AM (Night Shift)" },
  { value: "07:00", label: "7:00 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "12:00", label: "12:00 PM (Noon)" },
];

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
    queryFn: () => getOrCreateProfile(),
  });

  const showStatus = (type: "success" | "error", msg: string) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 5000);
  };

  // Timezone update
  const updateTz = useMutation({
    mutationFn: (tz: string) => updateProfile({ timezone: tz }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      showStatus("success", "Timezone updated.");
    },
  });

  // Workday cutoff update
  const updateCutoff = useMutation({
    mutationFn: (cutoff: string) =>
      updateProfile({
        preferences: {
          ...(profile?.preferences ?? {
            firstDayOfWeek: 1,
            theme: "system",
            workdayCutoff: "00:00",
            customMetrics: [],
            hiddenDefaultMetrics: [],
          }),
          workdayCutoff: cutoff,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      showStatus("success", "Workday cutoff time updated.");
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
      showStatus("success", "Encrypted backup exported. Store file and passphrase safely.");
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
      let envelope: BackupEnvelope;
      try {
        envelope = JSON.parse(text) as BackupEnvelope;
      } catch {
        showStatus("error", "Failed to parse backup file: not valid JSON.");
        return;
      }

      const decrypted = await decryptBackup(envelope, importPassphrase);
      const parseResult = backupPayloadSchema.safeParse(decrypted);
      if (!parseResult.success) {
        showStatus("error", "Backup data validation failed: malformed or incompatible schema.");
        return;
      }

      const payload = parseResult.data;

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
          if (t.userProfile.length) await db.userProfile.bulkAdd(t.userProfile as unknown as Parameters<typeof db.userProfile.bulkAdd>[0]);
          if (t.dailyLogs.length) await db.dailyLogs.bulkAdd(t.dailyLogs as unknown as Parameters<typeof db.dailyLogs.bulkAdd>[0]);
          if (t.taskInstances.length) await db.taskInstances.bulkAdd(t.taskInstances as unknown as Parameters<typeof db.taskInstances.bulkAdd>[0]);
          if (t.manualMetrics.length) await db.manualMetrics.bulkAdd(t.manualMetrics as unknown as Parameters<typeof db.manualMetrics.bulkAdd>[0]);
          if (t.metricEvents.length) await db.metricEvents.bulkAdd(t.metricEvents as unknown as Parameters<typeof db.metricEvents.bulkAdd>[0]);
          if (t.dashboardWidgets.length) await db.dashboardWidgets.bulkAdd(t.dashboardWidgets as unknown as Parameters<typeof db.dashboardWidgets.bulkAdd>[0]);
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
      <PageHeader
        title="Settings"
        description="Local data vault, preferences, export, and storage controls."
      />

      {/* Floating Status Notification */}
      {status && (
        <div
          className={`p-3.5 rounded-xl border text-xs mb-6 flex items-center justify-between gap-3 fade-in max-w-2xl ${
            status.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/25 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {status.type === "success" ? (
              <CheckIcon className="size-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangleIcon className="size-4 shrink-0 text-rose-400" />
            )}
            <span>{status.msg}</span>
          </div>
          <button onClick={() => setStatus(null)} className="text-xs hover:text-foreground">✕</button>
        </div>
      )}

      <div className="flex flex-col gap-6 max-w-2xl">
        {/* Preferences */}
        <section className="flex flex-col gap-3">
          <SectionHeading
            title="Preferences"
            description="Adjust your local timezone and workday cutoff for day boundary calculations."
          />
          <div className="card p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <GlobeIcon className="size-4 text-muted-foreground" />
                <div>
                  <label htmlFor="timezone-select" className="text-sm font-medium text-foreground block">
                    Timezone
                  </label>
                  <span className="text-xs text-muted-foreground">
                    Currently: {profile?.timezone ?? "UTC"}
                  </span>
                </div>
              </div>
              <select
                id="timezone-select"
                className="input input-sm w-48 text-xs cursor-pointer"
                value={profile?.timezone ?? "UTC"}
                onChange={(e) => updateTz.mutate(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            <hr className="border-border/50" />

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <ClockIcon className="size-4 text-muted-foreground" />
                <div>
                  <label htmlFor="workday-cutoff-select" className="text-sm font-medium text-foreground block">
                    Workday Cutoff
                  </label>
                  <span className="text-xs text-muted-foreground">
                    Tasks logged before this time resolve to the previous workday. Default: 12:00 AM.
                  </span>
                </div>
              </div>
              <select
                id="workday-cutoff-select"
                className="input input-sm w-56 text-xs cursor-pointer font-mono"
                value={profile?.preferences?.workdayCutoff ?? "00:00"}
                onChange={(e) => updateCutoff.mutate(e.target.value)}
              >
                {WORKDAY_CUTOFF_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Privacy Architecture */}
        <section className="flex flex-col gap-3">
          <SectionHeading
            title="Privacy Architecture"
            description="How personal data is handled by design."
          />
          <div className="card p-4 bg-surface-muted/30 border-border/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-foreground font-medium text-xs">
              <ShieldCheckIcon className="size-4 text-muted-foreground" />
              <span>Local-only storage</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All personal metrics, logs, and connector tokens are kept solely inside your browser&apos;s local storage. No product analytics, telemetry, or remote user accounts are utilized.
            </p>
          </div>
        </section>

        {/* Readable Export */}
        <section className="flex flex-col gap-3">
          <SectionHeading
            title="Export Data"
            description="Download an unencrypted readable snapshot of your activity."
          />
          <div className="card p-4 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Export all tables in standard formats for external spreadsheets or personal data archival.
            </p>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                id="export-json-btn"
                className="btn btn-ghost btn-sm flex items-center gap-1.5 text-xs font-mono"
                onClick={exportJSON}
              >
                <DownloadIcon className="size-3.5" />
                <span>Download JSON</span>
              </button>
              <button
                id="export-csv-btn"
                className="btn btn-ghost btn-sm flex items-center gap-1.5 text-xs font-mono"
                onClick={exportCSV}
              >
                <DownloadIcon className="size-3.5" />
                <span>Download CSV</span>
              </button>
            </div>
          </div>
        </section>

        {/* Encrypted Backup */}
        <section className="flex flex-col gap-3">
          <SectionHeading
            title="Encrypted Backup"
            description="AES-GCM encrypted vault export and restore."
          />
          <div className="card p-5 flex flex-col gap-5">
            {/* Export Backup */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <KeyRoundIcon className="size-4 text-accent" />
                <h3 className="text-sm font-semibold text-foreground">Create encrypted backup</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a passphrase. The export is encrypted on-device. Losing this passphrase makes the backup irrecoverable.
              </p>
              <div className="flex items-center gap-2 max-w-md pt-1">
                <input
                  id="export-passphrase"
                  type="password"
                  placeholder="Backup passphrase"
                  value={exportPassphrase}
                  onChange={(e) => setExportPassphrase(e.target.value)}
                  className="input input-sm text-xs font-mono flex-1"
                />
                <button
                  id="export-backup-btn"
                  className="btn btn-primary btn-sm shrink-0"
                  onClick={exportEncrypted}
                >
                  Export .panal-backup
                </button>
              </div>
            </div>

            <hr className="border-border/60" />

            {/* Import Backup */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <UploadIcon className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Restore from backup</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Importing an existing backup will replace current local database tables.
              </p>
              <div className="flex flex-col gap-2.5 max-w-md pt-1">
                <input
                  id="import-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".panal-backup,application/json"
                  className="hidden"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-xs font-mono"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {importFile ? `Selected: ${importFile.name}` : "Choose backup file…"}
                  </button>
                  {importFile && (
                    <button
                      type="button"
                      className="text-xs text-subtle-foreground hover:text-foreground"
                      onClick={() => setImportFile(null)}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="import-passphrase"
                    type="password"
                    placeholder="Enter backup passphrase"
                    value={importPassphrase}
                    onChange={(e) => setImportPassphrase(e.target.value)}
                    className="input input-sm text-xs font-mono flex-1"
                  />
                  <button
                    id="import-backup-btn"
                    className="btn btn-primary btn-sm shrink-0"
                    onClick={importEncrypted}
                  >
                    Import backup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Data */}
        <section className="flex flex-col gap-3">
          <SectionHeading
            title="Sample Data"
            description="Explore the interface with 2 weeks of realistic mock metrics."
          />
          <div className="card p-4 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Loads 14 days of realistic task history, DSA problem counts, exercise logs, and connector metrics.
            </p>
            {showDemoConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  id="demo-confirm-btn"
                  className="btn btn-primary btn-sm text-xs font-medium"
                  onClick={loadDemo}
                >
                  Yes, populate demo data
                </button>
                <button
                  className="btn btn-ghost btn-sm text-xs"
                  onClick={() => setShowDemoConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                id="load-demo-btn"
                className="btn btn-ghost btn-sm self-start text-xs font-mono flex items-center gap-1.5"
                onClick={() => setShowDemoConfirm(true)}
              >
                <DatabaseIcon className="size-3.5" />
                <span>Load demo data</span>
              </button>
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="flex flex-col gap-3 pt-2">
          <SectionHeading
            title="Danger Zone"
            description="Permanent data removal."
          />
          <div className="card p-4 border-rose-500/30 bg-rose-500/5 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Permanently wipe all local database tables on this device. This action cannot be reversed.
            </p>
            {showDeleteConfirm ? (
              <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30">
                <p className="text-xs font-semibold text-rose-400">
                  Are you absolutely certain? All history will be deleted.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    id="delete-confirm-btn"
                    className="btn btn-danger btn-sm text-xs"
                    onClick={deleteAll}
                  >
                    Yes, delete everything
                  </button>
                  <button
                    className="btn btn-ghost btn-sm text-xs"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                id="delete-all-btn"
                className="btn btn-danger btn-sm self-start text-xs flex items-center gap-1.5"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2Icon className="size-3.5" />
                <span>Delete all local data</span>
              </button>
            )}
          </div>
        </section>
      </div>
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
