import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const primaryLinks = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function PublicHeader() {
  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Container className="header-inner">
        <Link className="brand-logo-link" href="/" aria-label="Rungika home">
          <BrandLogo className="brand-logo" priority />
        </Link>
        <nav className="site-nav" aria-label="Primary">
          {primaryLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="header-cta">
          <ButtonLink href="/sign-in" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/sign-up" variant="primary" size="sm">
            Create account
          </ButtonLink>
        </div>
        <details className="mobile-menu">
          <summary className="menu-toggle" aria-label="Toggle navigation menu">
            <Menu className="menu-icon menu-open" size={24} aria-hidden="true" />
            <X className="menu-icon menu-close" size={24} aria-hidden="true" />
          </summary>
          <div className="mobile-panel">
            <nav aria-label="Mobile">
              <ul className="mobile-links">
                {primaryLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mobile-actions">
              <ButtonLink href="/sign-in" variant="secondary" size="md">
                Sign in
              </ButtonLink>
              <ButtonLink href="/sign-up" variant="primary" size="md">
                Create account
              </ButtonLink>
            </div>
          </div>
        </details>
      </Container>
    </header>
  );
}