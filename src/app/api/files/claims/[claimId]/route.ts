import { getCurrentSession } from "@/lib/auth/session";
import { hasBusinessPermission } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import {
  errorResponse,
  hasActiveBusinessMembership,
  isActiveBillingAdmin,
  rateLimitResponse,
  requestRateLimitIdentifier,
  withSecurityHeaders,
} from "@/lib/security/api";
import {
  contentDispositionAttachment,
  safeDownloadFilenameWithExtension,
} from "@/lib/security/csv";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { RATE_LIMIT_ACTIONS } from "@/lib/security/rate-limit-rules";
import {
  getProofExtension,
  isConsistentProofStorageMetadata,
} from "@/lib/storage/private-upload-rules";
import {
  isMissingPrivateUpload,
  openPrivateUpload,
} from "@/lib/storage/private-upload";

export const dynamic = "force-dynamic";

function isValidClaimId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/u.test(value);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ claimId: string }> },
): Promise<Response> {
  const { claimId } = await params;
  if (!isValidClaimId(claimId)) {
    return errorResponse(404, "Proof not found");
  }

  let session;
  try {
    session = await getCurrentSession();
  } catch {
    return errorResponse(503, "Unable to process request");
  }
  if (!session) {
    return errorResponse(401, "Authentication required");
  }

  let rateLimit;
  try {
    rateLimit = await consumeRateLimit(
      RATE_LIMIT_ACTIONS.CLAIM_PROOF,
      requestRateLimitIdentifier(request, session.userId),
    );
  } catch {
    return errorResponse(503, "Unable to process request");
  }
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  let claim;
  try {
    claim = await db.paymentClaim.findUnique({
      where: { id: claimId },
      select: {
        id: true,
        businessId: true,
        proofKey: true,
        proofName: true,
        proofMime: true,
      },
    });
  } catch {
    return errorResponse(503, "Unable to process request");
  }
  if (!claim) {
    return errorResponse(404, "Proof not found");
  }

  const adminAuthorized = isActiveBillingAdmin(session.user);
  if (!adminAuthorized && !hasActiveBusinessMembership(session.user, claim.businessId)) {
    return errorResponse(404, "Proof not found");
  }
  if (!adminAuthorized) {
    try {
      if (
        !(await hasBusinessPermission(
          session.userId,
          claim.businessId,
          "billing.view",
        ))
      ) {
        return errorResponse(404, "Proof not found");
      }
    } catch {
      return errorResponse(503, "Unable to process request");
    }
  }
  if (
    !claim.proofKey ||
    !isConsistentProofStorageMetadata(claim.proofKey, claim.proofMime)
  ) {
    return errorResponse(404, "Proof not found");
  }

  let upload;
  try {
    upload = await openPrivateUpload(claim.proofKey);
  } catch (error) {
    if (isMissingPrivateUpload(error)) {
      return errorResponse(404, "Proof not found");
    }
    return errorResponse(500, "Unable to read proof");
  }

  const extension = getProofExtension(upload.mime);
  if (!extension) {
    return errorResponse(404, "Proof not found");
  }
  const filename = safeDownloadFilenameWithExtension(
    claim.proofName,
    extension,
    `proof-${claim.id}.${extension}`,
  );
  const responseInit = withSecurityHeaders({
    headers: {
      "Content-Type": upload.mime,
      "Content-Disposition": contentDispositionAttachment(filename),
      "Content-Length": String(upload.size),
    },
  });
  return new Response(upload.stream, responseInit);
}
