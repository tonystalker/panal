import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingStory } from "@/components/landing/LandingStory";
import { LandingEditorial } from "@/components/landing/LandingEditorial";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingPrivacy } from "@/components/landing/LandingPrivacy";
import { LandingCTA } from "@/components/landing/LandingCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-accent/20 selection:text-accent">
      <LandingNav />
      <main id="main-content" className="flex-1">
        <LandingHero />
        <LandingStory />
        <LandingEditorial />
        <LandingFeatures />
        <LandingPrivacy />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
