/**
 * FilterValueCombobox — searchable multi-select dropdown for filter values.
 *
 * Renders a clickable value display that opens a dropdown with a search field
 * and checkboxes. Built without cmdk since it's not in the project deps.
 */

import { Check, ChevronDown, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { FilterOption, FilterType } from "./filterTypes";
import { FILTER_VALUE_OPTIONS, getValueDisplayLabel } from "./filterTypes";

interface FilterValueComboboxProps {
  filterType: FilterType;
  values: string[];
  onChange: (values: string[]) => void;
}

export function FilterValueCombobox({ filterType, values, onChange }: FilterValueComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const options = FILTER_VALUE_OPTIONS[filterType];

  const filteredOptions = useMemo(() => {
    if (search.length === 0) return options;
    const query = search.toLowerCase();
    return options.filter((opt) => {
      const label = opt.label ?? opt.name;
      return label.toLowerCase().includes(query) || opt.name.toLowerCase().includes(query);
    });
  }, [options, search]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to let the dropdown render
      const timer = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const toggleValue = useCallback(
    (name: string) => {
      if (values.includes(name)) {
        onChange(values.filter((v) => v !== name));
      } else {
        onChange([...values, name]);
      }
    },
    [values, onChange],
  );

  // Close on Escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearch("");
    }
  }, []);

  const displayText = getValuesDisplayText(filterType, values);

  return (
    <div ref={containerRef} data-slot="filter-value-combobox" className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-0.5 rounded px-1 py-0.5 text-xs text-[var(--text)]",
          "hover:bg-[var(--surface-3)] focus:outline-none",
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Select values for ${filterType} filter`}
      >
        <span className="max-w-[120px] truncate">{displayText}</span>
        <ChevronDown size={10} className="shrink-0 opacity-50" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full left-0 z-[100] mt-1 min-w-[180px] max-w-[260px]",
            "rounded-lg border border-[var(--border)] bg-[var(--surface-1)] shadow-lg",
          )}
          onKeyDown={handleKeyDown}
          role="listbox"
          aria-multiselectable="true"
          aria-label={`${filterType} filter values`}
        >
          {/* Search input */}
          {options.length > 5 && (
            <div className="border-b border-[var(--border)] p-2">
              <div className="relative">
                <Search
                  size={12}
                  className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[var(--text-faint)]"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className={cn(
                    "w-full rounded border border-[var(--border)] bg-[var(--surface-2)] py-1 pr-2 pl-7 text-xs text-[var(--text)]",
                    "placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none",
                  )}
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-[var(--text-faint)]">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <ComboboxOption
                  key={option.name}
                  option={option}
                  isSelected={values.includes(option.name)}
                  onToggle={() => toggleValue(option.name)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Combobox Option ────────────────────────────────────────────────────────

function ComboboxOption({
  option,
  isSelected,
  onToggle,
}: {
  option: FilterOption;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
        "hover:bg-[var(--surface-2)] focus:bg-[var(--surface-2)] focus:outline-none",
        isSelected && "text-[var(--text)]",
        !isSelected && "text-[var(--text-muted)]",
      )}
    >
      <span
        className={cn(
          "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
          isSelected
            ? "border-[var(--primary)] bg-[var(--primary)] text-white"
            : "border-[var(--border)]",
        )}
      >
        {isSelected && <Check size={10} />}
      </span>
      <span className="truncate">{option.label ?? option.name}</span>
    </button>
  );
}

// ── Display Helpers ────────────────────────────────────────────────────────

function getValuesDisplayText(filterType: FilterType, values: string[]): string {
  if (values.length === 0) return "select...";
  if (values.length === 1) return getValueDisplayLabel(filterType, values[0]);
  if (values.length === 2) {
    return values.map((v) => getValueDisplayLabel(filterType, v)).join(", ");
  }
  return `${getValueDisplayLabel(filterType, values[0])} +${values.length - 1}`;
}
