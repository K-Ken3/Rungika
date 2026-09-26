import { z } from "zod";

export const PASSWORD_RECOVERY_UNAVAILABLE_MESSAGE =
  "Password recovery is unavailable until an email provider is configured for this app.";

export function describeAuthError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  ) {
    return "An account with this email already exists.";
  }

  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const lower = message.toLowerCase();

  if (
    lower.includes("database_url") ||
    lower.includes("environment variable") ||
    lower.includes("prisma") ||
    lower.includes("database") ||
    lower.includes("connection")
  ) {
    return "We couldn't create your account right now. Please try again in a moment or contact support.";
  }

  return "We couldn't create your account right now. Please check your details and try again.";
}

export const describeSignupError = describeAuthError;

export function normalizeEmail(value: string) {
  return value.trim().normalize("NFKC").toLowerCase();
}

export function safeCallbackPath(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/\\") ||
    candidate.includes("\\")
  ) {
    return null;
  }
  return candidate;
}

const emailSchema = z
  .string({ error: "Enter a valid email address." })
  .trim()
  .pipe(z.email({ error: "Enter a valid email address." }))
  .transform(normalizeEmail);

const passwordSchema = z
  .string({ error: "Enter a password." })
  .min(8, { error: "Use at least 8 characters." })
  .max(72, { error: "Use no more than 72 characters." })
  .refine(
    (value) => new TextEncoder().encode(value).byteLength <= 72,
    "Use no more than 72 bytes.",
  )
  .refine((value) => /[A-Za-z]/.test(value), "Include at least one letter.")
  .refine((value) => /[0-9]/.test(value), "Include at least one number.");

const signInPasswordSchema = z
  .string({ error: "Enter your password." })
  .min(1, { error: "Enter your password." })
  .max(72, { error: "Use no more than 72 characters." })
  .refine(
    (value) => new TextEncoder().encode(value).byteLength <= 72,
    "Use no more than 72 bytes.",
  );

export const signUpSchema = z.object({
  name: z
    .string({ error: "Enter your name." })
    .trim()
    .min(2, { error: "Use at least 2 characters." })
    .max(100, { error: "Use no more than 100 characters." }),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: signInPasswordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ error: "This reset link is invalid." })
    .trim()
    .length(43, { error: "This reset link is invalid or has expired." })
    .regex(/^[A-Za-z0-9_-]+$/, {
      error: "This reset link is invalid or has expired.",
    }),
  password: passwordSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type AuthField = "name" | "email" | "password" | "token";
export type AuthFieldErrors = Partial<Record<AuthField, string[]>>;

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: AuthFieldErrors;
};

export const initialAuthState: AuthActionState = {
  status: "idle",
};

export function authFieldErrors(error: z.ZodError): AuthFieldErrors {
  const fieldErrors = error.flatten().fieldErrors as Record<
    string,
    string[] | undefined
  >;
  const allowedFields: AuthField[] = ["name", "email", "password", "token"];

  return allowedFields.reduce<AuthFieldErrors>((result, field) => {
    const messages = fieldErrors[field];
    if (messages?.length) {
      result[field] = messages;
    }
    return result;
  }, {});
}

export const signupSchema = signUpSchema;
export const signinSchema = signInSchema;
export const forgotPassword = forgotPasswordSchema;
export const resetPassword = resetPasswordSchema;
