"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar, MobileDrawer, NAV_ITEMS } from "@/components/Sidebar";
import { AppMonogram } from "@/components/ui/AppMonogram";
import { MenuIcon } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);

  // Load sidebar preference from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("panal_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // localStorage may fail in private mode
    }
  }, []);

  const handleToggleCollapse = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("panal_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Compute current page label for mobile header
  const currentItem = NAV_ITEMS.find(
    (item) => item.href === pathname || (pathname === "/" && item.href === "/today")
  );
  const currentTitle = currentItem?.label ?? "Personal Analytics";

  // Public landing, auth, legal, and error routes render directly without dashboard sidebar
  const isDashboardRoute =
    pathname.startsWith("/today") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/connectors") ||
    pathname.startsWith("/settings");

  if (!isDashboardRoute) {
    return (
      <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent/20 selection:text-accent">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased">
      {/* Desktop Collapsible Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Mobile Drawer */}
      <MobileDrawer
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
      />

      {/* Content wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border/80 bg-surface/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors outline-none"
            >
              <MenuIcon className="size-5" />
            </button>
            <div className="flex items-center gap-2">
              <AppMonogram size="sm" />
              <span className="text-sm font-semibold text-foreground tracking-tight">
                {currentTitle}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-0.5 rounded border border-border/60 bg-surface-muted">
            local
          </span>
        </header>

        {/* Main Content Area */}
        <main id="main-content" className="flex-1 w-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
