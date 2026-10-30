import { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http";
import {
  verifyPreviewToken,
  PreviewTokenError,
  computePreviewAccessCookieValue,
  hashToken,
} from "@/lib/preview-token";
import { prisma } from "@/lib/prisma";
import { destroyLink } from "@/lib/preview-store";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;

  // 1. Verify token
  let tokenPayload;
  try {
    tokenPayload = await verifyPreviewToken(token);
  } catch (err) {
    if (err instanceof PreviewTokenError && (err.code === "expired" || err.code === "revoked")) {
      return jsonErr(err.code, "Preview link has expired or has been revoked", 410);
    }
    return jsonErr("unauthorized", "Invalid preview token", 401);
  }

  // 2. Load link (fetch by ID regardless of active status for idempotency)
  const link = await prisma.ephemeralLink.findUnique({
    where: { id: tokenPayload.linkId },
  });

  if (!link) {
    return jsonErr("not_found", "Preview link not found", 404);
  }

  if (tokenPayload.rawToken && hashToken(tokenPayload.rawToken) !== link.accessTokenHash) {
    return jsonErr("revoked", "Preview token has been revoked", 410);
  }

  // 3. Validate preview_access cookie
  const expectedCookieValue = computePreviewAccessCookieValue(
    link.id,
    tokenPayload.rawToken || link.accessTokenHash
  );

  const cookie = req.cookies.get("preview_access")?.value;
  if (cookie !== expectedCookieValue) {
    return jsonErr(
      "unauthorized",
      "Valid preview_access cookie is required to destroy link",
      401
    );
  }

  // 4. Idempotent destroy
  await destroyLink(link.id);

  return jsonOk({ ok: true });
}
