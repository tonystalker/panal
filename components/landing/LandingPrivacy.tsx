import Link from "next/link";
import { ArrowRightIcon, MonitorIcon, HardDriveIcon, FileKeyIcon, ShieldCheckIcon } from "lucide-react";

export function LandingPrivacy() {
  return (
    <section id="privacy" className="py-20 md:py-28 border-t border-border/60 relative scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-surface-muted text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
            <ShieldCheckIcon className="size-3.5 text-accent" />
            <span>Architecture &amp; Ethics</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            Private by architecture.
          </h2>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-10 max-w-xl">
            In the current version, personal logs stay in your browser. You decide if and when to export a backup.
          </p>

          {/* Compact Left-to-Right Local Data Diagram */}
          <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-surface/60 p-6 sm:p-8 mb-8 backdrop-blur-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 items-center">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center gap-2.5">
                <div className="size-12 rounded-xl bg-surface-muted border border-border flex items-center justify-center text-accent">
                  <MonitorIcon className="size-6" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground block">Your Browser</span>
                  <span className="text-xs text-muted-foreground font-mono">Input &amp; view data</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center gap-2.5 sm:border-x sm:border-border/60 sm:px-4">
                <div className="size-12 rounded-xl bg-surface-muted border border-border flex items-center justify-center text-accent">
                  <HardDriveIcon className="size-6" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground block">On-Device Storage</span>
                  <span className="text-xs text-muted-foreground font-mono">Stored on your device</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center gap-2.5">
                <div className="size-12 rounded-xl bg-surface-muted border border-border flex items-center justify-center text-accent">
                  <FileKeyIcon className="size-6" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground block">Encrypted Export</span>
                  <span className="text-xs text-muted-foreground font-mono">AES-GCM backup file</span>
                </div>
              </div>
            </div>

            {/* Micro verification line */}
            <div className="mt-8 pt-4 border-t border-border/40 text-[11px] font-mono text-subtle-foreground flex items-center justify-center gap-2">
              <span className="size-1.5 rounded-full bg-accent" />
              <span>No product analytics &middot; No advertising trackers &middot; Fully offline capable</span>
            </div>
          </div>

          <Link
            href="/privacy"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-muted-foreground hover:text-accent transition-colors"
          >
            <span>Read our complete privacy promise</span>
            <ArrowRightIcon className="size-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
