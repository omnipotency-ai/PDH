import { useUser } from "@clerk/clerk-react";
import { CircularProgressRing } from "@/components/track/nutrition/CircularProgressRing";
import { useNutritionData } from "@/hooks/useNutritionData";

function getTimeOfDayGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "there";
}

function SummaryBar({
  label,
  consumed,
  goal,
  unit,
  color,
}: {
  label: string;
  consumed: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const safeGoal = goal > 0 ? goal : 1;
  const progress = Math.min(consumed / safeGoal, 1);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--text-faint)">
          {label}
        </span>
        <span className="text-sm font-medium tabular-nums text-(--text-muted)">
          {consumed} / {goal} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${Math.round(progress * 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useUser();
  const { totalCaloriesToday, totalFluidsMl, calorieGoal, fluidGoal } = useNutritionData();
  const greeting = getTimeOfDayGreeting(new Date().getHours());
  const firstName = getDisplayName(user?.firstName);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-(--text-faint)">
          Home
        </p>
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-(--text)">
            {greeting}, {firstName}
          </h1>
          <p className="max-w-prose text-sm text-(--text-muted)">
            Your live nutrition summary updates from today&apos;s logs so you can see calories and
            fluids at a glance before logging the next meal.
          </p>
        </div>
      </section>

      <section className="glass-card space-y-4 p-4 sm:p-5" aria-label="Today nutrition summary">
        <div className="flex items-center gap-4">
          <div className="flex justify-center sm:justify-start">
            <CircularProgressRing
              value={totalCaloriesToday}
              goal={calorieGoal}
              color="var(--orange)"
              size={112}
              strokeWidth={10}
              ariaLabel={`Calories: ${totalCaloriesToday} of ${calorieGoal} kilocalories`}
              unitLabel="kcal"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <SummaryBar
              label="Calories"
              consumed={totalCaloriesToday}
              goal={calorieGoal}
              unit="kcal"
              color="var(--orange)"
            />
            <SummaryBar
              label="Fluids"
              consumed={totalFluidsMl}
              goal={fluidGoal}
              unit="ml"
              color="var(--fluid)"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
