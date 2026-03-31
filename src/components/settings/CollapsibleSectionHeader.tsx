import { ChevronRight } from "lucide-react";
import { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--section-health)]">
          {title}
        </p>
        <button
          type="button"
          aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--section-health)] hover:bg-[var(--section-health-muted)]"
        >
          <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        </button>
      </div>
      {description && <p className="text-[10px] text-[var(--text-faint)]">{description}</p>}
      {isOpen && children}
    </div>
  );
}
