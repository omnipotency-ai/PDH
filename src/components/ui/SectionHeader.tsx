import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  /** CSS variable for the section color (e.g., "var(--section-fluid)") */
  color: string;
  /** CSS variable for the section muted background (e.g., "var(--section-fluid-muted)") */
  mutedColor: string;
  /** Optional className override via cn() */
  className?: string;
  /** Optional trailing content (badges, counters, buttons) */
  children?: React.ReactNode;
}

/**
 * Consistent section header with icon and title.
 * Uses the section-header, section-icon, and section-title CSS classes.
 */
export function SectionHeader({
  icon: Icon,
  title,
  color,
  mutedColor,
  className,
  children,
}: SectionHeaderProps) {
  return (
    <div data-slot="section-header" className={cn("section-header", className)}>
      <div className="section-icon" style={{ backgroundColor: mutedColor }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <span className="section-title font-sketch" style={{ color }}>
        {title}
      </span>
      {children}
    </div>
  );
}
