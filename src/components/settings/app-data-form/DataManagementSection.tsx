import { Download, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_DATA_HEADING_CLASS } from "./shared";

interface DataManagementSectionProps {
  logsCount: number;
  onExportBackup: () => Promise<void> | void;
  onExportLogsCsv: () => Promise<void> | void;
  onResetFactorySettings: () => void;
  onOpenDeleteDrawer: () => void;
}

export function DataManagementSection({
  logsCount,
  onExportBackup,
  onExportLogsCsv,
  onResetFactorySettings,
  onOpenDeleteDrawer,
}: DataManagementSectionProps) {
  return (
    <div data-slot="data-management-section" className="space-y-2">
      <p className={APP_DATA_HEADING_CLASS}>Data Management</p>

      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <span className="font-semibold text-[var(--text)]">{logsCount}</span>
        <span>records available for export</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => void onExportBackup()}
        >
          <Download className="h-3.5 w-3.5" />
          Export App Data
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => void onExportLogsCsv()}
        >
          <Download className="h-3.5 w-3.5" />
          Export Logs CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={onResetFactorySettings}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Factory Settings
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-8 gap-1.5"
          onClick={onOpenDeleteDrawer}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete My Account Data
        </Button>
      </div>

      <p className="text-[11px] text-[var(--text-muted)]">
        Export JSON includes your synced recovery data and excludes your OpenAI API key by
        design. Reset affects local settings only. Delete removes all cloud data linked to your
        account.
      </p>
    </div>
  );
}
