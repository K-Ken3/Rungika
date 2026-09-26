import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, CircleCheck } from "lucide-react";
import { PublicShell } from "@/components/public/public-shell";
import { DashboardPreview } from "@/components/public/dashboard-preview";
import { homeFeatures, momoSteps, pricing, steps, values } from "@/components/public/site-data";
import { ButtonLink } from "@/components/ui/button";
import { CheckList } from "@/components/ui/check-list";
import { Container } from "@/components/ui/container";
import { FeatureCard } from "@/components/ui/feature-card";
import { SectionHeading } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "Multi-tenant business management",
  description:
    "Keep each business you manage in its own private Rungika workspace for contacts, invoices, payments, inventory, schedules, tasks, and documents.",
};

export default function Home() {
  return (
    <PublicShell>
      <section className="hero">
        <Container className="hero-inner">
          <div>
            <p className="hero-badge">
              <BadgeCheck size={18} aria-hidden="true" />
              <span>
                From <strong>{pricing.currency}{pricing.amount} per business / month</strong> —
                default price
              </span>
            </p>
            <h1 className="display">Every business you manage, in one calm workspace.</h1>
            <p className="lead">
              Rungika gives each business you run its own private workspace for contacts, invoices,
              payments, inventory, schedules, tasks, and documents. Nothing gets tangled together,
              and nothing sits forgotten.
            </p>
            <div className="hero-cta">
              <ButtonLink href="/sign-up" variant="primary" size="lg">
                Create account
                <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/sign-in" variant="secondary" size="lg">
                Sign in
              </ButtonLink>
            </div>
            <p className="hero-note hide-compact">
              Register your business before payment is possible. Paid operational access starts only
              after manual administrator confirmation.
            </p>
          </div>
          <DashboardPreview />
        </Container>
      </section>

      <section className="section section-mint">
        <Container>
          <SectionHeading
            eyebrow="Why Rungika"
            title="One tool, one structure, fully separated"
            description="A management platform built for solo operators, owners, and teams running one business — or several — without letting their operations collide."
          />
          <div className="value-props">
            {values.map((item) => {
              const Icon = item.icon;
              return (
                <article className="value-prop" key={item.title}>
                  <span className="feature-icon">
                    <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="section">
        <Container>
          <SectionHeading
            eyebrow="What's inside"
            title="Everything a multi-business operation needs"
            description="The core toolkit is available in every workspace, so each business gets the same dependable structure without sharing its private data."
          />
          <div className="feature-grid">
            {homeFeatures.map((feature) => (
              <FeatureCard item={feature} key={feature.title} />
            ))}
          </div>
          <div className="section-more">
            <ButtonLink href="/features" variant="secondary" size="lg">
              Explore all features
              <ArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="section section-mint">
        <Container>
          <SectionHeading
            eyebrow="Get going"
            title="From registration to operations in three steps"
            description="Register a business before payment, then gain paid operational access once manual confirmation is complete."
          />
          <div className="steps">
            {steps.map((step) => (
              <article className="step" key={step.number}>
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="section">
        <Container>
          <SectionHeading
            eyebrow="Simple billing"
            title="Pay per business, not per person"
            description={`The default, configurable starting price is ${pricing.currency}${pricing.amount} ${pricing.unit}. Every paid workspace includes the full feature set for any number of team members.`}
          />
          <div className="pricing-alt">
            <div>
              <h3>What paid operational access includes</h3>
              <p>
                One flat rate covers each active business: unlimited collaborators, every module, and
                exports you can take with you.
              </p>
              <CheckList items={pricing.features} />
              <div className="pricing-actions">
                <ButtonLink href="/pricing" variant="primary">
                  See full pricing
                  <ArrowRight size={18} aria-hidden="true" />
                </ButtonLink>
              </div>
            </div>
            <div>
              <h3>How Mobile Money payment works</h3>
              <p>
                Payment happens externally using the Mobile Money instructions your administrator
                configures and shows in-app. Manual confirmation always precedes paid access.
              </p>
              <div className="momo-steps">
                {momoSteps.map((step) => (
                  <div className="momo-step" key={step.title}>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="section section-mint">
        <Container>
          <div className="cta-band">
            <h2>Create an account and register your business today.</h2>
            <p className="lead">
              Registration is possible before payment. Paid operational access begins after manual
              administrator confirmation.
            </p>
            <div className="cta-buttons">
              <ButtonLink href="/sign-up" variant="on-teal" size="lg">
                Create account
                <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary" size="lg">
                Contact us
              </ButtonLink>
            </div>
            <p className="cta-band-note">
              <CircleCheck size={16} aria-hidden="true" />
              No automatic payment. Paid operational access is confirmed manually by an
              administrator before it turns on.
            </p>
          </div>
        </Container>
      </section>
    </PublicShell>
  );
}