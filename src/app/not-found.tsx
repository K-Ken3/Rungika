import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { PublicShell } from "@/components/public/public-shell";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you were looking for does not exist or has moved.",
  robots: {
    index: false,
    follow: false,
  },
};

const destinations = [
  {
    href: "/how-it-works",
    title: "How it works",
    description: "See the steps from registration to a working workspace.",
  },
  {
    href: "/pricing",
    title: "Pricing",
    description: "Review the per-business plan and what payment unlocks.",
  },
  {
    href: "/features",
    title: "Features",
    description: "Browse tables, records, people, roles, and billing.",
  },
  {
    href: "/faq",
    title: "FAQ",
    description: "Answers about verification, payment, and permissions.",
  },
  {
    href: "/contact",
    title: "Contact",
    description: "Send a message if something is not working for you.",
  },
  {
    href: "/sign-in",
    title: "Sign in",
    description: "Already registered? Return to your workspace.",
  },
];

export default function NotFound() {
  return (
    <PublicShell>
      <section className="section">
        <Container>
          <div className="not-found">
            <span className="not-found-icon">
              <Compass size={30} aria-hidden="true" />
            </span>
            <p className="eyebrow">Error 404</p>
            <h1 className="display">We could not find that page</h1>
            <p className="lead">
              The link may be mistyped, or the page may have moved. Nothing is wrong with your
              account or your data.
            </p>
            <div className="hero-cta">
              <ButtonLink href="/" variant="primary" size="lg">
                Back to home
                <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary" size="lg">
                Contact support
              </ButtonLink>
            </div>
          </div>
          <div className="section-more">
            <h2 className="text-lg font-semibold text-emerald-950">Popular destinations</h2>
          </div>
          <div className="feature-grid">
            {destinations.map((item) => (
              <article className="feature-card" key={item.href}>
                <h3>
                  <Link className="card-link" href={item.href}>
                    {item.title}
                  </Link>
                </h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>
    </PublicShell>
  );
}
