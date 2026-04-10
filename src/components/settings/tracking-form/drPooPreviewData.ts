import { BadgeCheck, Moon, Target } from "lucide-react";
import type { ElementType } from "react";
import { ReassuringCoach } from "@/components/ui/Reassuring";
import type {
  DrPooPreset,
  OutputLength,
  OutputStyle,
  ToneFamiliarity,
  ToneVocabulary,
} from "@/types/domain";

export type PresetCard = {
  value: Exclude<DrPooPreset, "custom">;
  label: string;
  description: string;
  Icon: ElementType<{ className?: string }>;
};

export type AxisOption<T extends string> = {
  value: T;
  label: string;
  description: string;
};

export const FAMILIARITY_OPTIONS = [
  {
    value: "reserved",
    label: "Reserved",
    description: "Detached and matter-of-fact, with very little emotional colouring.",
  },
  {
    value: "steady",
    label: "Steady",
    description: "Calm and respectful, like a clinician keeping things grounded.",
  },
  {
    value: "familiar",
    label: "Familiar",
    description: "Direct and human, like someone who knows your history well.",
  },
  {
    value: "close",
    label: "Close",
    description: "Warm, candid, and conversational without becoming fluffy.",
  },
] as const satisfies readonly AxisOption<ToneFamiliarity>[];

export const VOCABULARY_OPTIONS = [
  {
    value: "everyday",
    label: "Everyday",
    description: "Plain words with minimal jargon.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Everyday language plus key clinical terms.",
  },
  {
    value: "clinical",
    label: "Clinical",
    description: "Medical terminology with precision.",
  },
] as const satisfies readonly AxisOption<ToneVocabulary>[];

export const STYLE_OPTIONS = [
  {
    value: "prose",
    label: "Prose",
    description: "Paragraph-led responses.",
  },
  {
    value: "blended",
    label: "Blended",
    description: "Balanced paragraphs and bullet points.",
  },
  {
    value: "structured",
    label: "Structured",
    description: "Compact, list-driven responses.",
  },
] as const satisfies readonly AxisOption<OutputStyle>[];

export const LENGTH_OPTIONS = [
  {
    value: "brief",
    label: "Brief",
    description: "Only essential points.",
  },
  {
    value: "standard",
    label: "Standard",
    description: "Balanced depth and speed.",
  },
  {
    value: "detailed",
    label: "Detailed",
    description: "Full reasoning and extra context.",
  },
] as const satisfies readonly AxisOption<OutputLength>[];

export const PRESET_CARDS: PresetCard[] = [
  {
    value: "reassuring_coach",
    label: "Reassuring Coach",
    description: "Warm and encouraging, with grounded explanations and a human tone.",
    Icon: ReassuringCoach,
  },
  {
    value: "clear_clinician",
    label: "Clear Clinician",
    description: "Compact, professional, and clinical without sounding robotic.",
    Icon: BadgeCheck,
  },
  {
    value: "data_deep_dive",
    label: "Data Deep Dive",
    description: "Evidence-first, lower warmth, and fuller reasoning when the data matters.",
    Icon: Target,
  },
  {
    value: "quiet_checkin",
    label: "Quiet Check-In",
    description: "Plainspoken and calm, closer to a thoughtful check-in than a pep talk.",
    Icon: Moon,
  },
];
