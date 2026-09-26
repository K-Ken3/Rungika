import { addDays, addMonths } from "date-fns";

export const MINOR_UNITS_PER_MAJOR = 100;
export const DAY_MILLISECONDS = 86_400_000;

export const DEFAULT_SUBSCRIPTION_PLAN = {
  planName: "Business",
  amountMinor: 300,
  currency: "USD",
  interval: "MONTH",
} as const;

export const DEFAULT_APPROACHING_DUE_DAYS = 7;
export const DEFAULT_GRACE_PERIOD_DAYS = 3;
export const DEFAULT_TRIAL_DAYS = 30;
export const DEFAULT_PAST_DUE_PAUSE_DAYS = 7;

export const BILLING_INTERVALS = ["MONTH", "QUARTER", "YEAR"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const STORED_SUBSCRIPTION_STATUSES = [
  "PENDING_PAYMENT",
  "ACTIVE",
  "GRACE_PERIOD",
  "PAST_DUE",
  "PAUSED",
  "CANCELLED",
] as const;
export type StoredSubscriptionStatus = (typeof STORED_SUBSCRIPTION_STATUSES)[number];

export const UPCOMING_DUE = "UPCOMING_DUE";
export type SubscriptionDisplayStatus = StoredSubscriptionStatus | typeof UPCOMING_DUE;

const INTERVAL_MONTHS: Record<BillingInterval, number> = {
  MONTH: 1,
  QUARTER: 3,
  YEAR: 12,
};

export class BillingValidationError extends Error {}
export class BillingConflictError extends Error {}
export class BillingTransitionError extends Error {}
export class BillingAuthorizationError extends Error {}
export class BillingNotFoundError extends Error {}

function assertDateLike(value: Date, label: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new BillingValidationError(`${label} must be a valid date`);
  }
}

function assertInterval(value: BillingInterval): void {
  if (!(BILLING_INTERVALS as readonly string[]).includes(value)) {
    throw new BillingValidationError("Invalid billing interval");
  }
}

export function isValidMinorUnits(value: number, allowZero = false): boolean {
  return (
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= (allowZero ? 0 : 1)
  );
}

export function assertValidMinorUnits(value: number, allowZero = false): void {
  if (Number.isNaN(value)) {
    throw new BillingValidationError("Amount must be a number");
  }
  if (!isValidMinorUnits(value, allowZero)) {
    throw new BillingValidationError("Amount must be a positive integer in minor units");
  }
}

export function assertPositiveMinorUnits(value: number): void {
  assertValidMinorUnits(value, false);
}

export function toMinorUnits(majorAmount: number, allowZero = false): number {
  if (typeof majorAmount !== "number" || !Number.isFinite(majorAmount) || majorAmount < 0) {
    throw new BillingValidationError("Amount must be a finite non-negative number");
  }
  const minor = Math.round(majorAmount * MINOR_UNITS_PER_MAJOR);
  assertValidMinorUnits(minor, allowZero);
  return minor;
}

export function minorUnitsToMajor(amountMinor: number, currency?: string): number {
  assertValidMinorUnits(amountMinor, true);
  if (currency !== undefined && currency.trim() === "") {
    throw new BillingValidationError("Currency must not be empty");
  }
  return amountMinor / MINOR_UNITS_PER_MAJOR;
}

export function formatMoney(amountMinor: number, currency: string): string {
  assertValidMinorUnits(amountMinor, true);
  const code = currency.trim().toUpperCase();
  if (!code) {
    throw new BillingValidationError("Currency must not be empty");
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    currencyDisplay: "symbol",
  }).format(amountMinor / MINOR_UNITS_PER_MAJOR);
}

export const formatCurrency = formatMoney;

export function calculateDueDate(periodStart: Date, interval: BillingInterval): Date {
  return calculateBillingDates(periodStart, interval).dueDate;
}

export const calculateSubscriptionPeriodEnd = addBillingInterval;

export function addBillingInterval(start: Date, interval: BillingInterval, steps = 1): Date {
  assertDateLike(start, "Period start");
  assertInterval(interval);
  if (!Number.isInteger(steps) || steps < 1) {
    throw new BillingValidationError("Steps must be a positive integer");
  }
  return addMonths(start, INTERVAL_MONTHS[interval] * steps);
}

export interface BillingCycle {
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
}

export function calculateBillingDates(periodStart: Date, interval: BillingInterval): BillingCycle {
  const periodEnd = addBillingInterval(periodStart, interval);
  return { periodStart, periodEnd, dueDate: periodEnd };
}

export function calculateNextBillingEdge(
  currentPeriodEnd: Date,
  interval: BillingInterval,
  now: Date = new Date(),
): Date {
  assertDateLike(currentPeriodEnd, "Current period end");
  assertDateLike(now, "Now");
  const anchor = currentPeriodEnd > now ? currentPeriodEnd : now;
  return addBillingInterval(anchor, interval);
}

export function daysUntilDue(dueDate: Date, now: Date = new Date()): number {
  assertDateLike(dueDate, "Due date");
  assertDateLike(now, "Now");
  return Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / DAY_MILLISECONDS));
}

export function isApproachingDue(
  dueDate: Date,
  now: Date = new Date(),
  approachingDueDays: number = DEFAULT_APPROACHING_DUE_DAYS,
): boolean {
  assertDateLike(dueDate, "Due date");
  assertDateLike(now, "Now");
  if (!Number.isInteger(approachingDueDays) || approachingDueDays < 0) {
    throw new BillingValidationError("Approaching due window must be a non-negative integer");
  }
  const diffMs = dueDate.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= approachingDueDays * DAY_MILLISECONDS;
}

export interface SubscriptionStatusInput {
  status: StoredSubscriptionStatus;
  dueDate: Date;
  graceEndsAt?: Date | null;
  pausedAt?: Date | null;
  cancelledAt?: Date | null;
}

export interface SubscriptionStateOptions {
  now?: Date;
  approachingDueDays?: number;
  gracePeriodDays?: number;
}

export interface SubscriptionState {
  status: StoredSubscriptionStatus;
  derivedStatus: SubscriptionDisplayStatus;
  graceEndsAt: Date | null;
  isApproachingDue: boolean;
  isInGracePeriod: boolean;
  isPastDue: boolean;
  isPaused: boolean;
  isActive: boolean;
  daysUntilDue: number;
}

function composeState(
  input: SubscriptionStatusInput,
  status: StoredSubscriptionStatus,
  graceEndsAt: Date | null,
  options: SubscriptionStateOptions,
  now: Date,
): SubscriptionState {
  const approaching = isApproachingDue(input.dueDate, now, options.approachingDueDays);
  const upcoming = approaching ? UPCOMING_DUE : status;
  return {
    status,
    derivedStatus: upcoming,
    graceEndsAt,
    isApproachingDue: approaching,
    isInGracePeriod: status === "GRACE_PERIOD",
    isPastDue: status === "PAST_DUE",
    isPaused: status === "PAUSED",
    isActive: status === "ACTIVE",
    daysUntilDue: daysUntilDue(input.dueDate, now),
  };
}

export function deriveSubscriptionStatus(
  input: SubscriptionStatusInput,
  options: SubscriptionStateOptions = {},
): SubscriptionState {
  const now = options.now ?? new Date();
  const approachingDueDays = options.approachingDueDays ?? DEFAULT_APPROACHING_DUE_DAYS;
  const gracePeriodDays = options.gracePeriodDays ?? DEFAULT_GRACE_PERIOD_DAYS;
  assertDateLike(input.dueDate, "Due date");
  assertDateLike(now, "Now");
  if (input.graceEndsAt !== undefined && input.graceEndsAt !== null) {
    assertDateLike(input.graceEndsAt, "Grace end");
  }
  if (!Number.isInteger(approachingDueDays) || approachingDueDays < 0) {
    throw new BillingValidationError("Approaching due window must be a non-negative integer");
  }
  if (!Number.isInteger(gracePeriodDays) || gracePeriodDays < 0) {
    throw new BillingValidationError("Grace period days must be a non-negative integer");
  }
  if (input.status === "CANCELLED") {
    return composeState(input, "CANCELLED", input.graceEndsAt ?? null, options, now);
  }
  if (input.status === "PAUSED") {
    return composeState(input, "PAUSED", input.graceEndsAt ?? null, options, now);
  }
  if (input.dueDate.getTime() > now.getTime()) {
    return composeState(input, input.status, input.graceEndsAt ?? null, options, now);
  }
  if (gracePeriodDays === 0) {
    return composeState(input, "PAST_DUE", null, options, now);
  }
  const computedGraceEndsAt = input.graceEndsAt ?? addDays(input.dueDate, gracePeriodDays);
  if (now.getTime() < computedGraceEndsAt.getTime()) {
    if (input.status === "PAST_DUE") {
      return composeState(input, "PAST_DUE", input.graceEndsAt ?? null, options, now);
    }
    return composeState(input, "GRACE_PERIOD", computedGraceEndsAt, options, now);
  }
  return composeState(input, "PAST_DUE", null, options, now);
}

export const deriveBillingStatus = deriveSubscriptionStatus;
export const deriveSubscriptionState = deriveSubscriptionStatus;

export type SubscriptionTransitionOptions = SubscriptionStateOptions;

export interface SubscriptionTransitionPlan {
  fromStatus: StoredSubscriptionStatus;
  toStatus: StoredSubscriptionStatus;
  graceEndsAt: Date | null;
  reason: string;
  shouldTransition: boolean;
  isApproachingDue: boolean;
}

const TRANSITION_REASONS: Record<string, string> = {
  "PENDING_PAYMENT:ACTIVE": "Initial payment confirmed",
  "PENDING_PAYMENT:GRACE_PERIOD": "Initial payment period ended",
  "PENDING_PAYMENT:PAST_DUE": "Initial payment is overdue",
  "PENDING_PAYMENT:CANCELLED": "Subscription cancelled",
  "ACTIVE:ACTIVE": "Subscription renewed",
  "ACTIVE:GRACE_PERIOD": "Billing cycle ended and grace period started",
  "ACTIVE:PAST_DUE": "Payment is past due",
  "ACTIVE:PAUSED": "Subscription paused",
  "ACTIVE:CANCELLED": "Subscription cancelled",
  "GRACE_PERIOD:ACTIVE": "Payment confirmed during grace period",
  "GRACE_PERIOD:PAST_DUE": "Grace period expired",
  "GRACE_PERIOD:PAUSED": "Subscription paused after grace period",
  "GRACE_PERIOD:CANCELLED": "Subscription cancelled",
  "PAST_DUE:ACTIVE": "Payment confirmed while past due",
  "PAST_DUE:PAUSED": "Subscription paused after prolonged non-payment",
  "PAST_DUE:CANCELLED": "Subscription cancelled",
  "PAUSED:ACTIVE": "Subscription reactivated",
  "PAUSED:CANCELLED": "Subscription cancelled",
};

export function transitionReason(
  fromStatus: StoredSubscriptionStatus,
  toStatus: StoredSubscriptionStatus,
): string {
  return TRANSITION_REASONS[`${fromStatus}:${toStatus}`] ?? "Subscription status changed";
}

export function planSubscriptionTransition(
  input: SubscriptionStatusInput,
  options: SubscriptionStateOptions = {},
): SubscriptionTransitionPlan {
  const state = deriveSubscriptionStatus(input, options);
  const fromStatus = input.status;
  const toStatus = state.status;
  const enteringGrace = state.isInGracePeriod && fromStatus !== "GRACE_PERIOD";
  const shouldTransition = toStatus !== fromStatus || enteringGrace;
  const graceEndsAt =
    toStatus === "GRACE_PERIOD" ? state.graceEndsAt : null;
  return {
    fromStatus,
    toStatus,
    graceEndsAt,
    reason: shouldTransition ? transitionReason(fromStatus, toStatus) : "",
    shouldTransition,
    isApproachingDue: state.isApproachingDue,
  };
}

export interface PauseOptions {
  now?: Date;
  pastDuePauseDays?: number;
}

export function shouldPauseSubscription(
  status: StoredSubscriptionStatus,
  dueDate: Date,
  options: PauseOptions = {},
): boolean {
  if (status !== "PAST_DUE" && status !== "GRACE_PERIOD") {
    return false;
  }
  const now = options.now ?? new Date();
  const pastDuePauseDays = options.pastDuePauseDays ?? DEFAULT_PAST_DUE_PAUSE_DAYS;
  assertDateLike(dueDate, "Due date");
  assertDateLike(now, "Now");
  if (!Number.isInteger(pastDuePauseDays) || pastDuePauseDays < 0) {
    throw new BillingValidationError("Past-due pause days must be a non-negative integer");
  }
  return now.getTime() >= dueDate.getTime() + pastDuePauseDays * DAY_MILLISECONDS;
}

export const ALLOWED_SUBSCRIPTION_TRANSITIONS: Record<
  StoredSubscriptionStatus,
  readonly StoredSubscriptionStatus[]
> = {
  PENDING_PAYMENT: ["ACTIVE", "GRACE_PERIOD", "PAST_DUE", "CANCELLED"],
  ACTIVE: ["ACTIVE", "GRACE_PERIOD", "PAST_DUE", "PAUSED", "CANCELLED"],
  GRACE_PERIOD: ["ACTIVE", "PAST_DUE", "PAUSED", "CANCELLED"],
  PAST_DUE: ["ACTIVE", "PAUSED", "CANCELLED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
  CANCELLED: [],
};

export function canTransition(
  fromStatus: StoredSubscriptionStatus,
  toStatus: StoredSubscriptionStatus,
): boolean {
  return ALLOWED_SUBSCRIPTION_TRANSITIONS[fromStatus].includes(toStatus);
}

export const isTransitionAllowed = canTransition;

export function assertTransitionAllowed(
  fromStatus: StoredSubscriptionStatus,
  toStatus: StoredSubscriptionStatus,
): void {
  if (!canTransition(fromStatus, toStatus)) {
    throw new BillingTransitionError(`Transition ${fromStatus} -> ${toStatus} is not allowed`);
  }
}

export function isStoredSubscriptionStatus(value: string): value is StoredSubscriptionStatus {
  return (STORED_SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}