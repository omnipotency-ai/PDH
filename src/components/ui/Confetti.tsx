import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  velocityX: number;
  velocityY: number;
  animateRotationDelta: number;
  animateDuration: number;
}

const CONFETTI_EMOJIS = [
  "\u{1F389}",
  "\u2728",
  "\u{1F31F}",
  "\u{1F4AB}",
  "\u2B50",
  "\u{1F38A}",
  "\u{1F308}",
  "\u{1F382}",
  "\u{1FA85}",
  "\u{1F973}",
];

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function createParticles(count: number, originX: number, originY: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
    x: originX,
    y: originY,
    rotation: randomBetween(0, 360),
    scale: randomBetween(0.6, 1.2),
    velocityX: randomBetween(-200, 200),
    velocityY: randomBetween(-400, -150),
    animateRotationDelta: randomBetween(-180, 180),
    animateDuration: randomBetween(1.2, 2.0),
  }));
}

export function ConfettiBurst({
  active,
  onComplete,
  originX,
  originY,
  count = 35,
}: {
  active: boolean;
  onComplete: () => void;
  originX?: number;
  originY?: number;
  count?: number;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const mountedRef = useRef(true);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (active) {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Skip particle generation entirely for reduced motion
      if (prefersReducedMotion) {
        onCompleteRef.current();
        return;
      }

      const x = originX ?? window.innerWidth / 2;
      const y = originY ?? window.innerHeight / 2;
      setParticles(createParticles(count, x, y));
      const timer = setTimeout(() => {
        if (!mountedRef.current) return;
        setParticles([]);
        onCompleteRef.current();
      }, 2000);
      return () => clearTimeout(timer);
    }
    setParticles([]);
  }, [active, originX, originY, count]);

  if (particles.length === 0) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 99999,
        overflow: "hidden",
      }}
    >
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{
              x: p.x,
              y: p.y,
              rotate: 0,
              scale: 0,
              opacity: 1,
            }}
            animate={{
              x: p.x + p.velocityX,
              y: p.y + p.velocityY + 600,
              rotate: p.rotation + p.animateRotationDelta,
              scale: p.scale,
              opacity: 0,
            }}
            transition={{
              duration: p.animateDuration,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            style={{
              position: "absolute",
              fontSize: `${16 + p.scale * 8}px`,
              willChange: "transform, opacity",
            }}
          >
            {p.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
