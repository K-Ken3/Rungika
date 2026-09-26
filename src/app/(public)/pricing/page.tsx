import type { Metadata } from "next";
import { ArrowRight, Check, Globe, ShieldCheck, Smartphone } from "lucide-react";
import { momoSteps, pricing } from "@/components/public/site-data";
import { PageHero } from "@/components/public/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start with a full month free on Rungika. After the 30 day trial, the default, configurable price is US$3 per business / month, and paid operational access follows manual administrator confirmation.",
};

const activationPoints = [
  "Your first month is free: a 30 day trial starts as soon as you register a business",
  "No payment is collected during the trial",
  "When the trial ends, payment happens externally using the Mobile Money instructions configured in-app",
  "Manual administrator confirmation precedes paid operational access",
  "No payment happens on the site, and no flow auto-activates",
];

const TRIAL_DAYS = 30;

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="One flat rate for every business you run"
        description="Your first month is free. After a 30 day trial, the default, configurable price is US$3 per business / month."
      />

      <section className="section">
        <Container>
          <div className="pricing-config">
            <Globe size={20} aria-hidden="true" />
            <p>{pricing.configNote}</p>
          </div>

          <div className="pricing-grid">
            <article className="pricing-card pricing-card-featured">
              <span className="pricing-flag">First month free</span>
              <h2>{pricing.headline}</h2>
              <p>{pricing.description}</p>
              <span className="price-amount">
                {TRIAL_DAYS}
                <span className="price-unit"> days free</span>
              </span>
              <span className="price-unit">
                then {pricing.currency}
                {pricing.amount}
                {pricing.unit}
              </span>
              <ul className="pricing-features">
                {pricing.features.map((feature) => (
                  <li key={feature}>
                    <span className="check-icon">
                      <Check size={14} strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="pricing-actions">
                <ButtonLink href="/sign-up" variant="primary" size="lg">
                  Start your free month
                  <ArrowRight size={18} aria-hidden="true" />
                </ButtonLink>
                <ButtonLink href="/sign-in" variant="secondary" size="md">
                  Sign in
                </ButtonLink>
              </div>
              <p className="pricing-fine">{pricing.billingNote}</p>
            </article>

            <article className="pricing-card">
              <h2>How activation works</h2>
              <p>
                A 30 day trial starts the moment you register a business. Payment is a separate step,
                controlled by your administrator, once that first month is used.
              </p>
              <ul className="pricing-features">
                {activationPoints.map((point) => (
                  <li key={point}>
                    <span className="check-icon">
                      <Check size={14} strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className="pricing-actions">
                <ButtonLink href="/faq" variant="secondary" size="lg">
                  Read the FAQ
                </ButtonLink>
              </div>
              <p className="pricing-fine">
                The {TRIAL_DAYS} day trial and the default, configurable price of US$3 per business /
                month are shown across this site and may vary by deployment and region.
              </p>
            </article>
          </div>
        </Container>
      </section>

      <section className="section section-mint">
        <Container>
          <SectionHeading
            eyebrow="How payment works"
            title="Mobile Money with manual confirmation"
            description="Payment happens externally, then an administrator confirms it by hand. This prevents mistaken activations and keeps a clear record."
          />
          <div className="momo-steps">
            {momoSteps.map((step) => (
              <div className="momo-step" key={step.title}>
                <h3>
                  <Smartphone size={18} aria-hidden="true" />
                  {step.title}
                </h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
          <div className="section-more">
            <div className="notice">
              <span className="notice-icon">
                <ShieldCheck size={24} aria-hidden="true" />
              </span>
              <div>
                <h3>Nothing activates automatically on receipt</h3>
                <p>
                  A Mobile Money transaction is treated as a request for confirmation, not as proof
                  of paid access. An administrator matches the payment to the reference in billing,
                  then switches paid operational access on.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="section">
        <Container>
          <div className="cta-band">
            <h2>Ready to register your business?</h2>
            <p className="lead">
              Read the FAQ for billing, tenancy, and activation questions, or create an account and
              register today.
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
          </div>
        </Container>
      </section>
    </>
  );
}