import { motion } from "motion/react";
import { SectionShell } from "@/components/landing/SectionShell";
import { CHAKRA } from "@/lib/chakraColors";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motionVariants";

const challenges = [
  {
    image: "/identifying-food-triggers.png",
    title: "Identifying Food Triggers.",
    description:
      "Your gut reacts unpredictably after surgery. Without precise tracking, pinpointing foods that cause discomfort is impossible.",
  },
  {
    image: "/overcoming-memory.png",
    title: "Overcoming Memory Lapses.",
    description:
      "Recalling meals and symptoms from last week is difficult and unreliable, making it hard to find patterns.",
  },
  {
    image: "/break-the-cycle.png",
    title: "Breaking the Cycle of Trial & Error.",
    description: "Recovery without data is a frustrating, months-long process of guesswork.",
  },
];

export function ProblemSection() {
  return (
    <SectionShell id="problem" accent={CHAKRA.root}>
      {/* Header */}
      <div className="mb-6 text-center">
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.25em] text-[#E8613A]">
          The Challenge
        </p>
        <h2 className="font-display mx-auto max-w-lg text-3xl leading-[1.15] font-extrabold text-(--text) md:text-5xl">
          Eating after surgery shouldn&rsquo;t be Russian Roulette.
        </h2>
      </div>

      {/* Challenge cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="mx-auto flex max-w-2xl flex-col gap-3"
      >
        {challenges.map((item) => (
          <motion.div
            key={item.title}
            variants={fadeUp}
            className="group relative overflow-hidden rounded-2xl border border-[rgba(232,97,58,0.3)] bg-white/[0.06] p-4 backdrop-blur-sm transition-colors duration-300 hover:border-[rgba(232,97,58,0.45)] hover:bg-white/[0.1] sm:p-5"
          >
            <div className="flex items-center gap-5 sm:gap-6">
              {/* Illustration */}
              <div
                className="relative shrink-0 overflow-hidden rounded-xl border border-[rgba(232,97,58,0.5)] sm:rounded-2xl"
                style={{
                  boxShadow: "0 0 12px rgba(232,97,58,0.25), 0 0 24px rgba(232,97,58,0.1)",
                }}
              >
                <img src={item.image} alt="" className="h-20 w-20 object-cover sm:h-24 sm:w-24" />
              </div>

              {/* Text */}
              <div className="min-w-0">
                <h3 className="font-display text-lg font-bold text-red-300 sm:text-xl">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[rgba(240,248,255,0.55)] sm:text-[0.94rem]">
                  {item.description}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Bottom CTA banner */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="mx-auto mt-5 max-w-2xl"
      >
        <div className="rounded-2xl bg-gradient-to-br from-[#0c2942] to-[#0a1e33] px-6 py-6 text-center sm:px-10 sm:py-8">
          <p className="text-base leading-relaxed text-[rgba(240,248,255,0.85)] sm:text-lg">
            That&rsquo;s why{" "}
            <span className="font-bold text-[#E8613A]">
              Caca Traca uses data to replace guesswork
            </span>
            , giving you clarity and confidence in every meal choice during your anastomosis
            recovery.
          </p>
        </div>
      </motion.div>
    </SectionShell>
  );
}
