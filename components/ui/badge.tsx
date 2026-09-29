import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap border transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground font-semibold",
        secondary: "border-border bg-surface-muted text-foreground",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive",
        outline: "border-border text-muted-foreground",
        ghost: "border-transparent text-muted-foreground hover:bg-surface-muted",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        warning: "border-amber-500/20 bg-amber-500/10 text-amber-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
