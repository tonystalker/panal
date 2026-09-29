"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/Sidebar";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav md:hidden select-none" aria-label="Mobile navigation">
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || (pathname === "/" && item.href === "/today");
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            id={item.id}
            className={cn("nav-item", isActive && "active")}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-5 shrink-0" />
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
