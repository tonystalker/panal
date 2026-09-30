import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

export function LandingCTA() {
  return (
    <section className="py-20 md:py-28 border-t border-border/60 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[250px] bg-accent/5 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative">
        <div className="rounded-3xl border border-border-strong bg-surface/90 p-8 sm:p-14 text-center shadow-2xl backdrop-blur-md relative overflow-hidden">
          {/* Accent hairline accent pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/10 text-[11px] font-mono uppercase tracking-wider text-accent mb-6 font-semibold">
            <span>No account required</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            Start with one honest day.
          </h2>

          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8">
            No account. No feed. Just a private place to understand your work.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
            <Link
              href="/today"
              id="cta-open-app-btn"
              className="btn btn-primary h-11 px-7 text-sm font-semibold flex items-center justify-center gap-2 w-full sm:w-auto shadow-lg shadow-accent/15"
            >
              <span>Open Panal</span>
              <ArrowRightIcon className="size-4" />
            </Link>
            <Link
              href="/privacy"
              className="btn btn-ghost h-11 px-5 text-sm font-medium text-muted-foreground hover:text-foreground w-full sm:w-auto border border-border/80"
            >
              Read the privacy promise
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
