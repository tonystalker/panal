import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface AppMonogramProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
};

const pixelSizes = {
  sm: 24,
  md: 32,
  lg: 40,
};

export function AppMonogram({ size = "md", className, ...props }: AppMonogramProps) {
  const px = pixelSizes[size];

  return (
    <div
      data-slot="app-monogram"
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center select-none relative shrink-0",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <Image
        src="/panal-mark-white.png"
        alt="Panal"
        width={px}
        height={px}
        className="w-full h-full object-contain"
        priority
      />
    </div>
  );
}
