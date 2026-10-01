import * as React from "react";
import Image from "next/image";

export default function LogoIcon({
  className = "size-7",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`inline-flex items-center justify-center select-none shrink-0 ${className}`}
      {...props}
    >
      <Image
        src="/panal-mark-white.png"
        alt="Panal"
        width={32}
        height={32}
        className="w-full h-full object-contain"
        priority
      />
    </div>
  );
}

export { LogoIcon };
