import { Activity, Soup, Sparkles, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { PhoneFrame } from "@/components/landing/PhoneFrame";
import { SectionShell } from "@/components/landing/SectionShell";
import { CHAKRA } from "@/lib/chakraColors";
import { fadeUp, viewportOnce } from "@/lib/motionVariants";

const FEATURES = [
  {
    icon: Soup,
    title: "AI-Powered Food Logging",
    description:
      "Describe your meals in natural language or snap a photo. Our AI parses ingredients, portions, and preparation methods automatically.",
    screenshot: "/tracking-mobile-view.png",
    screenshotAlt: "Food logging screenshot",
    accent: "#a78bfa",
  },
  {
    icon: Activity,
    title: "Bristol Scale Tracking",
    description:
      "Quick, visual Bristol Stool Scale logging with timestamps. Build a detailed map of your digestive responses and identify suspected culprits behind discomfort.",
    screenshot: "/bowel-movement-mobile.png",
    screenshotAlt: "Bristol scale tracking screenshot",
    accent: "#10b981",
  },
  {
    icon: Sparkles,
    title: "Dr. Poo AI Analysis",
    description:
      "Your personal AI gastroenterologist reviews your logs, identifies patterns, and generates personalised meal plans based on your safe foods and recovery goals.",
    screenshot: "/dr-poo-mobile.png",
    screenshotAlt: "AI analysis screenshot",
    accent: "#a78bfa",
  },
  {
    icon: TrendingUp,
    title: "Pattern Recognition",
    description:
      "Visualize correlations between meals and digestive outcomes. Build a personalised safe food database that grows as your gut heals and adapts.",
    screenshot: "/patterns-mobile.png",
    screenshotAlt: "Pattern recognition screenshot",
    accent: "#eb77b0",
  },
];

export function FeaturesSection() {
  return (
    <>
      {/* Section 1: Heading + AI-Powered Food Logging */}
      <SectionShell id="features" accent={CHAKRA.crown}>
        <div className="mb-4 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#a78bfa]">
            Features
          </p>
          <h2 className="font-display text-2xl font-extrabold text-[var(--text)] md:text-3xl">
            All You Need to Heal Smarter
          </h2>
        </div>

        <div className="flex flex-col items-center gap-3 md:flex-row md:justify-center md:gap-12">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="shrink-0"
          >
            <PhoneFrame glowColor={FEATURES[0].accent}>
              <img
                src={FEATURES[0].screenshot}
                alt={FEATURES[0].screenshotAlt}
                className="h-full w-full object-contain object-top"
                loading="lazy"
              />
            </PhoneFrame>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="text-center md:text-left"
          >
            <div className="mb-2 flex items-center justify-center gap-2 md:justify-start">
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${FEATURES[0].accent}1e` }}
              >
                <Soup className="h-5 w-5" style={{ color: FEATURES[0].accent }} />
              </div>
              <h3
                className="font-display text-xs font-bold uppercase tracking-[0.25em]"
                style={{ color: FEATURES[0].accent }}
              >
                {FEATURES[0].title}
              </h3>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
              {FEATURES[0].description}
            </p>
          </motion.div>
        </div>
      </SectionShell>

      {/* Sections 2-4: Individual feature snap sections */}
      {FEATURES.slice(1).map((feature) => {
        const Icon = feature.icon;
        return (
          <section
            key={feature.title}
            className="relative flex h-dvh snap-start flex-col items-center justify-center overflow-hidden px-4 py-12"
          >
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 md:flex-row md:justify-center md:gap-12">
              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
                className="shrink-0"
              >
                <PhoneFrame glowColor={feature.accent}>
                  <img
                    src={feature.screenshot}
                    alt={feature.screenshotAlt}
                    className="h-full w-full object-contain object-top"
                    loading="lazy"
                  />
                </PhoneFrame>
              </motion.div>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
                className="text-center md:text-left"
              >
                <div className="mb-2 flex items-center justify-center gap-2 md:justify-start">
                  <div
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: `${feature.accent}1e` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: feature.accent }} />
                  </div>
                  <h3
                    className="font-display text-xs font-bold uppercase tracking-[0.25em]"
                    style={{ color: feature.accent }}
                  >
                    {feature.title}
                  </h3>
                </div>
                <p className="max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
                  {feature.description}
                </p>
              </motion.div>
            </div>
          </section>
        );
      })}
    </>
  );
}
