"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppMonogram } from "@/components/ui/AppMonogram";
import {
  CalendarDaysIcon,
  CheckSquareIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  LayoutDashboardIcon,
  Link2Icon,
  SettingsIcon,
  ShieldCheckIcon,
} from "lucide-react";

export const NAV_ITEMS = [
  {
    href: "/today",
    label: "Today",
    id: "nav-today",
    icon: CheckSquareIcon,
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    id: "nav-dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    href: "/calendar",
    label: "Calendar",
    id: "nav-calendar",
    icon: CalendarDaysIcon,
  },
  {
    href: "/connectors",
    label: "Connectors",
    id: "nav-connectors",
    icon: Link2Icon,
  },
  {
    href: "/settings",
    label: "Settings",
    id: "nav-settings",
    icon: SettingsIcon,
  },
] as const;

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Sidebar navigation"
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 shrink-0 border-r border-border bg-surface text-foreground transition-all duration-200 ease-out z-30 select-none",
        collapsed ? "w-16" : "w-[248px]"
      )}
    >
      {/* Top Brand Area */}
      <div
        className={cn(
          "flex items-center gap-3 px-3.5 py-4 border-b border-border/60 min-h-[64px]",
          collapsed && "justify-center px-0"
        )}
      >
        <Link href="/today" className="flex items-center gap-3 group outline-none">
          <AppMonogram size={collapsed ? "sm" : "md"} />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-foreground tracking-tight leading-none group-hover:text-accent transition-colors">
                Panal
              </span>
              <span className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5 font-mono">
                <span className="size-1.5 rounded-full bg-emerald-400/80" />
                Local & Private
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || (pathname === "/" && item.href === "/today");
          const Icon = item.icon;

          return (
            <div key={item.href} className="relative group/nav">
              <Link
                href={item.href}
                id={item.id}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors outline-none",
                  collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2 w-full",
                  isActive
                    ? "bg-surface-raised text-foreground font-medium border-l-2 border-accent rounded-l-none pl-2.5"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground border-l-2 border-transparent pl-2.5"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground group-hover/nav:text-foreground"
                  )}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>

              {/* Tooltip on collapsed state */}
              {collapsed && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover/nav:flex items-center px-2.5 py-1 text-xs font-medium text-foreground bg-surface-raised border border-border-strong rounded-md shadow-xl whitespace-nowrap z-50 animate-in fade-in-0 duration-150"
                >
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Area */}
      <div className="p-2.5 pb-16 border-t border-border/60 mt-auto flex flex-col gap-2 relative z-20">
        {/* Collapse / Expand Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center gap-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors outline-none",
            collapsed ? "justify-center h-9 w-9 mx-auto" : "px-3 py-2 w-full"
          )}
        >
          {collapsed ? (
            <ChevronsRightIcon className="size-4" />
          ) : (
            <>
              <ChevronsLeftIcon className="size-4" />
              <span>Collapse sidebar</span>
            </>
          )}
        </button>

        {!collapsed && (
          <div className="px-2.5 py-1.5 rounded-lg bg-surface-muted/40 border border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheckIcon className="size-3 text-muted-foreground" />
              Local storage
            </span>
            <span className="size-1.5 rounded-full bg-emerald-400/80" title="Ready offline" />
          </div>
        )}
      </div>
    </aside>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Mobile Drawer Component
// ────────────────────────────────────────────────────────────────────────────
export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation drawer"
      className="fixed inset-0 z-50 md:hidden flex"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer surface */}
      <div className="relative w-4/5 max-w-xs bg-surface border-r border-border h-full flex flex-col p-4 shadow-2xl animate-in slide-in-from-left duration-200 z-10">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <AppMonogram size="sm" />
            <span className="text-base font-bold text-foreground tracking-tight">
              Panal
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation drawer"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || (pathname === "/" && item.href === "/today");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                id={`drawer-${item.id}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-surface-raised text-foreground font-medium border-l-2 border-accent rounded-l-none pl-3"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground border-l-2 border-transparent pl-3"
                )}
              >
                <Icon className={cn("size-4 shrink-0", isActive ? "text-foreground" : "text-muted-foreground")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-border/60">
          <div className="px-3 py-2 rounded-lg bg-surface-muted/60 border border-border/60 text-xs text-muted-foreground flex items-center justify-between">
            <span>Local IndexedDB</span>
            <span className="size-1.5 rounded-full bg-emerald-400/80" />
          </div>
        </div>
      </div>
    </div>
  );
}
