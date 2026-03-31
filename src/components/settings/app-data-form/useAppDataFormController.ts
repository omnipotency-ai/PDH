import Papa from "papaparse";
import { useState } from "react";
import { toast } from "sonner";
import { DEFAULT_PROFILE, type PatchProfileArgs } from "@/contexts/ProfileContext";
import { formatLocalDateKey } from "@/lib/dateUtils";
import { getErrorMessage } from "@/lib/errors";
import type { AppBackupImportResult, AppBackupPayload } from "@/lib/sync";
import type { HealthProfile } from "@/types/domain";

interface UseAppDataFormControllerArgs {
  deleteAllSyncedData: () => Promise<unknown>;
  clearLocalData: () => Promise<void>;
  exportBackup: () => Promise<AppBackupPayload>;
  importBackup: (payload: AppBackupPayload) => Promise<AppBackupImportResult>;
  // SET-F003: null until Convex has loaded the profile — mutations must not fire
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

function getTotalInserted(result: AppBackupImportResult): number {
  if (!result || typeof result !== "object" || !("inserted" in result)) return 0;
  const inserted = result.inserted;
  if (!inserted || typeof inserted !== "object") return 0;
  return Object.values(inserted).reduce<number>(
    (total, count) => total + (typeof count === "number" ? count : 0),
    0,
  );
}

function validateBackupPayload(value: unknown): asserts value is AppBackupPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid backup file: expected a JSON object at the top level.");
  }

  const obj = value as Record<string, unknown>;

  if (obj.version !== 1) {
    throw new Error(`Invalid backup file: expected "version" to be 1, got ${String(obj.version)}.`);
  }

  if (typeof obj.exportedAt !== "number") {
    throw new Error('Invalid backup file: missing or invalid "exportedAt" timestamp.');
  }

  if (typeof obj.data !== "object" || obj.data === null || Array.isArray(obj.data)) {
    throw new Error('Invalid backup file: missing or invalid "data" object.');
  }
}

export function useAppDataFormController({
  deleteAllSyncedData,
  clearLocalData,
  exportBackup,
  importBackup,
  healthProfile: _healthProfile,
  setHealthProfile: _setHealthProfile,
  patchProfile,
}: UseAppDataFormControllerArgs) {
  const [profileStatus, setProfileStatus] = useState("");
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isDeleteDrawerOpen, setIsDeleteDrawerOpen] = useState(false);
  // SET-F004: state-driven import confirmation replaces window.confirm
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  // State-driven factory reset confirmation replaces window.confirm
  const [showFactoryResetConfirm, setShowFactoryResetConfirm] = useState(false);
  // In-drawer error feedback for delete operations
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleExport = async (type: "backup-json" | "logs-csv") => {
    try {
      const backup = await exportBackup();
      const filenameBase = `pdh-${formatLocalDateKey(new Date())}`;

      let blob: Blob;
      if (type === "backup-json") {
        blob = new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        });
      } else {
        const logRows = Array.isArray(backup.data.logs) ? backup.data.logs : [];
        const csvRows = logRows.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          timestamp: typeof row.timestamp === "number" ? new Date(row.timestamp).toISOString() : "",
          type: typeof row.type === "string" ? row.type : "",
          data: JSON.stringify(row.data ?? null),
        }));
        blob = new Blob([Papa.unparse(csvRows)], { type: "text/csv" });
      }

      const filename =
        type === "backup-json" ? `${filenameBase}-backup.json` : `${filenameBase}-logs.csv`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setProfileStatus(
        type === "backup-json"
          ? "Full backup exported. The OpenAI API key was excluded by design."
          : "Logs exported as CSV.",
      );
    } catch (error) {
      setProfileStatus(getErrorMessage(error, "Failed to export data."));
    }
  };

  // SET-F004: stages the file for confirmation instead of calling window.confirm.
  // The component renders an inline confirmation UI and calls confirmImport on proceed.
  const handleImportBackup = (file: File | null) => {
    if (!file) return;
    setPendingImportFile(file);
  };

  const confirmImport = async () => {
    if (!pendingImportFile) return;
    const file = pendingImportFile;
    setPendingImportFile(null);

    try {
      setIsImportingBackup(true);
      const raw = await file.text();
      const parsed: unknown = JSON.parse(raw);
      validateBackupPayload(parsed);
      const result = await importBackup(parsed);
      const totalInserted = getTotalInserted(result);
      setProfileStatus(
        `Backup imported. Restored ${totalInserted} cloud records. Local API key stayed on this device.`,
      );
    } catch (error) {
      setProfileStatus(getErrorMessage(error, "Failed to import backup."));
    } finally {
      setIsImportingBackup(false);
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
  };
}
