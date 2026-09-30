import Image from "next/image";

export function LandingEditorial() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden border-t border-border/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative rounded-2xl border border-border/80 overflow-hidden bg-surface-solid shadow-2xl">
          {/* Editorial Visual */}
          <div className="relative h-[340px] sm:h-[480px] w-full">
            <Image
              src="/images/landing/editorial-desk.jpg"
              alt="Minimal dark workspace at night with open notebook and soft screen glow"
              fill
              className="object-cover object-center filter brightness-90 contrast-105"
              sizes="(max-width: 768px) 100vw, 1200px"
            />
            {/* Soft dark vignette and edge fade */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/40" />

            {/* Overlay Copy */}
            <div className="absolute bottom-0 left-0 p-6 sm:p-12 max-w-xl">
              <span className="text-xs font-mono uppercase tracking-widest text-accent font-semibold block mb-2">
                Calm Reflection
              </span>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight mb-3">
                A record of your days, for you.
              </h2>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                No audience, no algorithmic feed, and no gamified pressure. Just honest insight into where your time, focus, and energy actually go.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
