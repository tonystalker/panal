import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeading({
  title,
  description,
  action,
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div
      data-slot="section-heading"
      className={cn("flex items-start justify-between gap-4 mb-3", className)}
      {...props}
    >
      <div>
        <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}
