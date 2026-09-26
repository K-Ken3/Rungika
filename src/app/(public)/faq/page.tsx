import type { Metadata } from "next";
import { ArrowRight, CircleHelp, Mail } from "lucide-react";
import { faqs } from "@/components/public/site-data";
import { PageHero } from "@/components/public/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about Rungika's multi-tenant workspaces, per-business pricing, Mobile Money payments, manual verification, data separation, and exports.",
};

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Questions, answered plainly"
        description="The most useful answers about workspaces, pricing, manual Mobile Money verification, data separation, and getting help."
      />

      <section className="section">
        <Container>
          <div className="faq-list">
            <h2 className="visually-hidden">Frequently asked questions</h2>
            {faqs.map((faq) => (
              <details className="faq-item" key={faq.question}>
                <summary>{faq.question}</summary>
                <div className="faq-body">
                  <p>{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
          <div className="faq-note">
            <p>
              Have something more specific? Reach us on the contact page and we will walk through
              your setup.
            </p>
            <div className="section-more">
              <ButtonLink href="/contact" variant="secondary" size="lg">
                <Mail size={18} aria-hidden="true" />
                Contact support
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <section className="section section-mint">
        <Container>
          <div className="cta-band">
            <h2>A cleaner way to run every business</h2>
            <p className="lead">
              Create an account, register a business, and confirm the activation steps your
              administrator has configured.
            </p>
            <div className="cta-buttons">
              <ButtonLink href="/sign-up" variant="on-teal" size="lg">
                Create account
                <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/pricing" variant="secondary" size="lg">
                Review pricing
              </ButtonLink>
            </div>
            <p className="cta-band-note">
              <CircleHelp size={16} aria-hidden="true" />
              Paid operational access follows manual administrator confirmation, not an automatic
              payment.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}