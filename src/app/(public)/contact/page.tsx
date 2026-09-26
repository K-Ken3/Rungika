import type { Metadata } from "next";
import { ArrowRight, Mail, MessageSquare, Send, ShieldCheck, Smartphone } from "lucide-react";
import { PageHero } from "@/components/public/page-hero";
import { PUBLIC_SUPPORT_EMAIL } from "@/components/public/support";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Rungika for account help, billing questions, and everything about Mobile Money payments and manual confirmation.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Get the help you need"
        description="Questions about plans, registration, activation, or a workspace? The right channel depends on what this deployment has configured."
      />

      <section className="section">
        <Container>
          <div className="contact-grid">
            <div className="contact-card">
              <span className="feature-icon">
                <Mail size={22} aria-hidden="true" />
              </span>
              <div>
                <h2>Email support</h2>
                {PUBLIC_SUPPORT_EMAIL ? (
                  <p>
                    <a href={`mailto:${PUBLIC_SUPPORT_EMAIL}`}>{PUBLIC_SUPPORT_EMAIL}</a> for
                    account, billing, and workspace questions.
                  </p>
                ) : (
                  <p>
                    No public email is configured for this deployment. Sign in and use in-app
                    support instead.
                  </p>
                )}
              </div>
            </div>
            <div className="contact-card">
              <span className="feature-icon">
                <Smartphone size={22} aria-hidden="true" />
              </span>
              <div>
                <h2>Mobile Money and activation</h2>
                <p>
                  Payments happen externally using the instructions your administrator shows
                  in-app. Paid access follows manual confirmation, never an automatic flow.
                </p>
              </div>
            </div>
            <div className="contact-card">
              <span className="feature-icon">
                <MessageSquare size={22} aria-hidden="true" />
              </span>
              <div>
                <h2>Workspace help</h2>
                <p>
                  Sign in and use in-app support for setup, roles, exports, and tenancy questions.
                  Mention the workspace you need help with.
                </p>
              </div>
            </div>
            <div className="contact-card">
              <span className="feature-icon">
                <ShieldCheck size={22} aria-hidden="true" />
              </span>
              <div>
                <h2>Privacy and terms</h2>
                <p>
                  See how workspace data is separated and what we keep in the{" "}
                  <a href="/privacy">privacy policy</a> or <a href="/terms">terms of service</a>.
                </p>
              </div>
            </div>
          </div>

          <div className="contact-form-card">
            <div className="contact-form-card-header">
              <h2>{PUBLIC_SUPPORT_EMAIL ? "Write to the configured support address" : "Support lives inside the app"}</h2>
              <p>
                {PUBLIC_SUPPORT_EMAIL
                  ? "This deployment exposes a public support email. Your email app will open to the address configured by your administrator."
                  : "No public contact details are configured for this deployment, so no address is invented here. Sign in and use in-app support for account, billing, and payment matters."}
              </p>
            </div>
            <div className="contact-form">
              {PUBLIC_SUPPORT_EMAIL ? (
                <div className="contact-form-hint">
                  <a className="btn btn-primary btn-lg" href={`mailto:${PUBLIC_SUPPORT_EMAIL}`}>
                    <Send size={18} aria-hidden="true" />
                    Email the configured support address
                  </a>
                  <p>
                    Your browser opens a new email to {PUBLIC_SUPPORT_EMAIL}. Include your workspace
                    name and any Mobile Money reference.
                  </p>
                </div>
              ) : (
                <div className="notice">
                  <span className="notice-icon">
                    <ShieldCheck size={24} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>Sign in and use in-app support</h3>
                    <p>
                      Workspace setup, billing, activation, and Mobile Money questions are handled
                      through the support area inside your account.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Container>
      </section>

      <section className="section section-mint">
        <Container>
          <div className="cta-band">
            <h2>Create an account and register your business</h2>
            <p className="lead">
              Registration is possible before payment. Paid operational access begins after manual
              administrator confirmation.
            </p>
            <div className="cta-buttons">
              <ButtonLink href="/sign-up" variant="on-teal" size="lg">
                Create account
                <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/faq" variant="secondary" size="lg">
                Browse the FAQ
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}