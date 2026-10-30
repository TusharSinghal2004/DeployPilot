import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, jsonErr } from "@/lib/http";
import {
  verifyPreviewToken,
  PreviewTokenError,
  computePreviewAccessCookieValue,
  hashToken,
} from "@/lib/preview-token";
import { getActiveLink, extendLink } from "@/lib/preview-store";

export const runtime = "nodejs";

const extendSchema = z.object({
  extraHours: z
    .number({
      required_error: "extraHours is required",
      invalid_type_error: "extraHours must be a number",
    })
    .int("extraHours must be an integer")
    .min(1, "extraHours must be between 1 and 24")
    .max(24, "extraHours must be between 1 and 24"),
});

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
  const link = await getActiveLink(tokenPayload.linkId);
  if (!link || link.state !== "active") {
    return jsonErr("not_found", "Active preview link not found", 410);
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
  // If cookie is not present or does not match
  if (cookie !== expectedCookieValue) {
    return jsonErr(
      "unauthorized",
      "Valid preview_access cookie is required to extend link",
      401
    );
  }

  // 4. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("invalid_json", "Malformed JSON request body", 400);
  }

  const validation = extendSchema.safeParse(body);
  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    return jsonErr(
      "validation_error",
      `${firstIssue.path.join(".") || "field"}: ${firstIssue.message}`,
      400
    );
  }

  const { extraHours } = validation.data;
  const extraSeconds = extraHours * 3600;

  const updatedLink = await extendLink(link.id, extraSeconds);

  return jsonOk({
    expiresAt: updatedLink.expiresAt.toISOString(),
  });
}
