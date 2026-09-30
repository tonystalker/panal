"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  CheckCircle2Icon,
  ZapIcon,
  LockIcon,
  GitCommitIcon,
  TrendingUpIcon,
} from "lucide-react";

export function LandingHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    // Limit to max 2.5 degrees tilt
    setRotate({
      x: -(y / (rect.height / 2)) * 2.5,
      y: (x / (rect.width / 2)) * 2.5,
    });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
      {/* Background glow and subtle grid */}
      <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center">
        <div className="w-[600px] h-[350px] bg-accent/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center">
        {/* Eyebrow badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface-muted/60 text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-6">
          <span className="size-1.5 rounded-full bg-accent animate-pulse" />
          <span>Private, Local-First &middot; Panal</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-foreground max-w-4xl leading-[1.08] mb-6">
          Make your days <span className="text-accent">visible.</span>
        </h1>

        {/* Supporting description */}
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-8">
          Plan what matters. Track the work. See the patterns, without handing your life to another dashboard.
        </p>

        {/* Primary and secondary CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mb-4">
          <Link
            href="/today"
            id="hero-primary-cta"
            className="btn btn-primary h-11 px-6 text-sm font-semibold flex items-center justify-center gap-2 w-full sm:w-auto shadow-lg shadow-accent/10"
          >
            <span>Start locally, it’s free</span>
            <ArrowRightIcon className="size-4" />
          </Link>
          <a
            href="#story"
            id="hero-secondary-cta"
            className="btn btn-ghost h-11 px-5 text-sm font-medium text-muted-foreground hover:text-foreground w-full sm:w-auto border border-border/80"
          >
            Explore the product
          </a>
        </div>

        {/* Truthful microcopy */}
        <p className="text-xs text-subtle-foreground font-mono mb-10 sm:mb-14">
          No account required. Your data stays on your device.
        </p>

        {/* Layered 3D Perspective Showcase */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ perspective: 1200 }}
          className="w-full max-w-5xl relative cursor-default px-2 sm:px-4"
        >
          <div
            style={{
              transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
              transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            className="rounded-2xl border border-border-strong bg-surface/90 shadow-2xl p-4 sm:p-6 backdrop-blur-md relative"
          >
            {/* Mock Window Top Bar */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-border-strong" />
                <span className="size-2.5 rounded-full bg-border-strong" />
                <span className="size-2.5 rounded-full bg-border-strong" />
                <span className="text-[11px] font-mono text-muted-foreground ml-2">personal-analytics.local/dashboard</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-accent" />
                <span className="text-[11px] font-mono text-muted-foreground">IndexedDB connected</span>
              </div>
            </div>

            {/* Dashboard Mockup Body */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              {/* Left Column: Daily Progress Summary */}
              <div className="rounded-xl border border-border/60 bg-surface-muted/50 p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-mono uppercase text-muted-foreground tracking-wider">
                    Today&apos;s Planned Work
                  </span>
                  <div className="text-2xl font-bold font-mono text-foreground mt-1 mb-2">
                    5 of 6 done
                  </div>
                  <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-accent rounded-full" style={{ width: "83%" }} />
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <CheckCircle2Icon className="size-3.5 text-accent shrink-0" />
                    <span>Deep work: Core database engine</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <CheckCircle2Icon className="size-3.5 text-accent shrink-0" />
                    <span>Solve 2 DSA tree problems</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="size-3.5 rounded border border-border-strong shrink-0" />
                    <span>30m Evening run</span>
                  </div>
                </div>
              </div>

              {/* Center & Right Column: Analytics Overview & Activity */}
              <div className="md:col-span-2 rounded-xl border border-border/60 bg-surface-muted/30 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-foreground">Task Completion Rate</span>
                    <span className="text-[11px] text-muted-foreground font-mono">Last 30 days</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-accent">87% avg</span>
                </div>

                {/* Simulated Chart Bars */}
                <div className="h-28 flex items-end gap-1.5 pt-4">
                  {[65, 80, 100, 70, 90, 85, 100, 75, 95, 88, 100, 90, 80, 85, 100, 70, 92, 100, 85, 90, 100].map(
                    (val, i) => (
                      <div key={i} className="h-full flex-1 flex items-end justify-center group">
                        <div
                          style={{ height: `${val}%` }}
                          className={`w-full rounded-t-sm transition-all ${
                            val === 100
                              ? "bg-accent shadow-[0_0_8px_rgba(163,255,18,0.4)]"
                              : val >= 80
                              ? "bg-white/40 group-hover:bg-white/60"
                              : "bg-white/20 group-hover:bg-white/40"
                          }`}
                        />
                      </div>
                    )
                  )}
                </div>

                {/* Micro indicators */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] font-mono text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingUpIcon className="size-3 text-accent" />
                    14-day streak active
                  </span>
                  <span>Goal: &ge; 80% daily</span>
                </div>
              </div>
            </div>

            {/* Floating Plane 1: Connector Badge */}
            <div className="absolute -top-3 right-4 sm:right-6 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-strong bg-surface-raised shadow-xl backdrop-blur-md">
              <GitCommitIcon className="size-3.5 text-accent" />
              <span className="text-xs font-mono text-foreground font-medium">
                GitHub sync &middot; 7 commits
              </span>
            </div>

            {/* Floating Plane 2: Privacy Guarantee Badge */}
            <div className="absolute -bottom-3 left-4 sm:left-6 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-strong bg-surface-raised shadow-xl backdrop-blur-md">
              <LockIcon className="size-3.5 text-accent" />
              <span className="text-xs font-mono text-foreground font-medium">
                Local-only vault &middot; AES-GCM
              </span>
            </div>
          </div>
        </div>

        {/* 3. Compact Trust Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full mt-16 pt-10 border-t border-border/60">
          <div className="flex items-center justify-center sm:justify-start gap-2.5 text-left">
            <div className="size-8 rounded-lg bg-surface-muted border border-border/80 flex items-center justify-center shrink-0">
              <ShieldCheckIcon className="size-4 text-accent" />
            </div>
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Local-first by default
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Zero remote tracking
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-2.5 text-left">
            <div className="size-8 rounded-lg bg-surface-muted border border-border/80 flex items-center justify-center shrink-0">
              <ZapIcon className="size-4 text-accent" />
            </div>
            <div>
              <span className="text-xs font-semibold text-foreground block">
                No account required
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Instant private access
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-2.5 text-left">
            <div className="size-8 rounded-lg bg-surface-muted border border-border/80 flex items-center justify-center shrink-0">
              <CheckCircle2Icon className="size-4 text-accent" />
            </div>
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Connector-ready by design
              </span>
              <span className="text-[11px] text-muted-foreground block">
                GitHub, LeetCode & more
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
