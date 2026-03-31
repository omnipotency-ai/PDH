import { motion } from "motion/react";
import { SectionShell } from "@/components/landing/SectionShell";
import { CHAKRA } from "@/lib/chakraColors";
import { fadeUp, viewportOnce } from "@/lib/motionVariants";

export function HowItWorksSection() {
  return (
    <>
      {/* Step 1: Heading + Track Your Life */}
      <SectionShell id="how-it-works" accent={CHAKRA.heart} className="pt-4 pb-2 md:py-20">
        <div className="mb-2 text-center md:mb-6">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-[#2dd4bf]">
            How It Works
          </p>
          <h2 className="font-display text-2xl font-extrabold text-[var(--text)] md:text-4xl">
            Listen to Your Gut
            <br />
            to Eat Without Fear
          </h2>
        </div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mx-auto max-h-[72vh] w-full rounded-2xl md:max-w-sm"
        >
          <img
            src="/step1.png"
            alt="Step 1: Track Your Life — Food, fluids, stimulants, sleep, activity, vices. No judgement. Just data."
            className="w-full object-contain object-top"
            loading="lazy"
          />
        </motion.div>
      </SectionShell>

      {/* Step 2: See the Connections */}
      <section className="relative flex h-dvh snap-start flex-col items-center justify-center overflow-hidden">
        <div className="mx-auto flex w-full flex-col items-center gap-5 md:max-w-sm">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="max-h-[75vh] w-full overflow-hidden rounded-2xl"
          >
            <img
              src="/step2.png"
              alt="Step 2: See the Connections — AI correlates what goes in with what comes out."
              className="w-full object-cover object-top"
              loading="lazy"
            />
          </motion.div>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="max-w-sm text-left text-sm leading-relaxed text-[var(--text-muted)]"
          >
            Every trip to the toilet brings fear. If you can even reach the toilet. Caca Traca's AI
            Dr Poo helps you see exactly which foods cause which outcomes — replacing dread with
            confidence, one safe meal at a time.
          </motion.p>
        </div>
      </section>

      {/* Step 3: Eat With Confidence (full image) */}
      <section className="relative flex h-dvh snap-start flex-col items-center justify-center overflow-hidden px-1 py-0">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mx-auto max-w-full md:max-w-sm"
        >
          <img
            src="/cacatraca_step3.png"
            alt="Step 3: Eat With Confidence — Your AI builds your personal safe food list."
            className="max-h-[85vh] w-full rounded-2xl object-cover"
            loading="lazy"
          />
        </motion.div>
      </section>
    </>
  );
}
