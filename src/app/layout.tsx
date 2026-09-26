import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Rungika — Multi-tenant business management",
    template: "%s | Rungika",
  },
  description:
    "Rungika is multi-tenant business management software. Keep each business you run in its own private workspace for contacts, invoices, payments, inventory, schedules, tasks, and documents.",
  applicationName: "Rungika",
  icons: {
    icon: "/brand/rungika-logo.png",
  },
  openGraph: {
    type: "website",
    siteName: "Rungika",
    title: "Rungika — Multi-tenant business management",
    description:
      "Every business you manage in one calm workspace. Per-business pricing with US$3 per business / month by default.",
  },
};

export const viewport: Viewport = {
  themeColor: "#002820",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}