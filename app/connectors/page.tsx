"use client";

export default function ConnectorsPage() {
  return (
    <div className="page fade-in">
      <header style={{ marginBottom: "1.5rem" }}>
        <h1>Connectors</h1>
        <p style={{ color: "var(--text-3)", fontSize: "0.875rem", marginTop: "0.375rem" }}>
          Connect services to import metrics automatically.
        </p>
      </header>

      <ConnectorCard
        id="github"
        name="GitHub"
        description="Daily contributions · Commits · Pull requests"
        status="not_connected"
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
          </svg>
        }
      />

      <ConnectorCard
        id="leetcode"
        name="LeetCode"
        description="Accepted problems · Easy / Medium / Hard"
        status="not_connected"
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" />
          </svg>
        }
      />

      <div className="card" style={{ marginTop: "1rem", padding: "1rem", background: "var(--bg-3)" }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", lineHeight: 1.6 }}>
          🔒 <strong style={{ color: "var(--text-2)" }}>Privacy note:</strong> Data is normalized on your device.
          Credentials are stored only in your local encrypted vault — never on a server.
        </p>
      </div>
    </div>
  );
}

type ConnectorStatus = "not_connected" | "connected" | "error" | "syncing";

function ConnectorCard({
  id,
  name,
  description,
  status,
  icon,
}: {
  id: string;
  name: string;
  description: string;
  status: ConnectorStatus;
  icon: React.ReactNode;
}) {
  const statusBadge: Record<ConnectorStatus, { label: string; cls: string }> = {
    not_connected: { label: "Not connected", cls: "badge-muted" },
    connected: { label: "Connected", cls: "badge-success" },
    error: { label: "Error — action needed", cls: "badge-danger" },
    syncing: { label: "Syncing…", cls: "badge-accent" },
  };
  const badge = statusBadge[status];

  return (
    <div className="card" style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
        <div style={{ color: "var(--text-2)", flexShrink: 0, marginTop: "2px" }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
            <h2 style={{ fontWeight: 600, fontSize: "1rem" }}>{name}</h2>
            <span className={`badge ${badge.cls}`}>{badge.label}</span>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", marginBottom: "0.875rem" }}>
            {description}
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginBottom: "0.875rem" }}>
            Data is normalized on your device; credentials are encrypted locally.
          </p>
          {status === "not_connected" ? (
            <button
              id={`connector-connect-${id}`}
              className="btn btn-primary btn-sm"
              onClick={() => alert(`${name} connector coming in Milestone 2.`)}
            >
              Connect
            </button>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button id={`connector-sync-${id}`} className="btn btn-ghost btn-sm">
                Sync now
              </button>
              <button id={`connector-disconnect-${id}`} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
