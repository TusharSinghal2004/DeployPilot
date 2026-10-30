import { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http";
import {
  verifyPreviewToken,
  PreviewTokenError,
  hashToken,
} from "@/lib/preview-token";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
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

  // 2. Fetch link
  const link = await prisma.ephemeralLink.findUnique({
    where: { id: tokenPayload.linkId },
  });

  if (!link) {
    return jsonErr("not_found", "Preview link not found", 404);
  }

  if (tokenPayload.rawToken && hashToken(tokenPayload.rawToken) !== link.accessTokenHash) {
    return jsonErr("revoked", "Preview token has been revoked", 410);
  }

  // Compute status
  const now = Date.now();
  let state = link.state;
  if (state === "active" && link.expiresAt.getTime() <= now) {
    state = "expired";
  }

  const secondsRemaining = Math.max(
    0,
    Math.floor((link.expiresAt.getTime() - now) / 1000)
  );

  return jsonOk({
    state,
    expiresAt: link.expiresAt.toISOString(),
    secondsRemaining,
    passwordSet: Boolean(link.passwordHash),
    hitCount: link.hitCount,
  });
}
