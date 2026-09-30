import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-accent/20 selection:text-accent">
      <LandingNav />
      <main id="main-content" className="flex-1">
        <LandingHero />
      </main>
    </div>
  );
}
