import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";

export function ScrollArrow() {
  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.5, duration: 0.6 }}
    >
      <a
        href="#problem"
        aria-label="Scroll to next section"
        className="flex flex-col items-center gap-1 text-[var(--text-faint)] transition-colors hover:text-[var(--teal)]"
      >
        <span className="text-xs uppercase tracking-widest">Scroll</span>
        <ChevronDown className="h-5 w-5 animate-bounce-down" />
      </a>
    </motion.div>
  );
}
