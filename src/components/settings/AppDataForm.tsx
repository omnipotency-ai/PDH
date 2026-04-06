import { useCallback } from "react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { useApiKeyContext } from "@/contexts/ApiKeyContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useAiPreferences, useHealthProfile, useUnitSystem } from "@/hooks/useProfile";
import { getErrorMessage } from "@/lib/errors";
import {
  useDeleteAllSyncedData,
  useExportBackup,
  useImportBackup,
  useSyncedLogCount,
} from "@/lib/sync";
import type { HealthProfile } from "@/types/domain";
import {
  ArtificialIntelligenceSection,
  CloudProfileSection,
  DataManagementSection,
  UnitsSection,
  useAppDataFormController,
} from "./app-data-form";
import { DeleteConfirmDrawer } from "./DeleteConfirmDrawer";

const LOCAL_APP_STORAGE_KEYS = [
  "patterns-smart-views-v1",
  "patterns-filter-state-v1",
  "track.pending-food-draft",
  "caca-custom-food-presets-v1",
] as const;
const LOCAL_APP_STORAGE_PREFIXES = ["quick-capture-destructive-rollover:"] as const;

export function AppDataForm() {
  const logsCount = useSyncedLogCount();
  const { isLoading: isProfileLoading, patchProfile } = useProfileContext();
  const { apiKey, updateKey: setOpenAiApiKey, removeKey } = useApiKeyContext();
  const openAiApiKey = apiKey ?? "";
  const { unitSystem, setUnitSystem } = useUnitSystem();
  const { healthProfile, setHealthProfile: setFullHealthProfile } = useHealthProfile();
  const { aiPreferences, setAiPreferences } = useAiPreferences();
  const deleteAllSyncedData = useDeleteAllSyncedData();
  const exportBackup = useExportBackup();
  const importBackup = useImportBackup();

  // The controller expects a partial-update setter matching the old store API.
  // useHealthProfile().setHealthProfile takes a full HealthProfile, so we wrap it.
  const patchHealthProfile = useCallback(
    (updates: Partial<HealthProfile>) => {
      if (!healthProfile) return;
      void setFullHealthProfile({ ...healthProfile, ...updates });
    },
    [healthProfile, setFullHealthProfile],
  );

  const clearLocalData = async () => {
    // Await async IndexedDB operations so failures are not silently swallowed.
    // removeKey() alone is sufficient — it deletes the IndexedDB entry and
    // resets the in-memory state. No separate setOpenAiApiKey("") call needed.
    try {
      await removeKey();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to remove API key from IndexedDB."));
    }

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

  // Hooks must be called unconditionally, so the controller receives
  // healthProfile (null until loaded). The controller guards its own mutations
  // against null. Form sections are blocked in the JSX below until loaded.
  const {
    profileStatus,
    isDeletingData,
    deleteError,
    isImportingBackup,
    isDeleteDrawerOpen,
    setIsDeleteDrawerOpen,
    pendingImportFile,
    setPendingImportFile,
    confirmImport,
    showFactoryResetConfirm,
    setShowFactoryResetConfirm,
    confirmFactoryReset,
    handleExport,
    handleImportBackup,
    handleResetFactorySettings,
    handleDeleteAccountData,
  } = useAppDataFormController({
    deleteAllSyncedData,
    clearLocalData,
    exportBackup,
    importBackup,
    healthProfile,
    setHealthProfile: patchHealthProfile,
    patchProfile,
  });

  return (
    <div className="space-y-4">
      <UnitsSection unitSystem={unitSystem} onUnitSystemChange={setUnitSystem} />

      <Separator />

      <CloudProfileSection isLoading={isProfileLoading} />

      <Separator />

      <DataManagementSection
        logsCount={logsCount ?? 0}
        isImportingBackup={isImportingBackup}
        onExportBackup={() => handleExport("backup-json")}
        onExportLogsCsv={() => handleExport("logs-csv")}
        onImportBackup={handleImportBackup}
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
            Your logged data will not be deleted, but all preferences (habits, units, AI settings,
            health profile) will be reset to their defaults.
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

      {/* State-driven import confirmation replaces window.confirm */}
      {pendingImportFile && (
        <div
          role="alertdialog"
          aria-live="assertive"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-[var(--text)]"
        >
          <p className="mb-2 font-medium text-amber-300">
            Import &quot;{pendingImportFile.name}&quot;?
          </p>
          <p className="mb-3 text-[var(--text-muted)]">
            This will replace the current cloud data for your account with the backup.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1 font-medium text-amber-300 hover:bg-amber-500/25"
              onClick={() => void confirmImport()}
              disabled={isImportingBackup}
            >
              {isImportingBackup ? "Importing…" : "Yes, import"}
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--section-appdata-border)] px-3 py-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              onClick={() => setPendingImportFile(null)}
              disabled={isImportingBackup}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <Separator />

      <ArtificialIntelligenceSection
        openAiApiKey={openAiApiKey}
        aiModel={aiPreferences.aiModel}
        onApiKeyChange={(value) => void setOpenAiApiKey(value)}
        onAiModelChange={(model) => void setAiPreferences({ aiModel: model })}
      />

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
