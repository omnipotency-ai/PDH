import { ApiKeyFooterSection } from "@/components/landing/ApiKeyFooterSection";
import { BackToTop } from "@/components/landing/BackToTop";
import { BetaTestSection } from "@/components/landing/BetaTestSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { LandingNav } from "@/components/landing/LandingNav";
import { PricingSection } from "@/components/landing/PricingSection";
import { ProblemSection } from "@/components/landing/ProblemSection";

export default function LandingPage() {
  return (
    <div
      id="landing-scroll"
      data-theme="dark"
      className="h-dvh snap-y snap-mandatory overflow-y-auto scroll-smooth text-[rgba(240,248,255,0.95)]"
      style={{
        background: `
          radial-gradient(ellipse 120% 80% at 20% 30%, #09182d, transparent 70%),
          radial-gradient(ellipse 100% 100% at 80% 70%, #09182d, transparent 60%),
          radial-gradient(ellipse 80% 120% at 50% 10%, #071020, transparent 80%),
          #04091b
        `,
        backgroundAttachment: "fixed",
      }}
    >
      <LandingNav />
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <BetaTestSection />
      <HowItWorksSection />
      <PricingSection />
      <ApiKeyFooterSection />
      <BackToTop />
    </div>
  );
}
