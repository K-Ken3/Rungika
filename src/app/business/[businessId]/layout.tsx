import type { ReactNode } from "react";

import { BusinessShell } from "@/components/business/business-shell";
import { requireUser } from "@/lib/auth/authorization";
import { requireBusinessMembership } from "@/lib/data/business";

export default async function BusinessLayout({ children, params }: { children: ReactNode; params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}`);
  const access = await requireBusinessMembership(user.id, businessId);
  return <BusinessShell access={access}>{children}</BusinessShell>;
}
