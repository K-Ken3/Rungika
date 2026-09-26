import type { Metadata } from "next";
import { PageHero } from "@/components/public/page-hero";
import { PUBLIC_SUPPORT_EMAIL } from "@/components/public/support";
import { Container } from "@/components/ui/container";

const supportLine = PUBLIC_SUPPORT_EMAIL
  ? `You can reach us by writing to ${PUBLIC_SUPPORT_EMAIL}.`
  : "Sign in and use in-app support for questions about these terms.";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The Rungika terms of service covering your account, workspaces, per-business pricing, Mobile Money payments, manual verification, and acceptable use.",
};

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of service"
        description="The plain-language rules that apply when you use Rungika, its workspaces, and its paid plans."
      />
      <article className="legal-doc">
        <Container>
          <p className="legal-meta">Last updated: September 25, 2026. These terms apply to everyone who uses Rungika.</p>

          <h2>1. What this agreement covers</h2>
          <p>
            These Terms of Service govern your access to and use of Rungika, the rungika.app website,
            and any mobile or desktop interface we provide. By creating an account, you agree to
            these terms. If you use Rungika on behalf of a business, you confirm that you are
            authorised to accept these terms for that business.
          </p>

          <h2>2. Your account</h2>
          <p>
            You are responsible for keeping your login secure and for all activity that takes place
            under your account. You must provide accurate account details and keep them current. If
            you believe an account has been compromised, notify us promptly through the contact
            page.
          </p>

          <h2>3. Workspaces and tenancy</h2>
          <p>
            Rungika is a multi-tenant system. A workspace is a private management environment for
            one business or operating unit. Workspace data is kept separate from other workspaces by
            design. You are responsible for the data you add to each workspace and for ensuring that
            you have the right to use it.
          </p>
          <ul>
            <li>Each workspace keeps its own records, settings, roles, and history.</li>
            <li>Workspaces do not share data with one another.</li>
            <li>You control who is invited and which roles they receive per workspace.</li>
          </ul>

          <h2>4. Registration and subscriptions</h2>
          <p>
            You can create an account and register a business before payment. Paid plans are charged
            per business workspace. The default and configurable starting price shown across the
            marketing site is US$3 per business per month, which may be configured for other
            currencies, regions, or billing cycles when such options are offered.
          </p>
          <p>
            Registration lets you create your account and workspace, but it does not by itself grant
            paid operational access. Paid operational access starts only after manual administrator
            confirmation of the payment, or after a trial if one is configured later.
          </p>
          <p>
            Fees are billed in advance. If a workspace is cancelled, access continues until the end
            of the paid period unless the cancellation terms for your plan say otherwise.
          </p>

          <h2>5. Payments and manual Mobile Money confirmation</h2>
          <p>
            The site does not run a retail payment workflow and does not activate subscriptions
            automatically. Payment happens externally using the Mobile Money instructions your
            administrator configures and shows in-app. The following rules apply:
          </p>
          <ul>
            <li>You may register a business before any payment is made.</li>
            <li>
              To activate a paid workspace, follow the administrator-configured Mobile Money
              instructions shown inside your account. Payment is completed with the external
              provider, not on this site.
            </li>
            <li>
              Your administrator <strong>manually confirms</strong> the payment against the reference
              in your billing history before paid operational access is granted.
            </li>
            <li>
              A Mobile Money message or receipt alone does not grant paid access, and no automatic
              flow switches a workspace on.
            </li>
          </ul>
          <p>
            If a Mobile Money payment cannot be matched or is declined, paid operational access will
            not be activated and you will be notified through your account.
          </p>

          <h2>6. Acceptable use</h2>
          <p>
            You agree not to misuse Rungika. This includes attempts to access another workspace&apos;s
            data, to bypass limits or verification steps, to upload unlawful content, to distribute
            malware, to probe or attack our systems, or to use the service to break the law in any
            jurisdiction where you operate.
          </p>

          <h2>7. Data and availability</h2>
          <p>
            We take reasonable steps to keep the service available and your data secure, but we do
            not guarantee uninterrupted availability. Export tools let you keep your own copies, and
            we encourage regular exports as part of your own backup routine.
          </p>

          <h2>8. Changes to these terms</h2>
          <p>
            We may update these terms from time to time to reflect new features or legal
            requirements. Material changes will be announced on this page with a new date, and
            continued use after the change means you accept the updated terms.
          </p>

          <h2>9. Contact</h2>
          <p>{supportLine}</p>
          <div className="legal-contacts">
            <p>
              <strong>Rungika</strong>
              <br />
              {PUBLIC_SUPPORT_EMAIL ? (
                <>
                  {PUBLIC_SUPPORT_EMAIL}
                  <br />
                </>
              ) : (
                "Sign in and use in-app support."
              )}
              Legal and payment questions are handled through the same channel your deployment
              configures.
            </p>
          </div>
        </Container>
      </article>
    </>
  );
}