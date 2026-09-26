import type { Metadata } from "next";
import { ArrowRight, ShieldCheck, Wallet } from "lucide-react";
import { features } from "@/components/public/site-data";
import { PageHero } from "@/components/public/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { CheckList } from "@/components/ui/check-list";
import { Container } from "@/components/ui/container";
import { FeatureCard } from "@/components/ui/feature-card";
import { SectionHeading } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Every module of Rungika: private multi-tenant workspaces, contacts, invoicing, payments, inventory, scheduling, team roles, tasks, reports, and document storage.",
};

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="A complete operating toolkit for every tenant"
        description="The same dependable management structure is available in every workspace. Each business keeps its own records, roles, and history while you work from one shared home base."
      />

      <section className="section">
        <Container>
          <SectionHeading
            eyebrow="The toolkit"
            title="Everything you run, in one place"
            description="Every paid workspace includes the full feature set — no module upsells and no per-seat add-ons."
          />
          <div className="feature-grid">
            {features.map((feature) => (
              <FeatureCard item={feature} key={feature.title} />
            ))}
          </div>
        </Container>
      </section>

      <section className="section section-mint">
        <Container>
          <div className="pricing-alt">
            <div>
              <h3>Separation that protects you</h3>
              <p>
                Tenancy is built into the data model, not bolted on. A workspace can only see its
                own contacts, invoices, inventory, schedules, documents, and audit trail — even when
                one person manages five businesses in the same login.
              </p>
              <CheckList
                items={[
                  "Each business owns its records and history",
                  "Roles and permissions are scoped per workspace",
                  "Reports aggregate only the workspaces you choose",
                  "Exports are generated per workspace",
                ]}
              />
            </div>
            <div>
              <h3>Built for how multi-business operators work</h3>
              <p>
                If you invoice different clients, schedule different teams, or keep different
                stockrooms, you no longer have to juggle tabs, spreadsheets, or separate logins for
                everything.
              </p>
              <CheckList
                items={[
                  "One account, many isolated workspaces",
                  "Shared templates you can reuse per tenant",
                  "Notes and files attached where they belong",
                  "A calendar that never blends two businesses",
                ]}
              />
            </div>
          </div>
        </Container>
      </section>

      <section className="section">
        <Container>
          <SectionHeading
            eyebrow="Money and payments"
            title="Recorded clearly, verified honestly"
            description="Payments are part of your workspace's story, and the Rungika team handles sensitive mobile money steps by hand."
          />
          <div className="notice">
            <span className="notice-icon">
              <ShieldCheck size={24} aria-hidden="true" />
            </span>
            <div>
              <h3>Manual Mobile Money confirmation</h3>
              <p>
                Payment for subscriptions happens externally using the Mobile Money instructions
                your administrator configures and shows in-app. No payment is auto-approved from a
                raw SMS or receipt, and paid operational access is granted only after manual
                administrator confirmation.
              </p>
              <p>
                Recorded card and bank transfers inside a workspace behave as part of ordinary
                bookkeeping; subscription activation still follows the manual confirmation flow.
              </p>
            </div>
          </div>
          <div className="section-more">
            <ButtonLink href="/pricing" variant="primary" size="lg">
              See pricing
              <ArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="section section-mint">
        <Container>
          <div className="cta-band">
            <h2>Create an account and register a business.</h2>
            <p className="lead">
              Registration is possible before payment. Paid operational access is confirmed manually
              after the payment steps configured in-app.
            </p>
            <div className="cta-buttons">
              <ButtonLink href="/sign-up" variant="on-teal" size="lg">
                Create account
                <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/faq" variant="secondary" size="lg">
                Read the FAQ
              </ButtonLink>
            </div>
            <p className="cta-band-note">
              <Wallet size={16} aria-hidden="true" />
              No automatic payment. Paid operational access is confirmed manually by an
              administrator.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}