import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center text-center py-5 px-4 rounded-lg border border-border/60 bg-surface/20",
        className
      )}
      {...props}
    >
      {icon && <div className="text-subtle-foreground mb-2 opacity-70">{icon}</div>}
      <h3 className="text-xs sm:text-sm font-medium text-foreground tracking-tight">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
