import { createHash } from "node:crypto";

export const RATE_LIMIT_ACTIONS = {
  CLAIM_PROOF: "claim-proof",
  TABLE_EXPORT: "table-export",
  BILLING_CRON: "billing-cron",
} as const;

export type RateLimitAction = (typeof RATE_LIMIT_ACTIONS)[keyof typeof RATE_LIMIT_ACTIONS];

export const MAX_RATE_LIMIT_IDENTIFIER_LENGTH = 256;

export type RateLimitPolicy = Readonly<{
  limit: number;
  windowMs: number;
}>;

export const RATE_LIMIT_POLICIES: Record<RateLimitAction, RateLimitPolicy> = {
  [RATE_LIMIT_ACTIONS.CLAIM_PROOF]: { limit: 60, windowMs: 60_000 },
  [RATE_LIMIT_ACTIONS.TABLE_EXPORT]: { limit: 10, windowMs: 60_000 },
  [RATE_LIMIT_ACTIONS.BILLING_CRON]: { limit: 6, windowMs: 60_000 },
};

export type RateLimitWindow = Readonly<{
  start: Date;
  end: Date;
}>;

function assertDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError("A valid date is required");
  }
}

function assertPolicy(action: RateLimitAction, policy: RateLimitPolicy | undefined): void {
  if (!(action in RATE_LIMIT_POLICIES)) {
    throw new TypeError("Unknown rate limit action");
  }
  if (
    !policy ||
    !Number.isSafeInteger(policy.limit) ||
    policy.limit < 1 ||
    !Number.isSafeInteger(policy.windowMs) ||
    policy.windowMs < 1
  ) {
    throw new TypeError("Invalid rate limit policy");
  }
}

export function getRateLimitWindow(
  now: Date = new Date(),
  windowMs: number = 60_000,
): RateLimitWindow {
  assertDate(now);
  if (!Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new TypeError("Invalid rate limit window");
  }
  const startMs = Math.floor(now.getTime() / windowMs) * windowMs;
  return {
    start: new Date(startMs),
    end: new Date(startMs + windowMs),
  };
}

export function createRateLimitKey(
  action: RateLimitAction,
  identifier: string,
  now: Date = new Date(),
  windowMs: number = RATE_LIMIT_POLICIES[action].windowMs,
): string {
  assertPolicy(action, RATE_LIMIT_POLICIES[action]);
  if (typeof identifier !== "string" || identifier.trim().length === 0) {
    throw new TypeError("A rate limit identifier is required");
  }
  if (identifier.trim().length > MAX_RATE_LIMIT_IDENTIFIER_LENGTH) {
    throw new TypeError("Rate limit identifier is too long");
  }
  const window = getRateLimitWindow(now, windowMs);
  return createHash("sha256")
    .update(`${action}:${identifier.trim()}:${window.start.getTime()}`)
    .digest("hex");
}

export const buildRateLimitKey = createRateLimitKey;
export const getRateLimitKey = createRateLimitKey;

export function getRateLimitPolicy(action: RateLimitAction): RateLimitPolicy {
  assertPolicy(action, RATE_LIMIT_POLICIES[action]);
  return RATE_LIMIT_POLICIES[action];
}
