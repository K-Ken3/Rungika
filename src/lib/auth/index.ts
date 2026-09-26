import "server-only";

export {
  clearSessionCookie,
  createSession,
  createUserSession,
  deleteCurrentSession,
  deleteSession,
  generateSessionToken,
  getCurrentSession,
  getCurrentUser,
  hashSessionToken,
  hashToken,
  isValidSessionToken,
  revokeSessionsForUser,
  revokeUserSessions,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  SESSION_TTL_MS,
  SESSION_TTL_SECONDS,
} from "@/lib/auth/session";
export {
  hashPassword,
  PASSWORD_HASH_COST,
  verifyPassword,
} from "@/lib/auth/password";
export {
  consumePasswordResetToken,
  createPasswordResetToken,
  generatePasswordResetToken,
  hashPasswordResetToken,
  invalidatePasswordResetToken,
  issuePasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
  sendPasswordResetEmail,
} from "@/lib/auth/password-reset";
export {
  consumeEmailVerificationToken,
  createEmailVerificationToken,
  generateEmailVerificationToken,
  hashEmailVerificationToken,
  invalidateEmailVerificationToken,
  issueEmailVerificationToken,
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
  sendEmailVerificationEmail,
} from "@/lib/auth/email-verification";
export { getPostSignInPath } from "@/lib/auth/navigation";
export {
  acceptInvitation,
  generateInvitationToken,
  getInvitationPreview,
  hashInvitationToken,
  InvitationError,
  INVITATION_TOKEN_TTL_DAYS,
  sendInvitationEmail,
} from "@/lib/auth/invitations";
export type {
  InvitationDelivery,
  InvitationPreview,
} from "@/lib/auth/invitations";
export {
  hasBusinessPermission,
  requireBusinessPermission,
  requireCurrentUserPermission,
  requireAdmin,
  requireUser,
} from "@/lib/auth/authorization";
export {
  getEmailProviderConfig,
  isEmailProviderConfigured,
} from "@/lib/env";
export type {
  AuthAdminMembership,
  AuthBusinessMembership,
  AuthRedirectPath,
  AuthSession,
  AuthUser,
} from "@/lib/auth/types";
export type {
  BusinessPermissionKey,
  MembershipRole,
} from "@/lib/permissions";
