import Papa from "papaparse";
import { useState } from "react";
import { toast } from "sonner";
import { DEFAULT_PROFILE, type PatchProfileArgs } from "@/contexts/ProfileContext";
import { formatLocalDateKey } from "@/lib/dateUtils";
import { getErrorMessage } from "@/lib/errors";
import type { AppBackupPayload } from "@/lib/sync";
import type { HealthProfile } from "@/types/domain";

interface UseAppDataFormControllerArgs {
  deleteAllSyncedData: () => Promise<unknown>;
  clearLocalData: () => Promise<void>;
  exportBackup: () => Promise<AppBackupPayload>;
  // null until Convex has loaded the profile — mutations must not fire
  // with stale defaults while null.
  healthProfile: HealthProfile | null;
  setHealthProfile: (updates: Partial<HealthProfile>) => void;
  /** Patch Convex-backed profile settings to defaults on factory reset. */
  patchProfile: (updates: PatchProfileArgs) => Promise<void>;
}

function getTotalDeleted(result: unknown): number {
  if (typeof result !== "object" || result === null) return 0;
  if (!("totalDeleted" in result)) return 0;
  const value = (result as { totalDeleted?: unknown }).totalDeleted;
  return typeof value === "number" ? value : 0;
}

export function useAppDataFormController({
  deleteAllSyncedData,
  clearLocalData,
  exportBackup,
  healthProfile: _healthProfile,
  setHealthProfile: _setHealthProfile,
  patchProfile,
}: UseAppDataFormControllerArgs) {
  const [profileStatus, setProfileStatus] = useState("");
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isDeleteDrawerOpen, setIsDeleteDrawerOpen] = useState(false);
  // State-driven factory reset confirmation replaces window.confirm
  const [showFactoryResetConfirm, setShowFactoryResetConfirm] = useState(false);
  // In-drawer error feedback for delete operations
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleExport = async (type: "export-json" | "logs-csv") => {
    try {
      const exportData = await exportBackup();
      const filenameBase = `pdh-${formatLocalDateKey(new Date())}`;

      let blob: Blob;
      if (type === "export-json") {
        blob = new Blob([JSON.stringify(exportData)], {
          type: "application/json",
        });
      } else {
        const logRows = Array.isArray(exportData.data.logs) ? exportData.data.logs : [];
        const csvRows = logRows.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          timestamp: typeof row.timestamp === "number" ? new Date(row.timestamp).toISOString() : "",
          type: typeof row.type === "string" ? row.type : "",
          data: JSON.stringify(row.data ?? null),
        }));
        blob = new Blob([Papa.unparse(csvRows)], { type: "text/csv" });
      }

      const filename =
        type === "export-json" ? `${filenameBase}-export.json` : `${filenameBase}-logs.csv`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setProfileStatus(
        type === "export-json"
          ? "Data export downloaded. The OpenAI API key was excluded by design."
          : "Logs exported as CSV.",
      );
    } catch (error) {
      setProfileStatus(getErrorMessage(error, "Failed to export data."));
    }
  };

  // Opens the factory reset confirmation UI instead of using window.confirm
  const handleResetFactorySettings = () => {
    setShowFactoryResetConfirm(true);
  };

  // Called when the user confirms the factory reset in the confirmation UI
  const confirmFactoryReset = async () => {
    setShowFactoryResetConfirm(false);

    // Reset all Convex-backed profile settings to their defaults.
    // No local store reset needed — the store only holds transient UI state
    // that will be repopulated from Convex on the next render cycle.
    try {
      await patchProfile({
        unitSystem: DEFAULT_PROFILE.unitSystem,
        habits: DEFAULT_PROFILE.habits,
        fluidPresets: DEFAULT_PROFILE.fluidPresets,
        sleepGoal: DEFAULT_PROFILE.sleepGoal,
        healthProfile: DEFAULT_PROFILE.healthProfile,
        aiPreferences: DEFAULT_PROFILE.aiPreferences,
        foodPersonalisation: DEFAULT_PROFILE.foodPersonalisation,
        transitCalibration: DEFAULT_PROFILE.transitCalibration,
      });
      setProfileStatus("All settings reset to factory defaults.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to reset settings"));
    }
  };

  const handleDeleteAccountData = async () => {
    try {
      setIsDeletingData(true);
      setDeleteError(null);
      const result = await deleteAllSyncedData();
      await clearLocalData();
      const totalDeleted = getTotalDeleted(result);
      setIsDeleteDrawerOpen(false);
      setProfileStatus(
        `Deleted ${totalDeleted} cloud records and cleared local app data on this device.`,
      );
    } catch (error) {
      const message = getErrorMessage(error, "Failed to delete cloud data.");
      setDeleteError(message);
      setProfileStatus(message);
    } finally {
      setIsDeletingData(false);
    }
  };

  return {
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
  };
}
