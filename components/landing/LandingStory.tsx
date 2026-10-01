"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2Icon, ShieldCheckIcon } from "lucide-react";

const CHAPTERS = [
  {
    step: "01",
    eyebrow: "INTENTIONAL PLANNING",
    title: "Plan the day with honest progress.",
    description:
      "Daily tasks and quantitative targets remain separate measures. Complete 3 of 6 tasks? 50% task completion. Finish 7 of 10 problems? 70% target progress. Incomplete quantitative work is never auto-failed.",
    detail: "Configurable cutoff supports schedules that run past midnight.",
  },
  {
    step: "02",
    eyebrow: "CONNECTED WORK",
    title: "Turn activity into inspectable daily metrics.",
    description:
      "Connect supported services such as GitHub and LeetCode. Their activity becomes clear, date-based metrics alongside the work you log yourself.",
    detail: "AES-GCM encrypted local vault for all credentials.",
  },
  {
    step: "03",
    eyebrow: "PATTERN DISCOVERY",
    title: "See the pattern through calm analytics.",
    description:
      "Discover trends with flexible line, bar, area, and custom SVG calendar heatmap charts. Add rolling averages, custom goal lines, and track custom habits like water intake or reading.",
    detail: "Zero black-box productivity scores.",
  },
];

export function LandingStory() {
  const [activeChapter, setActiveChapter] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mqMotion.matches);
    const motionHandler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mqMotion.addEventListener("change", motionHandler);

    const observers = chapterRefs.current.map((ref, idx) => {
      if (!ref) return null;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveChapter(idx);
            }
          });
        },
        { threshold: 0.5, rootMargin: "-10% 0px -40% 0px" }
      );
      observer.observe(ref);
      return observer;
    });

    return () => {
      mqMotion.removeEventListener("change", motionHandler);
      observers.forEach((obs) => obs?.disconnect());
    };
  }, []);

  return (
    <section id="story" className="py-20 md:py-32 border-t border-border/60 relative scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-16">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-surface-muted text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
            <span>Scroll Showcase</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            How Panal operates.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Three disciplined rhythms that turn your daily efforts into clarity without distraction.
          </p>
        </div>

        {/* Desktop Sticky Showcase Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Narrative Chapters (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-24 py-4 md:py-8">
            {CHAPTERS.map((ch, idx) => {
              const isActive = activeChapter === idx;
              return (
                <div
                  key={ch.step}
                  ref={(el) => {
                    chapterRefs.current[idx] = el;
                  }}
                  className="scroll-mt-32 md:scroll-mt-40 transition-colors duration-200"
                >
                  <div className="flex items-center gap-3 mb-2 font-mono text-xs">
                    <span
                      className={`font-bold transition-colors ${
                        isActive ? "text-accent" : "text-zinc-400"
                      }`}
                    >
                      {ch.step}
                    </span>
                    <span className="text-border-strong">&mdash;</span>
                    <span
                      className={`uppercase tracking-widest text-[10px] transition-colors ${
                        isActive ? "text-muted-foreground font-semibold" : "text-zinc-400"
                      }`}
                    >
                      {ch.eyebrow}
                    </span>
                  </div>

                  <h3
                    className={`text-xl sm:text-2xl font-semibold tracking-tight mb-3 transition-colors ${
                      isActive ? "text-foreground" : "text-zinc-200"
                    }`}
                  >
                    {ch.title}
                  </h3>

                  <p
                    className={`text-sm leading-relaxed mb-4 transition-colors ${
                      isActive ? "text-foreground/90" : "text-zinc-300"
                    }`}
                  >
                    {ch.description}
                  </p>

                  <div
                    className={`inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded border transition-colors ${
                      isActive
                        ? "bg-surface-muted/90 border-accent/30 text-foreground"
                        : "bg-surface-muted/50 border-border/60 text-zinc-400"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full transition-colors ${
                        isActive ? "bg-accent" : "bg-zinc-500"
                      }`}
                    />
                    <span>{ch.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Sticky Transforming Visual Frame (7 cols) */}
          <div className="lg:col-span-7 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-2xl relative overflow-hidden min-h-[380px] flex flex-col justify-center">
              {/* Dynamic Mockup based on activeChapter */}
              {activeChapter === 0 && (
                <div
                  className={`space-y-4 ${
                    prefersReducedMotion ? "" : "animate-in fade-in duration-200"
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <div>
                      <span className="text-[11px] font-mono text-muted-foreground uppercase">
                        Workday Log &middot; Operational Date
                      </span>
                      <h4 className="text-base font-semibold text-foreground">
                        Today&apos;s Focus Tasks
                      </h4>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-accent/10 border border-accent/20 text-xs font-mono text-accent font-medium">
                      50% tasks &middot; 70% target
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-3 rounded-lg border border-border/80 bg-surface-muted/40 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2Icon className="size-4 text-accent shrink-0" />
                        <span className="text-xs font-medium text-foreground">
                          Engine architectural refactor
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">Done</span>
                    </div>

                    <div className="p-3 rounded-lg border border-border/80 bg-surface-muted/40 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="size-4 rounded border border-border-strong shrink-0" />
                        <span className="text-xs font-medium text-foreground">
                          Algorithm problem set
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-accent">7 of 10 solved</span>
                    </div>

                    <div className="p-3 rounded-lg border border-border/80 bg-surface-muted/40 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="size-4 rounded border border-border-strong shrink-0" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Reading: Distributed systems ch. 4
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">Todo</span>
                    </div>
                  </div>
                </div>
              )}

              {activeChapter === 1 && (
                <div
                  className={`space-y-4 ${
                    prefersReducedMotion ? "" : "animate-in fade-in duration-200"
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <div>
                      <span className="text-[11px] font-mono text-muted-foreground uppercase">
                        Supported Connectors
                      </span>
                      <h4 className="text-base font-semibold text-foreground">
                        Local Credential Vault
                      </h4>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-surface-muted border border-border text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheckIcon className="size-3 text-zinc-300" />
                      AES-GCM local
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl border border-border bg-surface-muted/50 flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">GitHub</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                          Connected
                        </span>
                      </div>
                      <div className="font-mono text-2xl font-bold text-foreground">
                        14 <span className="text-xs text-muted-foreground font-normal">commits today</span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        GraphQL Contributions &middot; 30d sync
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-surface-muted/50 flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">LeetCode</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                          Connected
                        </span>
                      </div>
                      <div className="font-mono text-2xl font-bold text-foreground">
                        3 <span className="text-xs text-muted-foreground font-normal">solved</span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        DSA submissions &middot; Verified
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeChapter === 2 && (
                <div
                  className={`space-y-4 ${
                    prefersReducedMotion ? "" : "animate-in fade-in duration-200"
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <div>
                      <span className="text-[11px] font-mono text-muted-foreground uppercase">
                        Trend Analytics &middot; 30 Days
                      </span>
                      <h4 className="text-base font-semibold text-foreground">
                        Completion & Streak Heatmap
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-accent">
                      14-day streak
                    </span>
                  </div>

                  {/* Simulated Calendar Heatmap Row */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                      Consistency Rhythm
                    </span>
                    <div className="grid grid-cols-10 gap-1.5">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-5 rounded-xs transition-colors ${
                            i > 22
                              ? "bg-accent"
                              : i % 4 === 0
                              ? "bg-white/40"
                              : i % 3 === 0
                              ? "bg-white/20"
                              : "bg-surface-muted border border-border/40"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs font-mono text-muted-foreground">
                    <span>Rolling Average: 7-day</span>
                    <span className="text-foreground">Goal line: 85%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
