import { FlaskConical } from "lucide-react";
import { motion } from "motion/react";
import { SectionShell } from "@/components/landing/SectionShell";
import { WaitlistForm } from "@/components/landing/WaitlistForm";
import { CHAKRA } from "@/lib/chakraColors";
import { fadeUp, viewportOnce } from "@/lib/motionVariants";

export function BetaTestSection() {
  return (
    <SectionShell id="waitlist" accent={CHAKRA.throat}>
      <div className="mb-3 text-center">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-[#38bdf8]">
          Beta Testing
        </p>
        <h2 className="mb-2 font-display text-3xl font-extrabold text-[var(--text)] md:text-4xl">
          Help Shape the App
        </h2>
      </div>

      {/* Beta info blurb */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="mx-auto mb-6 max-w-xl"
      >
        <div className="flex items-start gap-3 rounded-xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.04] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#38bdf8]/10">
            <FlaskConical className="h-5 w-5 text-[#38bdf8]" />
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-muted)]">
            Caca Traca is a working product in active beta. The more it's used, the more edge cases
            we discover and fix. When you hit a snag, you get direct access to the founder and
            developer for support. Request Features and more.
          </p>
        </div>
      </motion.div>

      {/* CTA button */}
      <div className="mx-auto mb-6 flex max-w-xl flex-wrap justify-center gap-3">
        <a
          href="#pricing"
          className="rounded-lg bg-[#38bdf8] px-6 py-3 font-semibold text-[#04091b] transition-all hover:bg-[#7dd3fc]"
        >
          Become a Beta Tester
        </a>
      </div>

      {/* Contact form */}
      <div id="waitlist-form" className="mx-auto max-w-xl">
        <WaitlistForm />
      </div>
    </SectionShell>
  );
}
