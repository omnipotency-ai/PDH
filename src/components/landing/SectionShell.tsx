import { motion } from "motion/react";
import type { ReactNode } from "react";
import { fadeUp, viewportOnce } from "@/lib/motionVariants";
import { cn } from "@/lib/utils";

interface SectionShellProps {
  id?: string;
  children: ReactNode;
  className?: string;
  /** Accent color applied as a faint radial glow behind the section */
  accent?: string;
}

export function SectionShell({ id, children, className, accent }: SectionShellProps) {
  return (
    <motion.section
      id={id}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      className={cn(
        "relative flex h-dvh snap-start flex-col overflow-hidden px-4 py-12 md:py-20",
        className,
      )}
    >
      {accent && (
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: `radial-gradient(ellipse 600px 400px at 50% 30%, ${accent}15, transparent 70%)`,
          }}
          aria-hidden="true"
        />
      )}
      <div className="mx-auto my-auto w-full max-w-6xl">{children}</div>
    </motion.section>
  );
}
