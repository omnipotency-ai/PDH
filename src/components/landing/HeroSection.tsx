import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ScrollArrow } from "@/components/landing/ScrollArrow";
import { fadeUp, scaleIn, staggerContainer } from "@/lib/motionVariants";

export function HeroSection() {
  return (
    <section className="relative flex h-dvh snap-start items-center overflow-hidden pt-16">
      {/* Enhanced aurora background */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div
          className="absolute inset-0 animate-gradient-flow"
          style={{
            background: `
              radial-gradient(ellipse 700px 700px at 20% 30%, rgba(231,76,60,0.08) 0%, transparent 70%),
              radial-gradient(ellipse 600px 600px at 80% 20%, rgba(45,212,191,0.1) 0%, transparent 70%),
              radial-gradient(ellipse 500px 500px at 60% 70%, rgba(167,139,250,0.08) 0%, transparent 70%),
              radial-gradient(ellipse 400px 400px at 30% 80%, rgba(56,189,248,0.06) 0%, transparent 70%),
              radial-gradient(ellipse 450px 450px at 70% 50%, rgba(255,199,0,0.05) 0%, transparent 70%)
            `,
          }}
        />
      </div>

      <div className="mx-auto grid w-full max-w-6xl md:grid-cols-2 md:items-center md:px-24">
        {/* Left — Logo */}
        <motion.div
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          className="flex justify-center md:justify-start"
        >
          <img
            src="/icons/icon-384x384.png"
            alt="Caca Traca logo"
            width={384}
            height={384}
            className="h-64 w-64 animate-float md:h-[22rem] md:w-[22rem]"
            style={{
              maskImage: "radial-gradient(ellipse 80% 80% at center, black 50%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 80% 80% at center, black 50%, transparent 100%)",
            }}
          />
        </motion.div>

        {/* Right — Content */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="text-center md:text-left"
        >
          <motion.p
            variants={fadeUp}
            className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[#2dd4bf]"
          >
            Anastomosis Recovery
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="mb-4 font-display text-4xl font-extrabold leading-tight tracking-tight text-[var(--text)] md:text-6xl lg:text-7xl"
          >
            Track Your
            <br />
            <span className="bg-gradient-to-r from-[#2dd4bf] via-[#38bdf8] to-[#a78bfa] bg-clip-text text-transparent">
              Recovery
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mb-8 max-w-lg text-base leading-relaxed text-[var(--text-muted)] md:text-lg"
          >
            The intelligent food and digestion tracker for ileostomy & colostomy reversal patients
            navigating food reintroduction. Log meals, track outcomes, and let AI uncover which
            foods work for your healing gut.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-wrap justify-center gap-3 md:justify-start"
          >
            <Link
              to="/"
              className="rounded-lg bg-white/[0.06] px-6 py-3 font-semibold text-[#e8e6e3]/80 transition-all hover:bg-white/[0.12] hover:text-[#e8e6e3]"
            >
              Launch App
            </Link>
            <a
              href="#pricing"
              className="rounded-lg border-2 border-[#2dd4bf] px-6 py-3 font-semibold text-[#2dd4bf] transition-all hover:bg-[#2dd4bf] hover:text-[#080c14]"
            >
              Become a Beta Tester
            </a>
          </motion.div>
        </motion.div>
      </div>

      <ScrollArrow />
    </section>
  );
}
