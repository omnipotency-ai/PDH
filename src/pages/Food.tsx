import { useState } from "react";

import { RegistryTable } from "@/components/food/RegistryTable";
import { ZonesTable } from "@/components/food/ZonesTable";

// ── Types ─────────────────────────────────────────────────────────────────────

type FoodTab = "registry" | "zones" | "portions";

interface TabConfig {
  id: FoodTab;
  label: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: ReadonlyArray<TabConfig> = [
  { id: "registry", label: "Registry" },
  { id: "zones", label: "Zones" },
  { id: "portions", label: "Portions" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function FoodPage() {
  const [activeTab, setActiveTab] = useState<FoodTab>("zones");

  return (
    <div data-slot="food-page" className="flex flex-col gap-4 pb-20">
      <h1 className="font-display text-2xl font-bold tracking-tight text-(--section-summary)">
        Food Database
      </h1>

      {/* Tab bar — pill-tab pattern matching FoodFilterView */}
      <div
        data-slot="food-tabs"
        className="flex gap-1 rounded-xl bg-[var(--surface-2)] p-1"
        role="tablist"
        aria-label="Food database tabs"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`food-panel-${tab.id}`}
              className={`flex flex-1 items-center justify-center rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-[var(--surface-3)] text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <div
        id={`food-panel-${activeTab}`}
        role="tabpanel"
        aria-label={`${activeTab} tab content`}
      >
        {activeTab === "registry" && <RegistryTable />}
        {activeTab === "zones" && <ZonesTable />}
        {activeTab === "portions" && <TabPlaceholder tab={activeTab} />}
      </div>
    </div>
  );
}

// ── TabPlaceholder ────────────────────────────────────────────────────────────

function TabPlaceholder({ tab }: { tab: FoodTab }) {
  const messages: Record<FoodTab, string> = {
    registry: "Registry table coming soon.",
    zones: "Zones view coming soon.",
    portions: "Portions editor coming soon.",
  };

  return <p className="text-sm text-(--text-muted)">{messages[tab]}</p>;
}
