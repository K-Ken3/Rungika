"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  consumePasswordResetToken,
  createSession,
  deleteCurrentSession,
  getCurrentSession,
  getEmailProviderConfig,
  getPostSignInPath,
  issueEmailVerificationToken,
  invalidateEmailVerificationToken,
  invalidatePasswordResetToken,
  issuePasswordResetToken,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  consumeEmailVerificationToken,
  acceptInvitation,
  InvitationError,
} from "@/lib/auth";
import {
  createAuthUser,
  findUserForAuthentication,
  isUniqueConstraintError,
} from "@/lib/auth/users";
import { verifyPassword } from "@/lib/auth/password";
import {
  authFieldErrors,
  describeAuthError,
  forgotPasswordSchema,
  PASSWORD_RECOVERY_UNAVAILABLE_MESSAGE,
  resetPasswordSchema,
  safeCallbackPath,
  signInSchema,
  signUpSchema,
  type AuthActionState,
} from "@/lib/validation/auth";

const INVALID_CREDENTIALS_MESSAGE = "The email or password is incorrect.";
const GENERIC_AUTH_ERROR_MESSAGE =
  "We couldn't complete that request. Please try again.";
const PASSWORD_RESET_REQUEST_MESSAGE =
  "If an account exists for that email, a password reset link will be sent shortly.";
const VERIFICATION_REQUEST_MESSAGE =
  "If an account exists and still needs verification, a new link will be sent shortly. It can take a minute, and new senders are often filtered, so check your spam or junk folder.";
const VERIFICATION_SENT_QUERY = "sent";
const VERIFICATION_UNAVAILABLE_QUERY = "unavailable";

function formValue(formData: FormData, name: string) {
  return formData.get(name);
}

export async function signUp(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    name: formValue(formData, "name"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: authFieldErrors(parsed.error),
    };
  }

  let verificationQuery = VERIFICATION_SENT_QUERY;
  const callbackPath = safeCallbackPath(formValue(formData, "callbackUrl"));
  try {
    const user = await createAuthUser(parsed.data);
    await deleteCurrentSession();
    try {
      const verification = await issueEmailVerificationToken(user.id);
      const delivery = await sendEmailVerificationEmail(
        user.email,
        verification.token,
        callbackPath ?? undefined,
      );
      if (!delivery.sent) {
        await invalidateEmailVerificationToken(verification.token).catch(() => undefined);
        verificationQuery = VERIFICATION_UNAVAILABLE_QUERY;
      }
    } catch {
      verificationQuery = VERIFICATION_UNAVAILABLE_QUERY;
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        status: "error",
        errors: {
          email: ["An account with this email already exists."],
        },
      };
    }
    return {
      status: "error",
      message: describeAuthError(error),
    };
  }

  revalidatePath("/", "layout");
  redirect(
    `/sign-in?verify=${verificationQuery}${callbackPath ? `&callbackUrl=${encodeURIComponent(callbackPath)}` : ""}`,
  );
}

export async function signIn(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: authFieldErrors(parsed.error),
    };
  }

  let userId: string | undefined;
  try {
    const user = await findUserForAuthentication(parsed.data.email);
    const passwordMatches = await verifyPassword(
      parsed.data.password,
      user?.passwordHash,
    );

    if (!user || !passwordMatches || user.status !== "ACTIVE") {
      return {
        status: "error",
        message: INVALID_CREDENTIALS_MESSAGE,
      };
    }

    if (user.emailVerifiedAt) {
      userId = user.id;
      await deleteCurrentSession();
      await createSession(userId);
    }
  } catch {
    return {
      status: "error",
      message: GENERIC_AUTH_ERROR_MESSAGE,
    };
  }

  const callbackPath = safeCallbackPath(formValue(formData, "callbackUrl"));

  if (!userId) {
    redirect(
      `/sign-in?verify=required${callbackPath ? `&callbackUrl=${encodeURIComponent(callbackPath)}` : ""}`,
    );
  }

  let destination: string = "/onboarding";
  if (callbackPath) {
    destination = callbackPath;
  } else {
    try {
      destination = await getPostSignInPath(userId);
    } catch {
      destination = "/onboarding";
    }
  }

  revalidatePath("/", "layout");
  redirect(destination);
}

export async function forgotPassword(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formValue(formData, "email"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: authFieldErrors(parsed.error),
    };
  }

  if (!getEmailProviderConfig()) {
    return {
      status: "error",
      message: PASSWORD_RECOVERY_UNAVAILABLE_MESSAGE,
    };
  }

  try {
    const user = await findUserForAuthentication(parsed.data.email);
    if (!user || user.status !== "ACTIVE") {
      return {
        status: "success",
        message: PASSWORD_RESET_REQUEST_MESSAGE,
      };
    }

    const reset = await issuePasswordResetToken(user.id);
    const delivery = await sendPasswordResetEmail(
      parsed.data.email,
      reset.token,
    );

    if (!delivery.sent) {
      await invalidatePasswordResetToken(reset.token).catch(() => undefined);
    }
  } catch {
    return {
      status: "success",
      message: PASSWORD_RESET_REQUEST_MESSAGE,
    };
  }

  return {
    status: "success",
    message: PASSWORD_RESET_REQUEST_MESSAGE,
  };
}

export async function resetPassword(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formValue(formData, "token"),
    password: formValue(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: authFieldErrors(parsed.error),
    };
  }

  const currentSession = await getCurrentSession();
  let userId: string | null;
  try {
    userId = await consumePasswordResetToken(
      parsed.data.token,
      parsed.data.password,
    );
  } catch {
    return {
      status: "error",
      message: GENERIC_AUTH_ERROR_MESSAGE,
    };
  }

  if (!userId) {
    return {
      status: "error",
      message: "This reset link is invalid or has expired.",
    };
  }

  if (currentSession?.userId === userId) {
    try {
      await deleteCurrentSession();
    } catch {
      await clearSessionCookie();
    }
  }

  revalidatePath("/", "layout");
  redirect("/sign-in?reset=success");
}

export async function verifyEmail(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = formValue(formData, "token");
  const callbackPath = safeCallbackPath(formValue(formData, "callbackUrl"));
  if (typeof token !== "string" || token.length < 20 || token.length > 200) {
    return {
      status: "error",
      message: "This verification link is invalid or has expired.",
    };
  }

  let userId: string | null;
  try {
    userId = await consumeEmailVerificationToken(token);
  } catch {
    return {
      status: "error",
      message: GENERIC_AUTH_ERROR_MESSAGE,
    };
  }
  if (!userId) {
    return {
      status: "error",
      message: "This verification link is invalid or has expired.",
    };
  }

  try {
    await deleteCurrentSession();
    await createSession(userId);
  } catch {
    return {
      status: "error",
      message: GENERIC_AUTH_ERROR_MESSAGE,
    };
  }

  revalidatePath("/", "layout");
  redirect(callbackPath ?? "/onboarding");
}

export async function resendEmailVerification(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formValue(formData, "email"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      errors: authFieldErrors(parsed.error),
    };
  }
  if (!getEmailProviderConfig()) {
    return {
      status: "success",
      message: VERIFICATION_REQUEST_MESSAGE,
    };
  }

  try {
    const user = await findUserForAuthentication(parsed.data.email);
    if (user && user.status === "ACTIVE" && !user.emailVerifiedAt) {
      const verification = await issueEmailVerificationToken(user.id);
      const delivery = await sendEmailVerificationEmail(
        parsed.data.email,
        verification.token,
      );
      if (!delivery.sent) {
        await invalidateEmailVerificationToken(verification.token).catch(() => undefined);
      }
    }
  } catch {
    return {
      status: "success",
      message: VERIFICATION_REQUEST_MESSAGE,
    };
  }

  return {
    status: "success",
    message: VERIFICATION_REQUEST_MESSAGE,
  };
}

export async function acceptInvitationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = formValue(formData, "token");
  if (typeof token !== "string" || token.length < 20 || token.length > 200) {
    return {
      status: "error",
      message: "This invitation link is invalid or has expired.",
    };
  }

  const session = await getCurrentSession();
  if (!session) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/accept-invitation?token=${token}`)}`);
  }

  let accepted: { businessId: string; businessName: string };
  try {
    accepted = await acceptInvitation({ token, userId: session.userId });
  } catch (error) {
    if (error instanceof InvitationError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: GENERIC_AUTH_ERROR_MESSAGE };
  }

  revalidatePath("/", "layout");
  redirect(`/business/${encodeURIComponent(accepted.businessId)}/people?joined=${encodeURIComponent(accepted.businessName)}`);
}

export async function logout(): Promise<never> {
  await getCurrentSession();

  try {
    await deleteCurrentSession();
  } catch {
    try {
      await clearSessionCookie();
    } catch {
      revalidatePath("/", "layout");
    }
  }

  revalidatePath("/", "layout");
  redirect("/sign-in");
}
