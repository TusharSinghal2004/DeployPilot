import { SignJWT, jwtVerify, errors } from "jose";
import { createHash, randomUUID } from "node:crypto";

export type PreviewTokenErrorCode = "expired" | "invalid" | "revoked";

export class PreviewTokenError extends Error {
  code: PreviewTokenErrorCode;

  constructor(code: PreviewTokenErrorCode, message: string) {
    super(message);
    this.name = "PreviewTokenError";
    this.code = code;
  }
}

export interface PreviewTokenPayload {
  linkId: string;
  jti: string;
  exp: number;
  rawToken?: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.PREVIEW_JWT_SECRET;
  if (!secret) {
    throw new Error("PREVIEW_JWT_SECRET environment variable is not defined");
  }
  return new TextEncoder().encode(secret);
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function signPreviewToken(params: {
  linkId: string;
  expiresAt: Date;
  rawToken?: string;
}): Promise<string> {
  const { linkId, expiresAt, rawToken } = params;
  const secretKey = getJwtSecret();
  const expSeconds = Math.floor(expiresAt.getTime() / 1000);

  const payload: Record<string, unknown> = {
    sub: linkId,
    jti: randomUUID(),
    exp: expSeconds,
    typ: "preview",
  };

  if (rawToken) {
    payload.rawToken = rawToken;
  }

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(linkId)
    .setJti(payload.jti as string)
    .setExpirationTime(expSeconds)
    .sign(secretKey);
}

export async function verifyPreviewToken(token: string): Promise<PreviewTokenPayload> {
  if (!token || typeof token !== "string") {
    throw new PreviewTokenError("invalid", "Preview token is missing or malformed");
  }

  const secretKey = getJwtSecret();

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    if (payload.typ !== "preview" || !payload.sub || typeof payload.sub !== "string") {
      throw new PreviewTokenError("invalid", "Token claims are invalid for preview gating");
    }

    return {
      linkId: payload.sub,
      jti: (payload.jti as string) || "",
      exp: (payload.exp as number) || 0,
      rawToken: typeof payload.rawToken === "string" ? payload.rawToken : undefined,
    };
  } catch (err: unknown) {
    if (err instanceof PreviewTokenError) {
      throw err;
    }
    if (err instanceof errors.JWTExpired) {
      throw new PreviewTokenError("expired", "Preview token has expired");
    }
    if (
      err instanceof errors.JWTClaimValidationFailed ||
      err instanceof errors.JWSSignatureVerificationFailed ||
      err instanceof errors.JWSInvalid ||
      err instanceof errors.JOSEError
    ) {
      throw new PreviewTokenError("invalid", "Preview token verification failed");
    }
    throw new PreviewTokenError("invalid", (err as Error).message || "Invalid preview token");
  }
}

/**
 * Note on cookie value derivation:
 * The preview_access cookie derives its value via sha256(linkId + tokenIdentifier + secret).
 * When tokenPayload.rawToken is present (from issuance) it is used; otherwise link.accessTokenHash is used.
 * In all cases, raw tokens are NEVER stored in plaintext in the database (only accessTokenHash is stored in EphemeralLink).
 */
export function computePreviewAccessCookieValue(linkId: string, tokenIdentifier: string): string {
  const secret = process.env.PREVIEW_JWT_SECRET || "";
  return hashToken(`${linkId}${tokenIdentifier}${secret}`);
}
