import "server-only";

import { db } from "@/lib/db";
import {
  RATE_LIMIT_POLICIES,
  createRateLimitKey,
  getRateLimitWindow,
  type RateLimitAction,
  type RateLimitPolicy,
} from "./rate-limit-rules";

export type RateLimitResult = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}>;

type RateLimitRow = {
  count: number | bigint;
  expiresAt: Date | string;
};

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Rate limiting is unavailable");
    this.name = "RateLimitUnavailableError";
  }
}

export async function consumeRateLimit(
  action: RateLimitAction,
  identifier: string,
  policy: RateLimitPolicy = RATE_LIMIT_POLICIES[action],
  now: Date = new Date(),
): Promise<RateLimitResult> {
  if (
    !policy ||
    !Number.isSafeInteger(policy.limit) ||
    policy.limit < 1 ||
    !Number.isSafeInteger(policy.windowMs) ||
    policy.windowMs < 1
  ) {
    throw new RateLimitUnavailableError();
  }
  const key = createRateLimitKey(action, identifier, now, policy.windowMs);
  const window = getRateLimitWindow(now, policy.windowMs);
  let rows: RateLimitRow[];

  try {
    rows = await db.$queryRaw<RateLimitRow[]>`
      INSERT INTO "RateLimitBucket" AS bucket ("key", "action", "count", "expiresAt", "createdAt", "updatedAt")
      VALUES (${key}, ${action}, 1, ${window.end}, ${now}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN bucket."expiresAt" <= ${now} THEN 1
          ELSE bucket."count" + 1
        END,
        "expiresAt" = CASE
          WHEN bucket."expiresAt" <= ${now} THEN EXCLUDED."expiresAt"
          ELSE bucket."expiresAt"
        END,
        "updatedAt" = ${now}
      RETURNING "count", "expiresAt"
    `;
  } catch {
    throw new RateLimitUnavailableError();
  }

  const row = rows[0];
  const count = row ? Number(row.count) : Number.NaN;
  const resetAt = row ? new Date(row.expiresAt) : new Date(Number.NaN);
  if (!Number.isSafeInteger(count) || count < 1 || Number.isNaN(resetAt.getTime())) {
    throw new RateLimitUnavailableError();
  }

  return {
    allowed: count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - count),
    resetAt,
  };
}
