"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ConnectorConnection } from "@/lib/db";
import { format, parseISO } from "date-fns";

export interface ConnectorPanelProps {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  connection: ConnectorConnection | null;
  children: React.ReactNode;
  className?: string;
}

export function ConnectorPanel({
  id,
  name,
  icon,
  description,
  connection,
  children,
  className,
}: ConnectorPanelProps) {
  const isConnected =
    connection?.status === "connected" ||
    connection?.status === "syncing" ||
    connection?.status === "error";

  return (
    <div
      data-slot="connector-panel"
      className={cn(
        "card p-5 transition-all hover:border-border-strong flex flex-col gap-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3.5">
        <div className="size-9 rounded-lg bg-surface-muted border border-border flex items-center justify-center shrink-0 text-foreground">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {name}
            </h2>
            <StatusBadge
              status={connection?.status ?? "not_connected"}
              label={
                connection?.status === "connected"
                  ? "Connected"
                  : connection?.status === "syncing"
                  ? "Syncing"
                  : connection?.status === "error"
                  ? "Attention required"
                  : "Not connected"
              }
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {isConnected && connection?.lastSyncedAt && (
            <p className="text-[11px] text-subtle-foreground font-mono mt-1">
              Last sync: {format(parseISO(connection.lastSyncedAt), "MMM d, yyyy 'at' HH:mm")}
              {connection.displayName && (
                <> · <strong className="text-muted-foreground">{connection.displayName}</strong></>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Body / Flow */}
      <div className="pt-1">{children}</div>
    </div>
  );
}
