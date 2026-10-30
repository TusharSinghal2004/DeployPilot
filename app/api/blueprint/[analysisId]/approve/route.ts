import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonOk, jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { PlanSchema } from "@/lib/gemma/schemas";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { analysisId: string } }
) {
  const { analysisId } = params;

  if (!analysisId) {
    return jsonErr("validation_error", "Missing analysisId parameter", 400);
  }

  // a. Load Analysis by id
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
  });

  if (!analysis) {
    return jsonErr("not_found", `Analysis with id '${analysisId}' not found`, 404);
  }

  // b. Parse planJson and validate deploymentOrder
  let planJsonObj: unknown;
  try {
    planJsonObj = JSON.parse(analysis.planJson);
  } catch {
    return jsonErr("invalid_data", "Corrupted planJson in Analysis record", 500);
  }

  const parsedPlan = PlanSchema.safeParse(planJsonObj);
  if (!parsedPlan.success) {
    return jsonErr(
      "validation_error",
      `Invalid deployment plan structure: ${parsedPlan.error.message}`,
      500
    );
  }

  // c & d. Create Deployment rows and ActionLog in a single transaction
  // Catch P2002 (unique constraint violation) and re-read existing rows idempotently
  try {
    const result = await prisma.$transaction(async (tx) => {
      const backendDeployment = await tx.deployment.create({
        data: {
          analysisId: analysis.id,
          repoUrl: analysis.repoUrl,
          provider: "render",
          serviceType: "backend",
          status: "pending",
        },
      });

      const frontendDeployment = await tx.deployment.create({
        data: {
          analysisId: analysis.id,
          repoUrl: analysis.repoUrl,
          provider: "vercel",
          serviceType: "frontend",
          status: "pending",
        },
      });

      const deploymentIds = [backendDeployment.id, frontendDeployment.id];

      await tx.actionLog.create({
        data: {
          analysisId: analysis.id,
          actor: "USER",
          action: "approve_plan",
          target: analysis.repoUrl,
          status: "ok",
          riskLevel: "none",
          approvalStatus: "approved",
          detailsJson: JSON.stringify({ deploymentIds }),
        },
      });

      return { deploymentIds };
    });

    // e. Return deploymentIds
    return jsonOk(
      {
        deploymentIds: result.deploymentIds,
        status: "pending",
      },
      200
    );
  } catch (err: unknown) {
    // Catch P2002 unique constraint violation on [analysisId, provider, serviceType]
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existingDeployments = await prisma.deployment.findMany({
        where: { analysisId },
      });

      return jsonOk(
        {
          deploymentIds: existingDeployments.map((d) => d.id),
          status: "pending",
        },
        200
      );
    }

    const errMsg = (err as Error).message || "Failed to persist approved deployments";
    return jsonErr("internal_server_error", errMsg, 500);
  }
}
