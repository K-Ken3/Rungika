import { describe, expect, it } from "vitest";

import {
  ALLOWED_SUBSCRIPTION_TRANSITIONS,
  DEFAULT_SUBSCRIPTION_PLAN,
  DEFAULT_TRIAL_DAYS,
  STORED_SUBSCRIPTION_STATUSES,
  BillingTransitionError,
  BillingValidationError,
  addBillingInterval,
  assertPositiveMinorUnits,
  assertTransitionAllowed,
  assertValidMinorUnits,
  calculateBillingDates,
  calculateNextBillingEdge,
  canTransition,
  daysUntilDue,
  deriveSubscriptionStatus,
  formatCurrency,
  formatMoney,
  isApproachingDue,
  minorUnitsToMajor,
  planSubscriptionTransition,
  shouldPauseSubscription,
  toMinorUnits,
} from "../src/lib/billing";
import { hasPaidOperationalAccess } from "../src/components/business/rules";

const NOW = new Date("2026-03-10T00:00:00.000Z");
const DAY = 86_400_000;

function offset(days: number): Date {
  return new Date(NOW.getTime() + days * DAY);
}

describe("money formatting and minor units", () => {
  it("defaults to the US$3 monthly Business plan", () => {
    expect(DEFAULT_SUBSCRIPTION_PLAN).toEqual({
      planName: "Business",
      amountMinor: 300,
      currency: "USD",
      interval: "MONTH",
    });
    expect(formatMoney(DEFAULT_SUBSCRIPTION_PLAN.amountMinor, DEFAULT_SUBSCRIPTION_PLAN.currency)).toBe(
      "$3.00",
    );
  });

  it("converts major amounts to minor units without currency conversion", () => {
    expect(toMinorUnits(3)).toBe(300);
    expect(toMinorUnits(50)).toBe(5000);
    expect(minorUnitsToMajor(10000, "RWF")).toBe(100);
    expect(formatMoney(1500, "USD")).toBe("$15.00");
    expect(formatCurrency(250, "USD")).toBe("$2.50");
    expect(formatMoney(10000, "RWF")).not.toBe("$100.00");
  });

  it("accepts zero only when explicitly allowed", () => {
    expect(minorUnitsToMajor(0)).toBe(0);
    expect(() => toMinorUnits(0)).toThrow(BillingValidationError);
    expect(() => assertPositiveMinorUnits(0)).toThrow(BillingValidationError);
  });

  it("rejects invalid minor unit values", () => {
    expect(() => assertValidMinorUnits(2.5)).toThrow(BillingValidationError);
    expect(() => assertValidMinorUnits(-3)).toThrow(BillingValidationError);
    expect(() => assertValidMinorUnits(Number.NaN)).toThrow(BillingValidationError);
    expect(() => toMinorUnits(-1)).toThrow(BillingValidationError);
    expect(() => formatMoney(300, " ")).toThrow(BillingValidationError);
  });
});

describe("billing interval date calculation", () => {
  const start = new Date("2026-01-15T00:00:00.000Z");

  it("calculates monthly, quarterly and yearly ends", () => {
    expect(addBillingInterval(start, "MONTH").toISOString()).toBe("2026-02-15T00:00:00.000Z");
    expect(addBillingInterval(start, "QUARTER").toISOString()).toBe("2026-04-15T00:00:00.000Z");
    expect(addBillingInterval(start, "YEAR").toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("derives period end as the due date", () => {
    const cycle = calculateBillingDates(start, "MONTH");
    expect(cycle.periodEnd.toISOString()).toBe(cycle.dueDate.toISOString());
    expect(cycle.dueDate.toISOString()).toBe("2026-02-15T00:00:00.000Z");
  });

  it("moves the next billing edge into the future", () => {
    const pastEnd = offset(-2);
    const next = calculateNextBillingEdge(pastEnd, "MONTH", NOW);
    expect(next.getTime()).toBeGreaterThan(NOW.getTime());
    expect(next.toISOString()).toBe("2026-04-10T00:00:00.000Z");
    const futureEnd = offset(20);
    expect(calculateNextBillingEdge(futureEnd, "MONTH", NOW).toISOString()).toBe(
      "2026-04-30T00:00:00.000Z",
    );
  });

  it("rejects invalid intervals", () => {
    expect(() => addBillingInterval(start, "WEEK" as never)).toThrow(BillingValidationError);
    expect(() => addBillingInterval(start, "MONTH", 0)).toThrow(BillingValidationError);
  });
});

describe("derived subscription status", () => {
  it("keeps an approaching-due subscription stored as ACTIVE", () => {
    const state = deriveSubscriptionStatus(
      { status: "ACTIVE", dueDate: offset(6), graceEndsAt: null },
      { now: NOW, approachingDueDays: 7, gracePeriodDays: 3 },
    );
    expect(state.status).toBe("ACTIVE");
    expect(state.derivedStatus).toBe("UPCOMING_DUE");
    expect(state.isApproachingDue).toBe(true);
    expect(state.isInGracePeriod).toBe(false);
    expect(state.isPastDue).toBe(false);
    expect(daysUntilDue(offset(6), NOW)).toBe(6);
    expect(isApproachingDue(offset(6), NOW, 7)).toBe(true);
  });

  it("does not flag far-future subscriptions as approaching due", () => {
    const state = deriveSubscriptionStatus(
      { status: "ACTIVE", dueDate: offset(10), graceEndsAt: null },
      { now: NOW, approachingDueDays: 7, gracePeriodDays: 3 },
    );
    expect(state.status).toBe("ACTIVE");
    expect(state.derivedStatus).toBe("ACTIVE");
    expect(state.isApproachingDue).toBe(false);
  });

  it("enters grace when the due date passes with a grace period", () => {
    const state = deriveSubscriptionStatus(
      { status: "ACTIVE", dueDate: NOW, graceEndsAt: null },
      { now: NOW, gracePeriodDays: 3 },
    );
    expect(state.status).toBe("GRACE_PERIOD");
    expect(state.isInGracePeriod).toBe(true);
    expect(state.graceEndsAt?.toISOString()).toBe(offset(3).toISOString());
  });

  it("stays in grace until the grace window expires", () => {
    const duringGrace = deriveSubscriptionStatus(
      { status: "ACTIVE", dueDate: NOW, graceEndsAt: offset(3) },
      { now: offset(2), gracePeriodDays: 3 },
    );
    expect(duringGrace.status).toBe("GRACE_PERIOD");
    expect(duringGrace.isInGracePeriod).toBe(true);
  });

  it("becomes past due after grace expires", () => {
    const state = deriveSubscriptionStatus(
      { status: "GRACE_PERIOD", dueDate: NOW, graceEndsAt: offset(3) },
      { now: offset(4), gracePeriodDays: 3 },
    );
    expect(state.status).toBe("PAST_DUE");
    expect(state.isPastDue).toBe(true);
    expect(state.graceEndsAt).toBeNull();
  });

  it("moves straight to past due with zero grace", () => {
    const state = deriveSubscriptionStatus(
      { status: "ACTIVE", dueDate: NOW, graceEndsAt: null },
      { now: NOW, gracePeriodDays: 0 },
    );
    expect(state.status).toBe("PAST_DUE");
    expect(state.isPastDue).toBe(true);
    expect(state.isInGracePeriod).toBe(false);
  });

  it("never reports a paused or cancelled subscription as due", () => {
    const paused = deriveSubscriptionStatus(
      { status: "PAUSED", dueDate: offset(-10), graceEndsAt: offset(-5) },
      { now: NOW, gracePeriodDays: 3 },
    );
    expect(paused.status).toBe("PAUSED");
    expect(paused.isPaused).toBe(true);
    expect(paused.isPastDue).toBe(false);
    expect(paused.isInGracePeriod).toBe(false);

    const cancelled = deriveSubscriptionStatus(
      { status: "CANCELLED", dueDate: offset(-10), cancelledAt: NOW },
      { now: NOW, gracePeriodDays: 3 },
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.isPastDue).toBe(false);
  });

  it("does not persist the UPCOMING_DUE status", () => {
    expect(STORED_SUBSCRIPTION_STATUSES).not.toContain("UPCOMING_DUE");
    const state = deriveSubscriptionStatus(
      { status: "ACTIVE", dueDate: offset(6), graceEndsAt: null },
      { now: NOW, approachingDueDays: 7 },
    );
    expect(state.status).toBe("ACTIVE");
  });
});

describe("transition planning", () => {
  it("plans a move to grace with a computed grace end", () => {
    const plan = planSubscriptionTransition(
      { status: "ACTIVE", dueDate: NOW, graceEndsAt: null },
      { now: NOW, gracePeriodDays: 3 },
    );
    expect(plan.shouldTransition).toBe(true);
    expect(plan.fromStatus).toBe("ACTIVE");
    expect(plan.toStatus).toBe("GRACE_PERIOD");
    expect(plan.graceEndsAt?.toISOString()).toBe(offset(3).toISOString());
  });

  it("does not re-plan an active grace period", () => {
    const plan = planSubscriptionTransition(
      { status: "GRACE_PERIOD", dueDate: NOW, graceEndsAt: offset(3) },
      { now: offset(2), gracePeriodDays: 3 },
    );
    expect(plan.shouldTransition).toBe(false);
    expect(plan.toStatus).toBe("GRACE_PERIOD");
  });

  it("plans past due after grace expires", () => {
    const plan = planSubscriptionTransition(
      { status: "GRACE_PERIOD", dueDate: NOW, graceEndsAt: offset(3) },
      { now: offset(4), gracePeriodDays: 3 },
    );
    expect(plan.shouldTransition).toBe(true);
    expect(plan.toStatus).toBe("PAST_DUE");
    expect(plan.graceEndsAt).toBeNull();
  });

  it("plans straight to past due with zero grace", () => {
    const plan = planSubscriptionTransition(
      { status: "ACTIVE", dueDate: NOW, graceEndsAt: null },
      { now: NOW, gracePeriodDays: 0 },
    );
    expect(plan.shouldTransition).toBe(true);
    expect(plan.toStatus).toBe("PAST_DUE");
  });

  it("decides when to pause a past-due subscription", () => {
    expect(
      shouldPauseSubscription("PAST_DUE", NOW, { now: offset(8), pastDuePauseDays: 7 }),
    ).toBe(true);
    expect(
      shouldPauseSubscription("PAST_DUE", NOW, { now: offset(5), pastDuePauseDays: 7 }),
    ).toBe(false);
    expect(
      shouldPauseSubscription("GRACE_PERIOD", NOW, { now: offset(8), pastDuePauseDays: 7 }),
    ).toBe(true);
    expect(shouldPauseSubscription("ACTIVE", NOW, { now: offset(8) })).toBe(false);
  });
});

describe("allowed state transitions", () => {
  it("includes every stored status key in the transition map", () => {
    for (const status of STORED_SUBSCRIPTION_STATUSES) {
      expect(ALLOWED_SUBSCRIPTION_TRANSITIONS[status]).toBeDefined();
    }
  });

  it("allows expected billing transitions", () => {
    expect(canTransition("PENDING_PAYMENT", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "GRACE_PERIOD")).toBe(true);
    expect(canTransition("GRACE_PERIOD", "PAST_DUE")).toBe(true);
    expect(canTransition("PAST_DUE", "ACTIVE")).toBe(true);
    expect(canTransition("PAST_DUE", "PAUSED")).toBe(true);
    expect(canTransition("PAUSED", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "ACTIVE")).toBe(true);
  });

  it("rejects disallowed transitions", () => {
    expect(canTransition("PAST_DUE", "GRACE_PERIOD")).toBe(false);
    expect(canTransition("CANCELLED", "ACTIVE")).toBe(false);
    expect(canTransition("PENDING_PAYMENT", "PAUSED")).toBe(false);
    expect(() => assertTransitionAllowed("PAST_DUE", "GRACE_PERIOD")).toThrow(
      BillingTransitionError,
    );
    expect(() => assertTransitionAllowed("CANCELLED", "ACTIVE")).toThrow(BillingTransitionError);
  });
});

describe("first month trial access", () => {
  const trialDays = DEFAULT_TRIAL_DAYS;
  const trialStart = new Date("2026-03-10T00:00:00.000Z");
  const trialEnd = new Date(trialStart.getTime() + trialDays * DAY);

  it("defaults the trial to a full month", () => {
    expect(trialDays).toBe(30);
  });

  it("grants full access while the trial is running", () => {
    expect(
      hasPaidOperationalAccess({
        businessStatus: "PENDING_PAYMENT",
        subscriptionStatus: "PENDING_PAYMENT",
        trialDays,
        trialEndsAt: trialEnd.toISOString(),
        now: new Date("2026-03-10T00:01:00.000Z"),
      }),
    ).toBe(true);

    expect(
      hasPaidOperationalAccess({
        businessStatus: "PENDING_PAYMENT",
        subscriptionStatus: "PENDING_PAYMENT",
        trialDays,
        trialEndsAt: trialEnd.toISOString(),
        now: new Date("2026-04-08T23:59:59.000Z"),
      }),
    ).toBe(true);
  });

  it("revokes access once the first month is over", () => {
    expect(
      hasPaidOperationalAccess({
        businessStatus: "PENDING_PAYMENT",
        subscriptionStatus: "PENDING_PAYMENT",
        trialDays,
        trialEndsAt: trialEnd.toISOString(),
        now: new Date("2026-04-09T00:00:01.000Z"),
      }),
    ).toBe(false);
  });

  it("requires payment immediately when the trial is disabled", () => {
    expect(
      hasPaidOperationalAccess({
        businessStatus: "PENDING_PAYMENT",
        subscriptionStatus: "PENDING_PAYMENT",
        trialDays: 0,
        trialEndsAt: null,
        now: trialStart,
      }),
    ).toBe(false);
  });

  it("keeps an explicitly active subscription working regardless of trial", () => {
    expect(
      hasPaidOperationalAccess({
        businessStatus: "ACTIVE",
        subscriptionStatus: "ACTIVE",
        trialDays: 0,
        trialEndsAt: null,
        now: trialStart,
      }),
    ).toBe(true);
  });
});