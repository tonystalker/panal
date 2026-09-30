import Link from "next/link";
import { AppMonogram } from "@/components/ui/AppMonogram";
import { ArrowLeftIcon, ShieldCheckIcon, LockIcon, DatabaseIcon, TerminalIcon } from "lucide-react";

export const metadata = {
  title: "Privacy Promise — Panal",
  description: "Learn how Panal protects your privacy through local-first architecture and client-side encryption.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-accent/20 selection:text-accent">
      {/* Top Header */}
      <header className="border-b border-border/80 bg-surface/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeftIcon className="size-3.5" />
            <span>Back to overview</span>
          </Link>
          <div className="flex items-center gap-2">
            <AppMonogram size="sm" />
            <span className="text-base font-bold text-foreground">Panal</span>
          </div>
          <Link href="/today" className="btn btn-primary btn-sm text-xs h-7 px-3">
            Open App
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-surface-muted text-[11px] font-mono uppercase tracking-wider text-accent mb-6 font-semibold">
          <ShieldCheckIcon className="size-3.5" />
          <span>Local-First Architecture</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-6">
          Privacy Promise &amp; Technical Architecture
        </h1>

        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-12">
          Panal was built on a foundational principle: your private daily logs, habits, and productivity patterns belong exclusively to you.
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-zinc-300">
          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-foreground font-semibold text-base">
              <DatabaseIcon className="size-4 text-accent" />
              <h2>1. On-Device Storage Only</h2>
            </div>
            <p>
              In Version 1 of Panal, 100% of your personal logs, tasks, check-in values, reflection notes, and custom metrics are stored locally on your device in your browser&apos;s persistent local storage. We run no remote user database, no central telemetry servers, and no advertising trackers.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-foreground font-semibold text-base">
              <LockIcon className="size-4 text-accent" />
              <h2>2. Client-Side Encryption (Web Crypto AES-GCM)</h2>
            </div>
            <p>
              When you export an encrypted backup file (<code className="font-mono text-xs text-accent">.panal-backup</code>), your data is encrypted directly on your machine using PBKDF2 key derivation and AES-GCM 256-bit encryption. Your passphrase is never sent to any server. If you lose your passphrase and recovery phrase, the data cannot be decrypted by anyone.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-foreground font-semibold text-base">
              <TerminalIcon className="size-4 text-accent" />
              <h2>3. Connector Credentials &amp; API Transmission</h2>
            </div>
            <p>
              When you connect external services such as GitHub or LeetCode:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>Access tokens and credentials are stored exclusively in your local encrypted device vault.</li>
              <li>Network requests are made directly between your browser and the provider&apos;s API endpoints.</li>
              <li>No intermediary proxy stores your credentials or your imported contribution history.</li>
              <li>You can disconnect any service and purge all associated metric history with a single click.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-foreground font-semibold text-base">
              <ShieldCheckIcon className="size-4 text-accent" />
              <h2>4. No Product Analytics or Tracking Scripts</h2>
            </div>
            <p>
              You can export all your data anytime in human-readable JSON or CSV format, or wipe all local data instantly from the Settings page. We believe in total data portability and complete user sovereignty.
            </p>
          </section>
        </div>

        <div className="mt-14 pt-8 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs font-mono text-muted-foreground">
            Version 1.0 &middot; Updated October 2026
          </span>
          <Link href="/today" className="btn btn-primary btn-sm text-xs font-semibold px-4 h-8">
            Open Panal
          </Link>
        </div>
      </main>
    </div>
  );
}
