let audioCtx: AudioContext | null = null;

// Clean up AudioContext on page unload to release audio resources.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  });
}

// Musical note frequencies (Hz)
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1567.98;
const B4 = 987.77;

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new AudioContext();
    return audioCtx;
  } catch {
    return null;
  }
}

function scheduleNotes(ctx: AudioContext, variant: SoundVariant): void {
  const now = ctx.currentTime;

  switch (variant) {
    case "ding": {
      // Warm major chord: C5 + E5
      playNote(ctx, C5, now, 0.3, 0.15, "sine");
      playNote(ctx, E5, now, 0.3, 0.1, "sine");
      break;
    }
    case "chime": {
      // Ascending arpeggio: C5 → E5 → G5
      playNote(ctx, C5, now, 0.2, 0.12, "sine");
      playNote(ctx, E5, now + 0.08, 0.2, 0.1, "sine");
      playNote(ctx, G5, now + 0.16, 0.3, 0.08, "sine");
      break;
    }
    case "sparkle": {
      // Short high sparkle: C6 → E6 → G6
      playNote(ctx, C6, now, 0.15, 0.08, "sine");
      playNote(ctx, E6, now + 0.05, 0.15, 0.06, "sine");
      playNote(ctx, G6, now + 0.1, 0.2, 0.05, "sine");
      break;
    }
    case "milestone": {
      // Celebratory fanfare: C5 → E5 → G5 → C6
      playNote(ctx, C5, now, 0.25, 0.15, "triangle");
      playNote(ctx, E5, now + 0.12, 0.25, 0.12, "triangle");
      playNote(ctx, G5, now + 0.24, 0.25, 0.1, "triangle");
      playNote(ctx, C6, now + 0.36, 0.4, 0.15, "triangle");
      // Add shimmer on top
      playNote(ctx, G6, now + 0.36, 0.3, 0.04, "sine");
      break;
    }
    case "goalComplete": {
      // Satisfying two-tone completion sound: E5 → B4 + E6
      playNote(ctx, E5, now, 0.15, 0.12, "sine");
      playNote(ctx, B4, now + 0.1, 0.35, 0.15, "sine");
      playNote(ctx, E6, now + 0.1, 0.35, 0.06, "sine");
      break;
    }
  }
}

function playNote(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  gain: number,
  type: OscillatorType = "sine",
): void {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

type SoundVariant = "ding" | "chime" | "sparkle" | "milestone" | "goalComplete";

export function playSound(variant: SoundVariant): void {
  // Respect prefers-reduced-motion: skip sound entirely if user prefers reduced motion.
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    void ctx
      .resume()
      .then(() => {
        scheduleNotes(ctx, variant);
      })
      .catch((err) => {
        console.warn("AudioContext resume failed:", err);
      });
    return;
  }

  scheduleNotes(ctx, variant);
}
