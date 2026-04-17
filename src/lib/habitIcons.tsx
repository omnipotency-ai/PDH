import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Beer,
  BookOpen,
  BriefcaseMedical,
  Candy,
  Cigarette,
  Coffee,
  CoffeeIcon,
  CopyCheck,
  Droplets,
  Fish,
  Footprints,
  GlassWater,
  HeartPlus,
  Moon,
  ShowerHead,
  Smile,
  Snowflake,
  SquareCheckBig,
  Tablets,
  Tally5,
  Weight,
} from "lucide-react";
import type { HabitConfig, HabitType } from "@/lib/habitTemplates";

interface HabitIconResult {
  Icon: LucideIcon;
  toneClassName: string;
}

const HABIT_ICON_BY_ID: Record<string, HabitIconResult> = {
  habit_cigarettes: { Icon: Cigarette, toneClassName: "text-gray-400" },
  habit_tina: { Icon: Snowflake, toneClassName: "text-gray-400" },
  habit_water: { Icon: Droplets, toneClassName: "text-sky-400" },
  habit_tea: { Icon: Coffee, toneClassName: "text-sky-400" },
  habit_electrolyte: { Icon: GlassWater, toneClassName: "text-sky-400" },
  habit_confectionery: { Icon: Candy, toneClassName: "text-gray-400" },
  habit_alcohol: { Icon: Beer, toneClassName: "text-gray-400" },
  habit_coffee: { Icon: CoffeeIcon, toneClassName: "text-sky-400" },
  habit_medication: { Icon: Tablets, toneClassName: "text-violet-400" },
  habit_medication_am: { Icon: Tablets, toneClassName: "text-violet-400" },
  habit_medication_pm: { Icon: Tablets, toneClassName: "text-violet-400" },
  habit_medication_night: { Icon: Tablets, toneClassName: "text-violet-400" },
  habit_walking: { Icon: Footprints, toneClassName: "text-teal-400" },
  habit_sleep: { Icon: Moon, toneClassName: "text-violet-400" },
  habit_stretching: {
    Icon: HeartPlus,
    toneClassName: "text-teal-400",
  },
  habit_breathing: { Icon: HeartPlus, toneClassName: "text-teal-400" },
  habit_journaling: { Icon: BookOpen, toneClassName: "text-violet-400" },
  habit_shower: { Icon: ShowerHead, toneClassName: "text-sky-400" },
  habit_brush_teeth: { Icon: Smile, toneClassName: "text-pink-400" },
  habit_halibut: { Icon: Fish, toneClassName: "text-pink-400" },
  habit_wound_dressing_checkbox: {
    Icon: BriefcaseMedical,
    toneClassName: "text-pink-400",
  },
  habit_wound_dressing_count: {
    Icon: BriefcaseMedical,
    toneClassName: "text-pink-400",
  },
};

const HABIT_ICON_BY_TYPE: Record<HabitType, HabitIconResult> = {
  sleep: { Icon: Moon, toneClassName: "text-violet-400" },
  count: { Icon: Tally5, toneClassName: "text-violet-400" },
  activity: { Icon: HeartPlus, toneClassName: "text-teal-400" },
  fluid: { Icon: Droplets, toneClassName: "text-sky-400" },
  destructive: { Icon: AlertTriangle, toneClassName: "text-gray-400" },
  checkbox: { Icon: CopyCheck, toneClassName: "text-violet-400" },
  weight: { Icon: Weight, toneClassName: "text-pink-400" },
};

/** Legacy habit types that may still appear in older data */
const LEGACY_HABIT_ICON_BY_TYPE: Record<string, HabitIconResult> = {
  cigarettes: { Icon: Cigarette, toneClassName: "text-gray-400" },
  rec_drugs: { Icon: Snowflake, toneClassName: "text-gray-400" },
  hydration: { Icon: Droplets, toneClassName: "text-sky-400" },
  confectionery: { Icon: Candy, toneClassName: "text-gray-400" },
  alcohol: { Icon: Beer, toneClassName: "text-gray-400" },
  medication: { Icon: Tablets, toneClassName: "text-violet-400" },
  movement: { Icon: Footprints, toneClassName: "text-teal-400" },
  custom: { Icon: SquareCheckBig, toneClassName: "text-[var(--text-faint)]" },
  recovery: { Icon: BookOpen, toneClassName: "text-violet-400" },
  hygiene: { Icon: ShowerHead, toneClassName: "text-pink-400" },
};

const DEFAULT_HABIT_ICON: HabitIconResult = {
  Icon: SquareCheckBig,
  toneClassName: "text-[var(--text-faint)]",
};

export function getHabitIcon(habit: HabitConfig): HabitIconResult {
  // 1. Exact match by habit ID.
  const byId = HABIT_ICON_BY_ID[habit.id];
  if (byId) return byId;

  // Custom habits intentionally use a generic icon unless they map to a known
  // legacy type. Templates and built-ins carry either a known ID or templateKey.
  const hasTemplateKey =
    typeof habit.templateKey === "string" &&
    habit.templateKey.trim().length > 0;
  if (!hasTemplateKey) {
    const legacyType = LEGACY_HABIT_ICON_BY_TYPE[String(habit.habitType)];
    if (legacyType) return legacyType;
    return DEFAULT_HABIT_ICON;
  }

  // 2. Match by canonical habit type.
  const byType = HABIT_ICON_BY_TYPE[habit.habitType];
  if (byType) return byType;

  // 3. Name-based fallback for custom habits.
  const nameLower = habit.name.toLowerCase();
  if (nameLower.includes("stretch")) {
    return { Icon: HeartPlus, toneClassName: "text-teal-400" };
  }
  if (nameLower.includes("breath")) {
    return { Icon: HeartPlus, toneClassName: "text-teal-400" };
  }
  if (nameLower.includes("weight")) {
    return { Icon: Weight, toneClassName: "text-pink-400" };
  }

  // 4. Legacy habit types (may appear as string values not in HabitType union).
  const legacyType = LEGACY_HABIT_ICON_BY_TYPE[String(habit.habitType)];
  if (legacyType) return legacyType;

  return DEFAULT_HABIT_ICON;
}
