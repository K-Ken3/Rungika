import Link from "next/link";
import { Mail, ShieldCheck, Smartphone } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { Container } from "@/components/ui/container";
import { PUBLIC_SUPPORT_EMAIL } from "./support";

const productLinks = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

const companyLinks = [
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

const authLinks = [
  { href: "/sign-up", label: "Create account" },
  { href: "/sign-in", label: "Sign in" },
];

export function PublicFooter() {
  return (
    <footer className="site-footer">
      <Container>
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" aria-label="Rungika home">
              <BrandLogo className="footer-logo" />
            </Link>
            <p>
              Multi-tenant business management for operators who run one business — or several. Each
              workspace stays private, each team stays in sync.
            </p>
            {PUBLIC_SUPPORT_EMAIL ? (
              <a className="footer-contact" href={`mailto:${PUBLIC_SUPPORT_EMAIL}`}>
                <Mail size={18} aria-hidden="true" />
                {PUBLIC_SUPPORT_EMAIL}
              </a>
            ) : (
              <p className="footer-note">
                <ShieldCheck size={18} aria-hidden="true" />
                Need help? Sign in and use in-app support for account, billing, and payment
                questions.
              </p>
            )}
            <p className="footer-note">
              <ShieldCheck size={18} aria-hidden="true" />
              Paid operational access is granted only after manual administrator confirmation.
              Mobile Money payment instructions configured by your administrator are shown in-app.
            </p>
          </div>
          <nav aria-label="Product">
            <h2 className="footer-heading">Product</h2>
            <ul className="footer-links">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Company">
            <h2 className="footer-heading">Company</h2>
            <ul className="footer-links">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="footer-heading">Account</h2>
            <ul className="footer-links">
              {authLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
            <p className="footer-note">
              <Smartphone size={18} aria-hidden="true" />
              Payment happens externally. Manual administrator confirmation is required before paid
              operational access.
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Rungika. All rights reserved.</p>
          <div className="footer-legal">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}