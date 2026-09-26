import type { Metadata } from "next";
import {
  ArrowRight,
  CircleCheck,
  TableProperties,
  UserRoundCog,
  Wallet,
} from "lucide-react";
import { momoSteps, steps } from "@/components/public/site-data";
import { ButtonLink } from "@/components/ui/button";
import { CheckList } from "@/components/ui/check-list";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Register a business, structure your team, build custom tables, and confirm payment manually to unlock paid operational access in Rungika.",
};

const workspaceModules = [
  {
    icon: TableProperties,
    title: "Custom tables and records",
    description:
      "Build a table for anything you need to track, define typed fields, then search, add, edit, and archive records. Archived records stay searchable without cluttering active views.",
  },
  {
    icon: UserRoundCog,
    title: "People, roles, and units",
    description:
      "Invite your team, place people in units or departments, and assign roles. Permission checks run on the server for every module, so hiding a button is never the control.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="hero">
        <Container className="hero-inner">
          <div>
            <h1 className="display">How Rungika works</h1>
            <p className="lead">
              Registration, structure, and daily records happen in your workspace. Paid operational
              access is granted only after an administrator manually confirms your payment, so
              nothing is switched on automatically.
            </p>
            <div className="hero-cta">
              <ButtonLink href="/sign-up" variant="primary" size="lg">
                Create account
                <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/pricing" variant="secondary" size="lg">
                See pricing
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <section className="section">
        <Container>
          <SectionHeading
            eyebrow="Get started"
            title="Three steps from account to workspace"
            description="You can register a business before any payment is made."
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

      <section className="section section-mint">
        <Container>
          <SectionHeading
            eyebrow="Inside the workspace"
            title="Structure first, records second"
            description="Everything in a business is scoped to that business, so nothing crosses into another tenant."
          />
          <div className="value-props">
            {workspaceModules.map((module) => {
              const Icon = module.icon;
              return (
                <article className="value-prop" key={module.title}>
                  <span className="feature-icon">
                    <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <h3>{module.title}</h3>
                  <p>{module.description}</p>
                </article>
              );
            })}
          </div>
          <div className="section-more">
            <ButtonLink href="/features" variant="secondary" size="lg">
              Explore all features
              <ArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="section">
        <Container>
          <div className="pricing-alt">
            <div>
              <h3>What you can do from day one</h3>
              <p className="hide-compact">
                Registration is open before payment. Your profile, businesses, and billing overview
                are available immediately so you can prepare your workspace.
              </p>
              <CheckList
                items={[
                  "Register a business and review its plan, invoice, and due date",
                  "Read payment instructions and submit a payment claim with proof",
                  "Track claim status, review outcomes, and rejection reasons",
                  "Review the workspace activity log and export available data",
                ]}
              />
            </div>
            <div>
              <h3>How payment confirmation works</h3>
              <p className="hide-compact">
                There is no automatic payment flow. Payment happens externally using the Mobile
                Money instructions configured for this deployment, and an administrator reviews the
                claim by hand.
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
            <h2>
              Register your business, then confirm payment when you are ready.
            </h2>
            <p className="lead hide-compact">
              Your workspace stays in a restricted state until an administrator confirms payment.
              Nothing is activated automatically.
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
              Pricing is per business, and every paid workspace includes the full feature set.
            </p>
          </div>
        </Container>
      </section>

      <section className="section hide-compact">
        <Container>
          <div className="notice">
            <span className="notice-icon">
              <CircleCheck size={24} aria-hidden="true" />
            </span>
            <div>
              <h3>Data you can take with you</h3>
              <p>
                Tables and records can be exported from the workspace you own, and every change is
                written to an activity log so you can see who did what and when.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
