import { cn } from "@/lib/utils";
import type { OutputLength } from "@/types/domain";
import { LENGTH_LABELS, type PreviewText } from "./drPooPreviewData";

// ── Length tab bar ───────────────────────────────────────────────────────────

const LENGTH_TAB_VALUES: readonly OutputLength[] = ["concise", "standard", "detailed"] as const;

export function LengthTabBar({
  value,
  onChange,
}: {
  value: OutputLength;
  onChange: (next: OutputLength) => void;
}) {
  return (
    <fieldset
      data-slot="length-tab-bar"
      aria-label="Detail level"
      className="inline-flex rounded-md border border-sky-400/25 bg-[var(--surface-2)] p-0.5"
    >
      {LENGTH_TAB_VALUES.map((length) => (
        <button
          key={length}
          type="button"
          aria-pressed={value === length}
          onClick={() => onChange(length)}
          className={cn(
            "rounded-[3px] px-2.5 py-1 text-[10px] font-medium transition-colors",
            value === length
              ? "bg-sky-400/20 text-[var(--text)]"
              : "text-[var(--text-faint)] hover:text-[var(--text-muted)]",
          )}
        >
          {LENGTH_LABELS[length]}
        </button>
      ))}
    </fieldset>
  );
}

// ── Preview text field ──────────────────────────────────────────────────────

export function PreviewTextField({ text }: { text: string }) {
  // If the text contains bullet markers (lines starting with "- " or "• "),
  // render each line separately so previews accurately show bullet formatting.
  const lines = text.split("\n");
  const hasBullets = lines.some((line) => /^[\u2022-]\s/.test(line.trim()));

  if (!hasBullets) {
    return <p className="text-[10px] text-[var(--text-muted)]">{text}</p>;
  }

  return (
    <ul className="list-none space-y-0.5">
      {lines
        .filter((line) => line.trim().length > 0)
        .map((line, _index) => {
          const trimmed = line.trim().replace(/^[\u2022-]\s*/, "");
          return (
            <li key={trimmed} className="flex gap-1.5 text-[10px] text-[var(--text-muted)]">
              <span className="shrink-0 text-sky-400/60">&bull;</span>
              <span>{trimmed}</span>
            </li>
          );
        })}
    </ul>
  );
}

// ── Preview text block ──────────────────────────────────────────────────────

export function PreviewTextBlock({ preview }: { preview: PreviewText }) {
  return (
    <div className="space-y-2">
      <div className="space-y-1 rounded-md border border-sky-400/25 px-2 py-1.5">
        <p className="text-[10px] font-semibold text-[var(--text)]">Summary</p>
        <PreviewTextField text={preview.summary} />
      </div>

      <div className="space-y-1 rounded-md border border-sky-400/25 px-2 py-1.5">
        <p className="text-[10px] font-semibold text-[var(--text)]">Suggestions</p>
        <PreviewTextField text={preview.suggestions} />
      </div>

      <div className="space-y-1 rounded-md border border-sky-400/25 px-2 py-1.5">
        <p className="text-[10px] font-semibold text-[var(--text)]">Did you know</p>
        <PreviewTextField text={preview.didYouKnow} />
      </div>
    </div>
  );
}
