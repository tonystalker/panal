import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string | React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  action,
  badge,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-border/60",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {description}
          </div>
        )}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2.5">{action}</div>}
    </div>
  );
}
