import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // Rate limit: 60 req/min/IP
  const rateCheck = checkRateLimit(req);
  if (!rateCheck.allowed) {
    return plainHtml(429, "Too many requests. Please wait a minute before trying again.");
  }

  const { token } = params;

  // 1. Verify token
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

  // 2. Load link from DB
  const link = await getActiveLink(tokenPayload.linkId);
  if (!link || link.state !== "active") {
    return plainHtml(410, "This preview link is no longer active or has expired.");
  }

  // Ensure DB token hash matches if token provided rawToken
  if (tokenPayload.rawToken && hashToken(tokenPayload.rawToken) !== link.accessTokenHash) {
    return plainHtml(410, "Preview token has been revoked.");
  }

  // 3. Extract submitted password from form body or JSON
  let password = "";
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      password = formData.get("password")?.toString() || "";
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      password = body.password || "";
    } else {
      // Fallback form data parsing
      const text = await req.text();
      const params = new URLSearchParams(text);
      password = params.get("password") || "";
    }
  } catch {
    const html = renderPasswordPromptHtml({
      token,
      errorMessage: "Invalid form submission.",
    });
    return new NextResponse(html, {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // 4. Verify password
  let isValid = false;
  if (!link.passwordHash) {
    // No password required on this link
    isValid = true;
  } else if (password) {
    isValid = await bcrypt.compare(password, link.passwordHash);
  }

  if (!isValid) {
    // Non-leaking generic error message
    const html = renderPasswordPromptHtml({
      token,
      errorMessage: "Incorrect password. Access denied.",
    });
    return new NextResponse(html, {
      status: 401,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  // 5. On success, record hit, set cookie, and redirect to link.frontendUrl
  await touchHit(link.id);

  const remainingSeconds = Math.max(
    1,
    Math.floor((link.expiresAt.getTime() - Date.now()) / 1000)
  );

  const cookieValue = computePreviewAccessCookieValue(
    link.id,
    tokenPayload.rawToken || link.accessTokenHash
  );

  const redirectTarget = new URL(link.frontendUrl);
  redirectTarget.searchParams.set("__gate", "1");

  const response = NextResponse.redirect(redirectTarget.toString(), 302);

  response.cookies.set({
    name: "preview_access",
    value: cookieValue,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: `/api/preview/${encodeURIComponent(token)}`,
    maxAge: remainingSeconds,
  });

  return response;
}
