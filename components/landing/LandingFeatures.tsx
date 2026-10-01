import { ClockIcon, CheckSquareIcon, Link2Icon, BarChart3Icon, ShieldIcon } from "lucide-react";

export function LandingFeatures() {
  return (
    <section id="features" className="py-20 md:py-28 border-t border-border/60 relative scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-surface-muted text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
            <span>Core Capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            Designed for truth, not vanity metrics.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Every feature protects your attention and your privacy. No bloatware, no tracking scripts.
          </p>
        </div>

        {/* Feature Grid with Varied Layouts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Feature 1: Workday Cutoff (Spans 2 cols on lg - Distinct Hero Card) */}
          <div className="lg:col-span-2 rounded-2xl border border-border/80 bg-surface/60 p-6 sm:p-7 flex flex-col justify-between gap-6 hover:border-border-strong transition-all">
            <div>
              <div className="size-9 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-foreground mb-4">
                <ClockIcon className="size-4" />
              </div>
              <h3 className="text-lg font-semibold text-foreground tracking-tight mb-2">
                Your day, on your clock
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                Work past midnight? Configure a custom workday cutoff such as 6:00 AM. Tasks completed during late-night sessions belong to that workday instead of prematurely rolling over at calendar midnight.
              </p>
            </div>

            {/* Micro visual: Cutoff badge & time simulation */}
            <div className="p-3.5 rounded-xl border border-border/60 bg-surface-muted/50 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground font-sans">Local workday cutoff:</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="px-2 py-0.5 rounded bg-surface border border-border text-foreground font-semibold">
                  06:00 AM (Night Shift)
                </span>
                <span className="text-[11px] text-accent flex items-center gap-1">
                  <span className="size-1 rounded-full bg-accent" />
                  Operational date preserved
                </span>
              </div>
            </div>
          </div>

          {/* Feature 2: Dual Task Progress (1 col) */}
          <div className="rounded-2xl border border-border/80 bg-surface/60 p-6 sm:p-7 flex flex-col justify-between gap-6 hover:border-border-strong transition-all">
            <div>
              <div className="size-9 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-foreground mb-4">
                <CheckSquareIcon className="size-4" />
              </div>
              <h3 className="text-lg font-semibold text-foreground tracking-tight mb-2">
                Tasks with real progress
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Planned tasks and quantitative targets are separate measures. Finishing 8 of 10 pages is meaningful progress, not an arbitrary binary failure.
              </p>
            </div>

            {/* Micro visual: Dual bar */}
            <div className="space-y-2 p-3 rounded-xl border border-border/60 bg-surface-muted/50 text-[11px]">
              <div className="flex justify-between text-muted-foreground">
                <span className="font-sans">Task completion:</span>
                <span className="text-foreground font-mono font-bold">50% (3/6)</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="font-sans">Target progress:</span>
                <span className="text-accent font-mono font-bold">75% (15/20)</span>
              </div>
            </div>
          </div>

          {/* Feature 3: Supported Connectors (1 col) */}
          <div className="rounded-2xl border border-border/80 bg-surface/60 p-6 sm:p-7 flex flex-col justify-between gap-6 hover:border-border-strong transition-all">
            <div>
              <div className="size-9 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-foreground mb-4">
                <Link2Icon className="size-4" />
              </div>
              <h3 className="text-lg font-semibold text-foreground tracking-tight mb-2">
                Connect supported services
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connect supported services such as GitHub and LeetCode. Their activity becomes clear, date-based metrics alongside the work you log yourself.
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl border border-border/60 bg-surface-muted/50 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-accent" />
              <span className="font-mono text-foreground font-medium">GitHub + LeetCode connectors</span>
            </div>
          </div>

          {/* Feature 4: Charts You Control (Spans 2 cols on lg) */}
          <div className="lg:col-span-2 rounded-2xl border border-border/80 bg-surface/60 p-6 sm:p-7 flex flex-col justify-between gap-6 hover:border-border-strong transition-all">
            <div>
              <div className="size-9 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-foreground mb-4">
                <BarChart3Icon className="size-4" />
              </div>
              <h3 className="text-lg font-semibold text-foreground tracking-tight mb-2">
                Charts you control
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                Switch between Line, Bar, Area, and Calendar Heatmap views. Set custom goal lines, rolling averages, and inspect your habits without noisy external tracking.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/60 bg-surface-muted/50 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground font-sans">
                <span>View Modes:</span>
                <span className="px-2 py-0.5 rounded bg-surface border border-border text-foreground font-mono font-medium">
                  Bar &middot; Line &middot; Heatmap
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground font-sans">
                <span>Rolling Window:</span>
                <span className="text-foreground font-mono font-medium">7-day &amp; 30-day</span>
              </div>
            </div>
          </div>

          {/* Feature 5: Open Architectural Layout with Quiet Divider (Replaces identical card treatment) */}
          <div className="md:col-span-2 lg:col-span-3 pt-10 mt-4 border-t border-border/60 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-xl">
              <div className="size-9 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-foreground mb-4">
                <ShieldIcon className="size-4" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight mb-2">
                Data you own and export anytime
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Everything stays on your local device. No central telemetry server, no advertising trackers, and no proprietary lock-in. Export clean JSON, CSV, or passphrase-encrypted backup files whenever you wish.
              </p>
            </div>

            {/* Architecture Flow Micro-Diagram */}
            <div className="flex flex-col sm:flex-row items-center gap-3 text-xs text-muted-foreground shrink-0 bg-surface-muted/40 p-4 rounded-xl border border-border/60">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-accent" />
                <span className="text-foreground font-medium font-sans">On-Device Storage</span>
              </div>
              <span className="text-border-strong hidden sm:inline">&rarr;</span>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-sans">Local Encryption</span>
              </div>
              <span className="text-border-strong hidden sm:inline">&rarr;</span>
              <div className="px-2.5 py-1 rounded bg-surface border border-border text-foreground font-mono text-[11px] font-semibold">
                .panal-backup (AES-GCM)
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
