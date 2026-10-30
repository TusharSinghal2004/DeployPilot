import { NextRequest, NextResponse } from "next/server";
import { plainHtml } from "@/lib/http";
import {
  verifyPreviewToken,
  PreviewTokenError,
  computePreviewAccessCookieValue,
  hashToken,
} from "@/lib/preview-token";
import { getActiveLink, touchHit } from "@/lib/preview-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { renderPasswordPromptHtml } from "@/lib/password-prompt-html";

export const runtime = "nodejs";



export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // Rate limit gate requests: 60 req/min/IP
  const rateCheck = checkRateLimit(req);
  if (!rateCheck.allowed) {
    return plainHtml(429, "Too many requests. Please wait a minute before trying again.");
  }

  const { token } = params;

  // 1. Verify preview token
  let tokenPayload;
  try {
    tokenPayload = await verifyPreviewToken(token);
  } catch (err) {
    if (err instanceof PreviewTokenError) {
      if (err.code === "expired" || err.code === "revoked") {
        return plainHtml(410, "Preview link has expired or has been revoked.");
      }
      return plainHtml(401, "Invalid preview token.");
    }
    return plainHtml(401, "Authentication failed.");
  }

  // 2. Load link by id and ensure DB state is "active"
  const link = await getActiveLink(tokenPayload.linkId);
  if (!link || link.state !== "active") {
    return plainHtml(410, "This preview link is no longer active or has expired.");
  }

  // Ensure DB token hash matches if token provided rawToken
  if (tokenPayload.rawToken && hashToken(tokenPayload.rawToken) !== link.accessTokenHash) {
    return plainHtml(410, "Preview token has been revoked.");
  }

  // 3. Compute expected preview access cookie
  const expectedCookieValue = computePreviewAccessCookieValue(
    link.id,
    tokenPayload.rawToken || link.accessTokenHash
  );

  const existingCookie = req.cookies.get("preview_access")?.value;
  const isCookieValid = existingCookie === expectedCookieValue;

  // 4. Password check
  if (link.passwordHash && !isCookieValid) {
    // Render minimal HTML password form POSTing to /api/preview/[token]/unlock
    const html = renderPasswordPromptHtml({ token });
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  // 5. Link is active and unlocked (either open or already authenticated with cookie)
  await touchHit(link.id);

  // Calculate remaining seconds
  const remainingSeconds = Math.max(
    1,
    Math.floor((link.expiresAt.getTime() - Date.now()) / 1000)
  );

  // Redirect to link.frontendUrl + "?__gate=1" (from DB only!)
  const redirectTarget = new URL(link.frontendUrl);
  redirectTarget.searchParams.set("__gate", "1");

  const response = NextResponse.redirect(redirectTarget.toString(), 302);

  // Set preview_access cookie
  response.cookies.set({
    name: "preview_access",
    value: expectedCookieValue,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: `/api/preview/${encodeURIComponent(token)}`,
    maxAge: remainingSeconds,
  });

  return response;
}
