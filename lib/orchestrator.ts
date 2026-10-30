import { prisma } from "@/lib/prisma";
import { getDeployers } from "./deployers";
import { Blueprint } from "./gemma/schemas";

async function logAction(params: {
  analysisId?: string | null;
  deploymentId?: string | null;
  actor?: string;
  action: string;
  target?: string | null;
  status: "ok" | "error" | "info";
  riskLevel?: "none" | "low" | "medium" | "high";
  approvalStatus?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await prisma.actionLog.create({
      data: {
        analysisId: params.analysisId || null,
        deploymentId: params.deploymentId || null,
        actor: params.actor || "AGENT",
        action: params.action,
        target: params.target || null,
        status: params.status,
        riskLevel: params.riskLevel || "none",
        approvalStatus: params.approvalStatus || "n/a",
        detailsJson: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch (err) {
    console.error("[Orchestrator] Failed to write ActionLog row:", err);
  }
}

export async function runDeployment(deploymentIds: string[]): Promise<void> {
  console.info(`[Orchestrator] Starting deployment orchestration for ${deploymentIds.join(", ")}`);

  const deployers = getDeployers();

  // Fetch deployments
  const deployments = await prisma.deployment.findMany({
    where: { id: { in: deploymentIds } },
  });

  if (deployments.length === 0) {
    console.error(`[Orchestrator] No deployments found for IDs: ${deploymentIds.join(", ")}`);
    return;
  }

  const analysisId = deployments[0].analysisId;
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
  });

  let blueprint: Blueprint | null = null;
  if (analysis?.blueprintJson) {
    try {
      blueprint = JSON.parse(analysis.blueprintJson) as Blueprint;
    } catch {
      console.warn("[Orchestrator] Could not parse blueprintJson from Analysis record");
    }
  }

  const repoBaseName = (analysis?.repoName || "app").toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const backendDeployment = deployments.find((d) => d.serviceType === "backend");
  const frontendDeployment = deployments.find((d) => d.serviceType === "frontend");

  let backendUrl = "https://stub-backend.onrender.com";
  let frontendUrl = "https://stub-frontend.vercel.app";

  try {
    // --- Step 1: Deploy backend ---
    if (backendDeployment) {
      const backendServiceName = `${repoBaseName}-backend`;

      await prisma.deployment.update({
        where: { id: backendDeployment.id },
        data: { status: "deploying", startedAt: new Date() },
      });

      await logAction({
        analysisId,
        deploymentId: backendDeployment.id,
        action: "deploy_backend",
        target: backendDeployment.repoUrl,
        status: "ok",
        details: {
          provider: backendDeployment.provider,
          name: backendServiceName,
          framework: blueprint?.backend?.framework || "express",
          startCommand: blueprint?.backend?.startCommand || "node src/server.js",
          rootDirectory: blueprint?.backend?.root || "backend",
        },
      });

      const backendDeployResult = await deployers.render.deploy(
        "backend",
        backendDeployment.repoUrl,
        backendServiceName,
        {
          rootDirectory: blueprint?.backend?.root || "backend",
          startCommand: blueprint?.backend?.startCommand || "node src/server.js",
          buildCommand: "npm install",
          framework: blueprint?.backend?.framework || "express",
          branch: analysis?.defaultBranch || "main",
        },
        { PORT: "5000", FRONTEND_URL: frontendUrl }
      );

      if (!backendDeployResult.success) {
        throw new Error(backendDeployResult.error || "Render deployment failed");
      }

      backendUrl = backendDeployResult.url || backendUrl;

      await prisma.deployment.update({
        where: { id: backendDeployment.id },
        data: { url: backendUrl },
      });

      // --- Step 2: Poll backend health (5s interval, 5min timeout) ---
      await logAction({
        analysisId,
        deploymentId: backendDeployment.id,
        action: "waiting_for_backend_health",
        target: backendUrl,
        status: "info",
        details: {
          message: "Polling backend health every 5s until HTTP 200 (timeout: 5m)",
          url: backendUrl,
          healthCheckPath: blueprint?.backend?.healthCheckPath || "/health",
        },
      });

      const backendHealthy = await deployers.render.waitForHealth(
        backendUrl,
        blueprint?.backend?.healthCheckPath || "/health"
      );

      if (!backendHealthy) {
        throw new Error(`Backend service failed health check at ${backendUrl} within timeout`);
      }

      await prisma.deployment.update({
        where: { id: backendDeployment.id },
        data: { isHealthy: true, healthFailureStreak: 0 },
      });
    }

    // --- Step 3: Deploy frontend ---
    let frontendServiceName = `${repoBaseName}-frontend`;
    if (frontendDeployment) {
      frontendServiceName = `${repoBaseName}-frontend`;

      await prisma.deployment.update({
        where: { id: frontendDeployment.id },
        data: { status: "deploying", startedAt: new Date() },
      });

      await logAction({
        analysisId,
        deploymentId: frontendDeployment.id,
        action: "deploy_frontend",
        target: frontendDeployment.repoUrl,
        status: "ok",
        details: {
          provider: frontendDeployment.provider,
          name: frontendServiceName,
          framework: blueprint?.frontend?.framework || "vite",
          buildCommand: blueprint?.frontend?.buildCommand || "npm run build",
          outputDirectory: blueprint?.frontend?.outputDirectory || "dist",
          rootDirectory: blueprint?.frontend?.root || "frontend",
        },
      });

      const frontendDeployResult = await deployers.vercel.deploy(
        "frontend",
        frontendDeployment.repoUrl,
        frontendServiceName,
        {
          rootDirectory: blueprint?.frontend?.root || "frontend",
          buildCommand: blueprint?.frontend?.buildCommand || "npm run build",
          outputDirectory: blueprint?.frontend?.outputDirectory || "dist",
          framework: blueprint?.frontend?.framework || "vite",
          branch: analysis?.defaultBranch || "main",
        },
        { VITE_API_URL: backendUrl }
      );

      if (!frontendDeployResult.success) {
        throw new Error(frontendDeployResult.error || "Vercel deployment failed");
      }

      frontendUrl = frontendDeployResult.url || frontendUrl;

      await prisma.deployment.update({
        where: { id: frontendDeployment.id },
        data: { url: frontendUrl },
      });

      // --- Step 4: Poll frontend health (5s interval, 3min timeout) ---
      await logAction({
        analysisId,
        deploymentId: frontendDeployment.id,
        action: "waiting_for_frontend_health",
        target: frontendUrl,
        status: "info",
        details: {
          message: "Polling frontend health every 5s until HTTP 200 (timeout: 3m)",
          url: frontendUrl,
        },
      });

      const frontendHealthy = await deployers.vercel.waitForHealth(frontendUrl, "/");
      if (!frontendHealthy) {
        throw new Error(`Frontend service failed health check at ${frontendUrl} within timeout`);
      }

      await prisma.deployment.update({
        where: { id: frontendDeployment.id },
        data: { isHealthy: true, healthFailureStreak: 0 },
      });
    }

    // --- Step 5: Wire Vercel environment variable (VITE_API_URL -> backendUrl) ---
    if (frontendDeployment) {
      await logAction({
        analysisId,
        deploymentId: frontendDeployment.id,
        action: "wire_frontend_api_url",
        target: frontendUrl,
        status: "ok",
        details: { key: "VITE_API_URL", value: backendUrl, project: frontendServiceName },
      });

      const envResult = await deployers.vercel.setEnvVar(
        frontendServiceName,
        "VITE_API_URL",
        backendUrl
      );

      if (!envResult.success) {
        console.warn(`[Orchestrator] Warning setting VITE_API_URL on Vercel: ${envResult.error}`);
      }
    }

    // --- Step 6: Wire backend CORS origin (FRONTEND_URL -> frontendUrl) ---
    if (backendDeployment) {
      await logAction({
        analysisId,
        deploymentId: backendDeployment.id,
        action: "wire_backend_cors_origin",
        target: backendUrl,
        status: "ok",
        details: { key: "FRONTEND_URL", value: frontendUrl },
      });

      await deployers.render.setEnvVar(backendUrl, "FRONTEND_URL", frontendUrl);
    }

    // --- Step 7: Mark deployments as ready ---
    const finishedAt = new Date();
    for (const d of deployments) {
      await prisma.deployment.update({
        where: { id: d.id },
        data: {
          status: "ready",
          isHealthy: true,
          finishedAt,
        },
      });
    }

    await logAction({
      analysisId,
      action: "deployment_complete",
      status: "ok",
      details: {
        deploymentIds,
        backendUrl,
        frontendUrl,
      },
    });

    console.info(`[Orchestrator] Successfully orchestrated deployments: ${deploymentIds.join(", ")}`);
  } catch (error: any) {
    console.error("[Orchestrator] Error during deployment orchestration:", error);

    for (const d of deployments) {
      await prisma.deployment.update({
        where: { id: d.id },
        data: {
          status: "failed",
          healthFailureStreak: { increment: 1 },
          finishedAt: new Date(),
        },
      });
    }

    await logAction({
      analysisId,
      action: "deployment_failed",
      status: "error",
      riskLevel: "medium",
      details: { error: error.message || String(error) },
    });
  }
}
