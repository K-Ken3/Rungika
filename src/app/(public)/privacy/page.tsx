import type { Metadata } from "next";
import { PageHero } from "@/components/public/page-hero";
import { PUBLIC_SUPPORT_EMAIL } from "@/components/public/support";
import { Container } from "@/components/ui/container";

const rightsLine = PUBLIC_SUPPORT_EMAIL
  ? `you can exercise them by writing to ${PUBLIC_SUPPORT_EMAIL}.`
  : "you can exercise them by signing in and using in-app support.";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Rungika collects, uses, and protects your data — including workspace tenancy, Mobile Money verification, sharing, retention, and your rights.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy policy"
        description="What we collect, why we collect it, and how workspace data stays separated and protected."
      />
      <article className="legal-doc">
        <Container>
          <p className="legal-meta">Last updated: September 25, 2026. This policy describes how Rungika processes personal information.</p>

          <h2>1. Scope</h2>
          <p>
            This Privacy Policy applies to the Rungika website and service. It covers information
            you provide directly, information we collect to run the service, and the special
            handling of Mobile Money verification details.
          </p>

          <h2>2. Information we collect</h2>
          <ul>
            <li>
              <strong>Account information:</strong> your name, email address, password (stored in a
              hashed form), and the payment details associated with your billing record.
            </li>
            <li>
              <strong>Workspace information:</strong> the contacts, invoices, inventory, schedules,
              tasks, documents, and notes you add to each business workspace.
            </li>
            <li>
              <strong>Billing and verification information:</strong> the phone number and transaction
              reference you provide when following the administrator-configured Mobile Money
              instructions, used for manual confirmation.
            </li>
            <li>
              <strong>Support information:</strong> the contents of messages you send to our support
              team and any details you choose to include.
            </li>
          </ul>

          <h2>3. How workspace data is separated</h2>
          <p>
            Rungika is multi-tenant by design. Records are stored against the workspace in which
            they were created, and access is scoped by workspace membership and role. When you use
            one account for several businesses, those businesses remain separate in the system, in
            exports, and in reports.
          </p>

          <h2>4. Mobile Money payment handling</h2>
          <p>
            Mobile Money payments are completed externally using the instructions your
            administrator configures and shows in-app. For that reason, we keep the phone number and
            reference you supply while confirmation is still open. We use these details only to
            match the payment and record it in your billing history:
          </p>
          <ul>
            <li>Confirmation is performed manually by an administrator.</li>
            <li>Nothing activates automatically when a Mobile Money message arrives, and this site does not run a payment workflow of its own.</li>
            <li>The details are not used for marketing and are not shared for advertising.</li>
            <li>Once confirmation is resolved, the details are minimised or removed from routine processing.</li>
          </ul>

          <h2>5. How we use information</h2>
          <p>
            We use the information we collect to provide the service, keep workspaces separate,
            process and verify payments, respond to support requests, monitor abuse and security,
            and improve the product. We do not sell personal information and we do not use
            workspace content to advertise to your customers.
          </p>

          <h2>6. Sharing and processors</h2>
          <p>
            We share information only where necessary to operate the service: hosting providers and
            tools that help us support users. Mobile Money confirmation details are handled by your
            administrator and are not handed to third-party advertisers. Where a processor needs
            data, it receives only what the task requires.
          </p>

          <h2>7. Security</h2>
          <p>
            We enforce workspace-level access controls, encrypt traffic in transit, hash passwords,
            and review access to verification records. Absolute security cannot be guaranteed, but
            we follow industry-standard practices and act quickly when we learn of a problem.
          </p>

          <h2>8. Retention</h2>
          <p>
            Workspace data is kept for as long as your account and workspaces remain active. Exports
            let you remove or move your data. We delete records that you remove and minimise
            verification details once a payment has been settled or declined. Legal and billing
            records may be kept as required by law.
          </p>

          <h2>9. Your rights and choices</h2>
          <p>
            You can correct account details, export workspace records, sign out of sessions, and ask
            us to delete data we no longer need. Where law grants you access, correction, portability,
            restriction, or deletion rights, {rightsLine}
          </p>

          <h2>10. Changes to this policy</h2>
          <p>
            We will update this policy as the service evolves. Material changes are announced on
            this page and, where practical, through a notice in your workspace.
          </p>

          <div className="legal-contacts">
            <p>
              <strong>Questions about privacy?</strong>
              <br />
              {PUBLIC_SUPPORT_EMAIL ? PUBLIC_SUPPORT_EMAIL : "Sign in and use in-app support."}
              <br />
              Please mention the workspace your question concerns so we can keep the reply scoped.
            </p>
          </div>
        </Container>
      </article>
    </>
  );
}