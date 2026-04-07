import { APP_DATA_HEADING_CLASS } from "./shared";

interface CloudProfileSectionProps {
  isLoading: boolean;
}

export function CloudProfileSection({ isLoading }: CloudProfileSectionProps) {
  const statusLabel = isLoading ? "Connecting" : "Connected";
  const statusMessage = isLoading
    ? "Loading your cloud profile..."
    : "All settings are saved directly to the cloud.";

  return (
    <div data-slot="cloud-profile-section" className="space-y-2">
      <p className={APP_DATA_HEADING_CLASS}>Cloud Profile</p>

      <div className="space-y-1.5 rounded-lg border border-[var(--section-appdata-border)]/70 bg-[var(--surface-0)]/40 p-3">
        <p className="text-[11px] font-semibold text-[var(--text)]">Privacy by default.</p>
        <p className="text-[11px] text-[var(--text-muted)]">
          AI access is configured at the app level for this private deployment. The OpenAI key
          lives in server environment variables, not in your browser or your user profile. All
          other settings and data are stored in Convex so they survive refreshes and travel with
          you to another device.
        </p>
        <p className="text-[11px] text-[var(--text-muted)]">
          Settings changes are saved to the cloud immediately. Data is encrypted in transit and at
          rest but is not end-to-end encrypted, so cloud storage is for portability, not for storing
          secrets.
        </p>
        {/* Public-launch follow-up: add a hosted Privacy Policy link here if this app is
            ever distributed beyond the current private deployment. */}
        <p className="text-[10px] text-[var(--text-faint)]">
          Your rights under{" "}
          <a
            href="https://commission.europa.eu/law/law-topic/data-protection_en"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--text-muted)]"
          >
            GDPR
          </a>
          .
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--section-appdata-border)] bg-[var(--surface-1)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--section-appdata)]">
            {statusLabel}
          </span>
          <p className="text-[11px] text-[var(--text-muted)]">{statusMessage}</p>
        </div>
      </div>
    </div>
  );
}
