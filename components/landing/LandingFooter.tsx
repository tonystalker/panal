import Link from "next/link";
import { AppMonogram } from "@/components/ui/AppMonogram";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/80 bg-surface/40 py-12 text-xs text-muted-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand Lockup */}
        <div className="flex items-center gap-3">
          <AppMonogram size="sm" />
          <div className="flex flex-col">
            <span className="font-bold text-foreground tracking-tight text-base font-sans">
              Panal
            </span>
            <span className="text-[11px] text-muted-foreground font-sans">
              Personal analytics, local-first
            </span>
          </div>
        </div>

        {/* Links in primary sans-serif */}
        <nav className="flex items-center gap-6 font-sans text-xs" aria-label="Footer navigation">
          <Link
            href="/today"
            className="hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            App
          </Link>
          <Link
            href="/dashboard"
            className="hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Dashboard
          </Link>
          <Link
            href="/privacy"
            className="hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Privacy
          </Link>
          <Link
            href="/login"
            className="hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Login
          </Link>
        </nav>

        {/* Copyright & Local storage note */}
        <div className="text-center md:text-right text-[11px] text-subtle-foreground font-sans">
          <p className="font-mono">&copy; {currentYear} Panal. Private by default.</p>
          <p className="mt-0.5">All personal data stored locally on your device.</p>
        </div>
      </div>
    </footer>
  );
}
