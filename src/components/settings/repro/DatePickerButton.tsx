import { format, isValid, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatLocalDateKey } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

interface DatePickerButtonProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function DatePickerButton({
  value,
  placeholder,
  onChange,
  disabled = false,
}: DatePickerButtonProps) {
  const parsedDate = (() => {
    if (!value) return undefined;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
  })();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-xl border border-[var(--section-repro-border)] bg-[var(--surface-0)] px-2.5 text-left text-xs text-[var(--text)] transition-colors outline-none hover:border-[var(--section-repro)]/50 focus-visible:border-[var(--section-repro)]/60 focus-visible:ring-[3px] focus-visible:ring-[var(--section-repro)]/20 disabled:cursor-not-allowed disabled:opacity-50",
            !parsedDate && "text-[var(--text-faint)]",
          )}
          aria-label={placeholder}
        >
          <span className="truncate">
            {parsedDate ? format(parsedDate, "dd/MM/yyyy") : placeholder}
          </span>
          <CalendarDays className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label={placeholder} className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsedDate}
          defaultMonth={parsedDate ?? new Date()}
          onSelect={(date) => onChange(date ? formatLocalDateKey(date) : "")}
        />
      </PopoverContent>
    </Popover>
  );
}
