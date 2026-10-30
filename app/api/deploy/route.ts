import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonErr } from "@/lib/http";
import { runDeployment } from "@/lib/orchestrator";

export const runtime = "nodejs";

const deployRequestSchema = z.object({
  analysisId: z.string().min(1, "analysisId is required"),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr("invalid_json", "Malformed JSON request body", 400);
    }

    const validation = deployRequestSchema.safeParse(body);
    if (!validation.success) {
      return jsonErr("validation_error", validation.error.issues[0].message, 400);
    }

    const { analysisId } = validation.data;

    // Find pending deployments for this analysis
    const pendingDeployments = await prisma.deployment.findMany({
      where: {
        analysisId,
        status: "pending",
      },
    });

    if (pendingDeployments.length === 0) {
      return jsonErr(
        "not_found",
        `No pending deployments found for analysis '${analysisId}'`,
        404
      );
    }

    const deploymentIds = pendingDeployments.map((d) => d.id);

    // Run deployment asynchronously (fire and forget so client gets immediate 202)
    // The Live Timeline will receive updates via SSE
    runDeployment(deploymentIds).catch((err) => {
      console.error("[POST /api/deploy] Asynchronous runDeployment failed:", err);
    });

    return jsonOk(
      {
        message: "Deployment orchestration started",
        analysisId,
        deploymentIds,
        status: "deploying",
      },
      202
    );
  } catch (err: any) {
    console.error("[POST /api/deploy] Server error:", err);
    return jsonErr("internal_server_error", err.message || "Failed to trigger deployment", 500);
  }
}
