import * as React from "react";
import { cn } from "@/lib/utils";

interface AppMonogramProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "size-6 text-[10px] rounded-md",
  md: "size-8 text-xs rounded-lg",
  lg: "size-10 text-sm rounded-lg",
};

export function AppMonogram({ size = "md", className, ...props }: AppMonogramProps) {
  return (
    <div
      data-slot="app-monogram"
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center font-bold tracking-tight bg-surface-muted text-foreground border border-border-strong select-none font-mono relative",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <span>PA</span>
    </div>
  );
}
