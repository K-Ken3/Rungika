import { runBillingTransitions } from "@/lib/data/billing";
import { db } from "@/lib/db";
import { isProduction } from "@/lib/env";
import {
  errorResponse,
  jsonResponse,
  rateLimitResponse,
  requestRateLimitIdentifier,
} from "@/lib/security/api";
import { bearerTokenFromAuthorization, safeSecretMatches } from "@/lib/security/cron-rules";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { RATE_LIMIT_ACTIONS } from "@/lib/security/rate-limit-rules";

export const dynamic = "force-dynamic";

function isValidReminderDays(value: number[]): boolean {
  return value.every((day) => Number.isSafeInteger(day) && day >= 0 && day <= 365);
}

async function run(request: Request): Promise<Response> {
  const expectedSecret = process.env.CRON_SECRET?.trim() ?? "";
  if (!expectedSecret) {
    return errorResponse(isProduction() ? 503 : 401, "Cron is not configured");
  }

  const providedToken = bearerTokenFromAuthorization(request.headers.get("authorization"));
  if (!safeSecretMatches(providedToken, expectedSecret)) {
    return errorResponse(401, "Unauthorized");
  }

  let rateLimit;
  try {
    rateLimit = await consumeRateLimit(
      RATE_LIMIT_ACTIONS.BILLING_CRON,
      requestRateLimitIdentifier(request, "cron"),
    );
  } catch {
    return errorResponse(503, "Unable to process request");
  }
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  let setting;
  try {
    setting = await db.platformSetting.findUnique({
      where: { id: "default" },
      select: { gracePeriodDays: true, reminderDays: true },
    });
  } catch {
    return errorResponse(503, "Unable to process request");
  }
  if (
    !setting ||
    !Number.isSafeInteger(setting.gracePeriodDays) ||
    setting.gracePeriodDays < 0 ||
    !isValidReminderDays(setting.reminderDays)
  ) {
    return errorResponse(503, "Unable to process request");
  }

  let summaries;
  try {
    summaries = await runBillingTransitions({
      now: new Date(),
      gracePeriodDays: setting.gracePeriodDays,
      reminderDays: [...new Set(setting.reminderDays)].sort((left, right) => right - left),
    });
  } catch {
    return errorResponse(500, "Unable to process request");
  }

  return jsonResponse({
    ok: true,
    processed: summaries.length,
    changed: summaries.filter((summary) => summary.changed).length,
    remindersCreated: summaries.reduce(
      (total, summary) => total + summary.reminderNotificationIds.length,
      0,
    ),
  });
}

export const GET = run;
export const POST = run;
