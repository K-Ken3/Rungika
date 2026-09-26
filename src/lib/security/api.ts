import type { AuthUser } from "@/lib/auth/types";
import type { RateLimitResult } from "./rate-limit";

export const API_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
} as const;

export function withSecurityHeaders(init: ResponseInit = {}): ResponseInit {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(API_NO_STORE_HEADERS)) {
    headers.set(name, value);
  }
  return { ...init, headers };
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const securityInit = withSecurityHeaders(init);
  const headers = new Headers(securityInit.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body) ?? "null", { ...securityInit, headers });
}

export function errorResponse(status: number, message: string): Response {
  return jsonResponse({ error: message }, { status });
}

export function rateLimitResponse(result: RateLimitResult): Response {
  const response = errorResponse(429, "Too many requests");
  const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
  response.headers.set("Retry-After", String(retryAfter));
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", "0");
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt.getTime() / 1000)));
  return response;
}

export function requestRateLimitIdentifier(request: Request, subject = "anonymous"): string {
  const normalizedSubject = subject.trim().slice(0, 128);
  if (normalizedSubject && normalizedSubject !== "anonymous") {
    return normalizedSubject;
  }
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address =
    forwardedFor ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-client-ip")?.trim() ||
    "unknown";
  return `anonymous:${address.slice(0, 128)}`;
}

export function isActiveBillingAdmin(user: AuthUser): boolean {
  return (
    user.status === "ACTIVE" &&
    user.adminMembership?.active === true &&
    (user.adminMembership.role === "SUPER_ADMIN" ||
      user.adminMembership.role === "FINANCE")
  );
}

export function isOperationalBusinessStatus(status: string): boolean {
  return status === "ACTIVE" || status === "GRACE_PERIOD";
}

export const isUsableBusinessStatus = isOperationalBusinessStatus;

export function hasActiveBusinessMembership(user: AuthUser, businessId: string): boolean {
  return (
    user.status === "ACTIVE" &&
    user.memberships.some(
      (membership) => membership.businessId === businessId && membership.status === "ACTIVE",
    )
  );
}

export function hasActiveOperationalBusinessMembership(
  user: AuthUser,
  businessId: string,
): boolean {
  return (
    user.status === "ACTIVE" &&
    user.memberships.some(
      (membership) =>
        membership.businessId === businessId &&
        membership.status === "ACTIVE" &&
        isOperationalBusinessStatus(membership.business.status),
    )
  );
}

export const hasActiveUsableBusinessMembership = hasActiveOperationalBusinessMembership;

export function hasOperationalBusinessState(input: {
  businessStatus: string;
  subscriptionStatus: string | null | undefined;
  adminHold: boolean;
}): boolean {
  return (
    input.adminHold !== true &&
    isOperationalBusinessStatus(input.businessStatus) &&
    (input.subscriptionStatus === "ACTIVE" || input.subscriptionStatus === "GRACE_PERIOD")
  );
}
