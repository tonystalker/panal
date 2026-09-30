import Link from "next/link";
import { AppMonogram } from "@/components/ui/AppMonogram";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/80 bg-surface/40 py-12 text-xs text-muted-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <AppMonogram size="sm" />
          <div className="flex flex-col">
            <span className="font-bold text-foreground tracking-tight text-base">
              Panal
            </span>
            <span className="text-[11px] text-muted-foreground">
              Local-first personal daily operating system
            </span>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6 font-mono text-xs">
          <Link href="/today" className="hover:text-foreground transition-colors">
            App
          </Link>
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/login" className="hover:text-foreground transition-colors">
            Login
          </Link>
        </div>

        {/* Copyright & Local storage note */}
        <div className="text-center md:text-right font-mono text-[11px] text-subtle-foreground">
          <p>&copy; {currentYear} Panal. Private by default.</p>
          <p className="mt-0.5">All personal data stored locally in your browser.</p>
        </div>
      </div>
    </footer>
  );
}
