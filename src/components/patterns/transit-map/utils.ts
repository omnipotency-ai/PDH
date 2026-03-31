import type { MainCategory } from "@/data/transitData";
import type { StatusCounts } from "./types";

export function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function makeStatusCounts(): StatusCounts {
  return { safe: 0, testing: 0, watch: 0, avoid: 0, untested: 0 };
}

export function distribute(start: number, end: number, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(start + end) / 2];
  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
}

export function getInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export function getCategoryShortLabel(category: MainCategory): string {
  switch (category.id) {
    case "carbs":
      return "Carbs";
    case "proteins":
      return "Protein";
    case "fats":
      return "Fats";
    case "seasoning":
      return "Spice";
    default:
      return category.name;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
