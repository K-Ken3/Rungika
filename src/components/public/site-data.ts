import {
  Boxes,
  ChartColumn,
  CalendarDays,
  Download,
  FileText,
  ListChecks,
  MessageSquare,
  Receipt,
  ShieldCheck,
  Store,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import type { FeatureItem } from "@/components/ui/feature-card";
import { PUBLIC_SUPPORT_EMAIL } from "./support";

const supportContactText = PUBLIC_SUPPORT_EMAIL
  ? `Reach out by email at ${PUBLIC_SUPPORT_EMAIL}, or sign in and use in-app support.`
  : "Sign in and use in-app support for account, billing, and payment questions.";

export const features: FeatureItem[] = [
  {
    icon: Boxes,
    title: "Private workspaces",
    description:
      "Each business you manage gets its own workspace with separate records, settings, and history, so no tenant's data ever mixes with another.",
  },
  {
    icon: Users,
    title: "Contacts and clients",
    description:
      "Keep customer, partner, and staff records next to the work you do with them, organized per workspace and searchable from one place.",
  },
  {
    icon: Receipt,
    title: "Invoices and estimates",
    description:
      "Create invoices and quotations per business, track draft, sent, and paid states, and see which amounts are still outstanding at a glance.",
  },
  {
    icon: Wallet,
    title: "Payments and cash records",
    description:
      "Record card, bank, and Mobile Money payments per workspace, and reconcile them against the invoices they settle.",
  },
  {
    icon: Store,
    title: "Inventory and stock",
    description:
      "Track items, units, quantities, and reorder levels for product-based businesses, with movement visible inside the owning workspace.",
  },
  {
    icon: CalendarDays,
    title: "Schedules and appointments",
    description:
      "Plan shifts, appointments, and delivery slots on a shared calendar without letting one business's schedule crowd out another.",
  },
  {
    icon: ShieldCheck,
    title: "Roles and permissions",
    description:
      "Invite team members and scope their access per workspace, with roles that keep sensitive records visible only to people who need them.",
  },
  {
    icon: FileText,
    title: "Documents and files",
    description:
      "Attach receipts, contracts, and paperwork to the businesses and records they belong to, instead of hunting through email threads.",
  },
  {
    icon: ListChecks,
    title: "Tasks and workflows",
    description:
      "Turn recurring work into checklists and hand assignments to the right person so nothing in any of your businesses sits unfinished.",
  },
  {
    icon: ChartColumn,
    title: "Reports and dashboards",
    description:
      "See collections, unpaid invoices, busy periods, and staff workload per workspace, with totals rolled up for an accurate whole view.",
  },
  {
    icon: MessageSquare,
    title: "Notes and conversations",
    description:
      "Leave notes and reply threads on records so decisions keep their context without cluttering your inbox or chat app.",
  },
  {
    icon: Download,
    title: "Data you can export",
    description:
      "Export each workspace's records in portable formats so you can move, back up, or audit your information whenever you need to.",
  },
];

export const homeFeatures = features.slice(0, 6);

export const steps = [
  {
    number: "01",
    title: "Create your account",
    description:
      "Sign up for your Rungika account and register the first business. Registration is possible before payment.",
  },
  {
    number: "02",
    title: "Add one workspace per business",
    description:
      "Each registered business starts with its own cleanly separated workspace for contacts, money, and documents.",
  },
  {
    number: "03",
    title: "Use your free first month",
    description:
      "A 30 day trial starts the moment you register a business, so you can run the workspace for a full month before paying anything.",
  },
  {
    number: "04",
    title: "Complete manual confirmation",
    description:
      "Once the trial ends, paid operational access activates only after manual administrator confirmation, following the payment instructions configured in-app.",
  },
];

export const values = [
  {
    icon: ShieldCheck,
    title: "Hard tenant boundaries",
    description:
      "Workspaces are isolated by design: records, settings, roles, and history belong to one tenant and are invisible to every other tenant.",
  },
  {
    icon: Workflow,
    title: "One process, many repeats",
    description:
      "Standardize invoicing, scheduling, and task checklists once, then let each workspace reuse that structure without sharing private data.",
  },
  {
    icon: Wallet,
    title: "Per-business pricing",
    description:
      "Pay per active business, not per person or per module. The default, configurable starting price is shown across this site.",
  },
];

export const pricing = {
  currency: "US$",
  amount: "3",
  unit: "per business / month",
  headline: "All-in-one management",
  description:
    "One plan with every management feature included. Every business and every team member is covered by the same flat rate.",
  features: [
    "Unlimited team members across your workspaces",
    "Every feature in every workspace",
    "Private, isolated workspace per business",
    "Invoices, payments, inventory, schedules, tasks, and documents",
    "Exportable data and standard reports",
  ],
  activeConfigLabel: "US$3/business/month",
    configNote:
      "Your first month is free: a 30 day trial starts when you register a business. After the trial, US$3 per business / month is the default and configurable price shown across this site. Currency, billing period, and wording remain configurable per deployment and region.",
    billingNote:
      "Billed per active business workspace. A 30 day trial starts automatically at registration and is free, so no payment is collected during the first month. After the trial, paid operational access starts only after manual administrator confirmation.",
};

export const faqs = [
  {
    question: "What is Rungika?",
    answer:
      "Rungika is a multi-tenant business management platform. You create a separate, private workspace for each business you run, then manage contacts, invoices, payments, inventory, schedules, tasks, documents, and team access inside that workspace.",
  },
  {
    question: "How does per-business pricing work?",
    answer:
      "Pricing is per active business, not per member. The default and configurable starting price shown across the site is US$3 per business per month, and each paid workspace includes the full feature set for any number of team members.",
  },
  {
    question: "Can I sign up before paying?",
    answer:
      "Yes. A 30 day trial starts automatically when you register a business, so you can use the full workspace free for your first month. No payment is collected during the trial. After it ends, paid operational access still follows the same manual confirmation rules.",
  },
  {
    question: "How is Mobile Money handled?",
    answer:
      "There is no retail checkout page and no automatic payment flow. Payment happens externally using the Mobile Money instructions configured by your administrator and shown in-app. Paid operational access is granted only after manual administrator confirmation.",
  },
  {
    question: "Is my business's data separated from my other businesses?",
    answer:
      "Yes. Data, records, files, roles, and history belong to the workspace they were created in. One workspace cannot browse or inherit another workspace's data, even when both are managed from the same Rungika account.",
  },
  {
    question: "Can I invite team members?",
    answer:
      "Yes. Invite staff, accountants, or partners and grant them roles scoped to the workspaces they should see. Collaboration is included in every paid workspace.",
  },
  {
    question: "Can I export or move my data?",
    answer:
      "Yes. Each workspace can export its records and documents in portable formats. You can use the exports for backups, audits, or moving to another system at any time.",
  },
  {
    question: "What happens if I add another business later?",
    answer:
      "You add a new workspace at any time. It starts with its own boundaries and empty operating records; the same registration and manual confirmation rules apply before paid operational access.",
  },
  {
    question: "How do I get help?",
    answer: supportContactText,
  },
];

export const momoSteps = [
  {
    title: "Use the in-app instructions",
    description:
      "Sign in, open billing, and follow the Mobile Money instructions your administrator has configured for this deployment. Payment happens externally.",
  },
  {
    title: "An administrator verifies manually",
    description:
      "After payment, an administrator manually confirms it against the reference you provide. Nothing activates automatically, and there is no checkout to skip this step.",
  },
  {
    title: "Paid operational access activates",
    description:
      "After your free 30 day trial ends, the workspace keeps paid operational access once manual confirmation is complete. From then on each renewal follows the same process.",
  },
];