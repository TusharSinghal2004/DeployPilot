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

  // 2. Load link
  const link = await prisma.ephemeralLink.findUnique({
    where: { id: tokenPayload.linkId },
  });

  if (!link) {
    return jsonErr("not_found", "Preview link not found", 404);
  }

  if (tokenPayload.rawToken && hashToken(tokenPayload.rawToken) !== link.accessTokenHash) {
    return jsonErr("revoked", "Preview token has been revoked", 410);
  }

  // 3. Auth check: (a) valid preview_access cookie OR (b) header x-dashboard-user === link.createdBy
  const expectedCookieValue = computePreviewAccessCookieValue(
    link.id,
    tokenPayload.rawToken || link.accessTokenHash
  );
  const cookie = req.cookies.get("preview_access")?.value;
  const hasValidCookie = cookie === expectedCookieValue;

  // TODO: replace with session
  const dashboardUserHeader = req.headers.get("x-dashboard-user");
  const isAuthorizedDashboardUser =
    Boolean(dashboardUserHeader) && dashboardUserHeader === link.createdBy;

  if (!hasValidCookie && !isAuthorizedDashboardUser) {
    return jsonErr(
      "unauthorized",
      "Unauthorized: valid preview_access cookie or authorized x-dashboard-user header required",
      401
    );
  }

  // 4. Idempotently destroy
  await destroyLink(link.id);

  // Log admin action to future action log with actor: "USER"
  console.log(
    JSON.stringify({
      event: "action.log",
      action: "preview.destroy",
      actor: "USER",
      linkId: link.id,
      timestamp: new Date().toISOString(),
    })
  );

  return jsonOk({ ok: true });
}
