import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useUnitSystem } from "@/hooks/useProfile";
import { getErrorMessage } from "@/lib/errors";
import { THEME_STORAGE_KEY } from "@/lib/storageKeys";
import { useDeleteAllSyncedData, useExportBackup, useSyncedLogCount } from "@/lib/sync";
import {
  DataManagementSection,
  UnitsSection,
  useAppDataFormController,
} from "./app-data-form";
import { DeleteConfirmDrawer } from "./DeleteConfirmDrawer";

const LOCAL_APP_STORAGE_KEYS = [
  "patterns-smart-views-v1",
  "patterns-filter-state-v1",
  "track.pending-food-draft",
  THEME_STORAGE_KEY,
] as const;
const LOCAL_APP_STORAGE_PREFIXES = ["quick-capture-destructive-rollover:"] as const;

export function AppDataForm() {
  const logsCount = useSyncedLogCount();
  const { patchProfile } = useProfileContext();
  const { unitSystem, setUnitSystem } = useUnitSystem();
  const deleteAllSyncedData = useDeleteAllSyncedData();
  const exportBackup = useExportBackup();

  const clearLocalData = async () => {
    if (typeof window === "undefined") return;

    try {
      for (const key of LOCAL_APP_STORAGE_KEYS) {
        window.localStorage.removeItem(key);
      }

      const prefixedKeys: string[] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) continue;
        if (LOCAL_APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
          prefixedKeys.push(key);
        }
      }
      for (const key of prefixedKeys) {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to clear localStorage."));
    }
  };

  const {
    profileStatus,
    isDeletingData,
    deleteError,
    isDeleteDrawerOpen,
    setIsDeleteDrawerOpen,
    showFactoryResetConfirm,
    setShowFactoryResetConfirm,
    confirmFactoryReset,
    handleExport,
    handleResetFactorySettings,
    handleDeleteAccountData,
  } = useAppDataFormController({
    deleteAllSyncedData,
    clearLocalData,
    exportBackup,
    patchProfile,
  });

  return (
    <div className="space-y-4">
      <UnitsSection unitSystem={unitSystem} onUnitSystemChange={setUnitSystem} />

      <Separator />

      <DataManagementSection
        logsCount={logsCount ?? 0}
        onExportBackup={() => handleExport("export-json")}
        onExportLogsCsv={() => handleExport("logs-csv")}
        onResetFactorySettings={handleResetFactorySettings}
        onOpenDeleteDrawer={() => setIsDeleteDrawerOpen(true)}
      />

      {/* State-driven factory reset confirmation replaces window.confirm */}
      {showFactoryResetConfirm && (
        <div
          role="alertdialog"
          aria-live="assertive"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-[var(--text)]"
        >
          <p className="mb-2 font-medium text-amber-300">Reset all settings to factory defaults?</p>
          <p className="mb-3 text-[var(--text-muted)]">
            Your logged data will not be deleted, but habits, units, Dr. Poo preferences, and
            health details will reset to their defaults.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1 font-medium text-amber-300 hover:bg-amber-500/25"
              onClick={() => void confirmFactoryReset()}
            >
              Yes, reset
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--section-appdata-border)] px-3 py-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              onClick={() => setShowFactoryResetConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <Separator />

      {!!profileStatus && <p className="text-[10px] text-[var(--text-faint)]">{profileStatus}</p>}

      <DeleteConfirmDrawer
        open={isDeleteDrawerOpen}
        onOpenChange={setIsDeleteDrawerOpen}
        onConfirm={handleDeleteAccountData}
        isDeleting={isDeletingData}
        {...(deleteError !== null && { errorMessage: deleteError })}
      />
    </div>
  );
}
