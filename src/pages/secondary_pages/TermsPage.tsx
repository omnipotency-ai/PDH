import { LegalPageShell } from "@/components/landing/legal/LegalPageShell";

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service">
      <p>
        <strong className="text-[var(--text)]">Effective Date:</strong> February 2026
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">1. Acceptance of Terms</h2>
      <p>
        By accessing or using Caca Traca, you agree to be bound by these Terms of Service. If you do
        not agree, please do not use the application.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">
        2. Description of Service
      </h2>
      <p>
        Caca Traca is a personal health tracking application designed to help users recovering from
        ostomy reversal surgery log food intake, track digestive outcomes, and receive AI-generated
        insights. The service is not a substitute for professional medical advice.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">3. Medical Disclaimer</h2>
      <p>
        The information provided by Caca Traca, including AI-generated analyses, is for
        informational purposes only and does not constitute medical advice, diagnosis, or treatment.
        Always consult with a qualified healthcare provider regarding your health decisions.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">
        4. User Accounts and Data
      </h2>
      <p>
        You are responsible for maintaining the confidentiality of your account. Your health data is
        stored securely in the cloud using Convex's infrastructure. You retain ownership of all data
        you enter.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">5. Third-Party Services</h2>
      <p>
        AI features require your own OpenAI API key. Usage of AI features is subject to OpenAI's
        terms of service and pricing. Caca Traca does not control or assume responsibility for
        third-party services.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">
        6. Limitation of Liability
      </h2>
      <p>
        Caca Traca is provided "as is" without warranties of any kind. We shall not be liable for
        any damages arising from the use or inability to use the service.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">7. Changes to Terms</h2>
      <p>
        We reserve the right to modify these terms at any time. Continued use of the service after
        changes constitutes acceptance of the revised terms.
      </p>

      <h2 className="font-display text-xl font-bold text-[var(--text)]">8. Contact</h2>
      <p>
        For questions about these terms, please contact us through the application's support
        channels.
      </p>
    </LegalPageShell>
  );
}
