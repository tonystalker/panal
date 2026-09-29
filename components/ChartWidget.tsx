"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  Settings2Icon,
  EyeOffIcon,
  TableIcon,
} from "lucide-react";

export interface ChartWidgetProps {
  id: string;
  title: string;
  unit?: string;
  range: string;
  chartType: string;
  rollingAverage?: number | null;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete?: () => void;
  onToggleVisible: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: React.ReactNode;
  tableContent?: React.ReactNode;
  className?: string;
}

export function ChartWidget({
  id,
  title,
  unit,
  range,
  chartType,
  rollingAverage,
  isFirst,
  isLast,
  onEdit,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  children,
  tableContent,
  className,
}: ChartWidgetProps) {
  const [showTable, setShowTable] = React.useState(false);

  return (
    <div
      data-slot="chart-widget"
      className={cn(
        "card flex flex-col justify-between transition-all hover:border-border-strong",
        className
      )}
    >
      {/* Widget Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-col min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">
              {title}
            </h3>
            {unit && (
              <span className="text-xs text-subtle-foreground font-mono">
                ({unit})
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
            <span>{range}</span>
            <span className="text-subtle-foreground">·</span>
            <span className="capitalize">{chartType}</span>
            {rollingAverage && (
              <>
                <span className="text-subtle-foreground">·</span>
                <span>{rollingAverage}d avg</span>
              </>
            )}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Move widget up"
            title="Move up"
            className="btn-icon size-7 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            onClick={onMoveUp}
            disabled={isFirst}
          >
            <ChevronUpIcon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Move widget down"
            title="Move down"
            className="btn-icon size-7 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            onClick={onMoveDown}
            disabled={isLast}
          >
            <ChevronDownIcon className="size-3.5" />
          </button>
          <button
            type="button"
            id={`widget-config-${id}`}
            aria-label="Configure widget"
            title="Configure"
            className="btn-icon size-7 text-muted-foreground hover:text-foreground hover:border-accent/40"
            onClick={onEdit}
          >
            <Settings2Icon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Hide widget"
            title="Hide"
            className="btn-icon size-7 text-muted-foreground hover:text-foreground"
            onClick={onToggleVisible}
          >
            <EyeOffIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Main Chart Body */}
      <div className="min-h-[160px] flex flex-col justify-center">
        {children}
      </div>

      {/* Tabular Data View Toggle */}
      {tableContent && (
        <div className="pt-2 mt-2 border-t border-border/50 flex flex-col">
          <button
            type="button"
            aria-expanded={showTable}
            aria-controls={`table-${id}`}
            onClick={() => setShowTable((s) => !s)}
            className="self-start text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1.5 py-0.5 outline-none transition-colors"
          >
            <TableIcon className="size-3" />
            <span>{showTable ? "Hide data table" : "Show data table"}</span>
          </button>
          {showTable && (
            <div id={`table-${id}`} className="mt-2.5 max-h-48 overflow-y-auto">
              {tableContent}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
