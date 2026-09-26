import type { MembershipRole } from "@/lib/permissions";

export type AuthUserStatus = "ACTIVE" | "DISABLED";
export type AuthAdminRole = "SUPER_ADMIN" | "FINANCE" | "SUPPORT" | "AUDITOR";
export type AuthMembershipStatus = "INVITED" | "ACTIVE" | "INACTIVE";
export type AuthBusinessStatus =
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "GRACE_PERIOD"
  | "PAUSED"
  | "CANCELLED";

export type AuthAdminMembership = {
  role: AuthAdminRole;
  active: boolean;
};

export type AuthBusinessMembership = {
  id: string;
  businessId: string;
  role: MembershipRole | null;
  status: AuthMembershipStatus;
  business: {
    id: string;
    name: string;
    slug: string;
    status: AuthBusinessStatus;
  };
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  status: AuthUserStatus;
  emailVerifiedAt: Date | null;
  adminMembership: AuthAdminMembership | null;
  memberships: AuthBusinessMembership[];
};

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: Date;
  user: AuthUser;
};

export type AuthRedirectPath = "/super-admin" | "/business" | "/onboarding";
