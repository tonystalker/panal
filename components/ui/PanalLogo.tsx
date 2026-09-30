import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface PanalLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "mark" | "full";
  size?: "sm" | "md" | "lg";
}

export function PanalLogo({
  variant = "full",
  size = "md",
  className,
  ...props
}: PanalLogoProps) {
  if (variant === "mark") {
    const sizeMap = {
      sm: { container: "size-6", px: 24 },
      md: { container: "size-8", px: 32 },
      lg: { container: "size-10", px: 40 },
    };
    const { container, px } = sizeMap[size];
    return (
      <div
        className={cn("inline-flex items-center justify-center shrink-0 select-none", container, className)}
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

  const fullSizeMap = {
    sm: { width: 88, height: 26 },
    md: { width: 110, height: 32 },
    lg: { width: 136, height: 40 },
  };
  const { width, height } = fullSizeMap[size];

  return (
    <div
      className={cn("inline-flex items-center shrink-0 select-none", className)}
      {...props}
    >
      <Image
        src="/panal-logo-white.png"
        alt="Panal"
        width={width}
        height={height}
        className="h-auto object-contain"
        priority
      />
    </div>
  );
}
