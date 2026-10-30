import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, jsonErr } from "@/lib/http";
import { createLink } from "@/lib/preview-store";
import { signPreviewToken } from "@/lib/preview-token";

export const runtime = "nodejs";

const httpsUrlSchema = z
  .string()
  .url("Must be a valid URL")
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "URL must use HTTPS protocol");

const createPreviewSchema = z.object({
  frontendUrl: httpsUrlSchema,
  backendUrl: httpsUrlSchema,
  expiresInHours: z
    .number({
      required_error: "expiresInHours is required",
      invalid_type_error: "expiresInHours must be a number",
    })
    .int("expiresInHours must be an integer")
    .min(1, "expiresInHours must be between 1 and 24")
    .max(24, "expiresInHours must be between 1 and 24"),
  password: z.string().min(1, "Password cannot be empty").optional(),
  createdBy: z.string().optional(),
  deploymentId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr("invalid_json", "Malformed JSON request body", 400);
    }

    const validation = createPreviewSchema.safeParse(body);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      return jsonErr(
        "validation_error",
        `${firstIssue.path.join(".") || "field"}: ${firstIssue.message}`,
        400
      );
    }

    const { frontendUrl, backendUrl, expiresInHours, password, deploymentId } =
      validation.data;

    // TODO: replace with session user
    const createdBy = validation.data.createdBy || "demo";

    const ttlSeconds = expiresInHours * 3600;

    const { link, rawToken, passwordSet } = await createLink({
      frontendUrl,
      backendUrl,
      ttlSeconds,
      password,
      createdBy,
      deploymentId,
    });

    const token = await signPreviewToken({
      linkId: link.id,
      expiresAt: link.expiresAt,
      rawToken,
    });

    // Never log rawToken, token, or password!
    return jsonOk(
      {
        id: link.id,
        token,
        expiresAt: link.expiresAt.toISOString(),
        passwordSet,
        frontendUrl: link.frontendUrl,
        backendUrl: link.backendUrl,
      },
      201
    );
  } catch (error: unknown) {
    const err = error as Error;
    return jsonErr("internal_server_error", err.message || "Failed to create preview link", 500);
  }
}
