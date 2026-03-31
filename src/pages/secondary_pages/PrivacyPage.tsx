import { LegalPageShell } from "@/components/landing/legal/LegalPageShell";

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <p>
        <strong className="text-[var(--text)]">Effective Date:</strong> February 2026
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">
        1. Information We Collect
      </h2>
      <p>
        Caca Traca collects the following information when you use the application: food and fluid
        intake logs, digestive event records, habit tracking data, and optional profile information.
        When you join our waitlist, we collect your name, email address, and optional surgery and
        recovery information.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">
        2. How We Store Your Data
      </h2>
      <p>
        Health tracking data is stored securely in the cloud using Convex's infrastructure. Your
        OpenAI API key is stored securely on our servers using AES-256-GCM encryption. We do not
        sell or share your personal health data with third parties.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">3. AI Processing</h2>
      <p>
        When you use AI features, your food and digestion data is sent to OpenAI via our secure
        server infrastructure using your own API key. Your API key is stored securely on our servers
        using AES-256-GCM encryption. It is only used to make AI requests on your behalf and is
        never shared with third parties. Please review OpenAI's privacy policy for details on how
        they handle data.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">4. Waitlist Data</h2>
      <p>
        Waitlist entries (name, email, surgery type, recovery stage) are stored securely and used
        solely for product updates. You can unsubscribe at any time, and we will mark your entry as
        unsubscribed.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">5. Your Rights</h2>
      <p>
        Under GDPR and similar regulations, you have the right to access, correct, or delete your
        personal data. Your health data is stored in the cloud and can be exported or deleted at any
        time from the app's settings. For waitlist data, contact us to exercise your rights.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">
        6. Cookies and Analytics
      </h2>
      <p>
        Caca Traca does not use cookies for tracking or advertising. We may collect anonymous usage
        analytics to improve the application.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">
        7. Changes to This Policy
      </h2>
      <p>
        We may update this privacy policy from time to time. We will notify you of significant
        changes through the application or via email if you're on our waitlist.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">8. Contact</h2>
      <p>
        For privacy-related questions or to exercise your data rights, please contact us through the
        application's support channels.
      </p>
    </LegalPageShell>
  );
}
