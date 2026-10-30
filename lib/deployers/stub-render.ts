import { Deployer, DeployResult, DeployConfig } from "./types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class StubRenderDeployer implements Deployer {
  async deploy(
    serviceType: "frontend" | "backend",
    repoUrl: string,
    name: string,
    config: DeployConfig,
    envVars: Record<string, string>
  ): Promise<DeployResult> {
    console.info(
      `[StubRenderDeployer] Deploying ${serviceType} '${name}' from ${repoUrl} with root '${config?.rootDirectory || "."}' and startCommand '${config?.startCommand || "node src/server.js"}'`
    );
    console.info(
      `[StubRenderDeployer] Injected environment variables:`,
      Object.keys(envVars)
    );

    await sleep(3000);

    const generatedUrl = "https://stub-backend.onrender.com";
    console.info(
      `[StubRenderDeployer] Deployment successful. Generated URL: ${generatedUrl}`
    );

    return {
      success: true,
      url: generatedUrl,
      serviceId: `stub-render-${Date.now()}`,
      logs: [
        `Cloning ${repoUrl}...`,
        `Detected framework: ${config?.framework || "express"}`,
        `Installing dependencies...`,
        `Starting service with: ${config?.startCommand || "node src/server.js"}`,
        `Listening on port 5000. Public URL: ${generatedUrl}`,
      ],
    };
  }

  async setEnvVar(
    serviceIdOrUrl: string,
    key: string,
    value: string
  ): Promise<{ success: boolean; error?: string }> {
    console.info(
      `[StubRenderDeployer] Setting environment variable on ${serviceIdOrUrl}: ${key}=${value}`
    );
    await sleep(500);
    return { success: true };
  }

  async checkHealth(
    url: string,
    path: string
  ): Promise<{ healthy: boolean; status: number; error?: string }> {
    const target = `${url.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    console.info(`[StubRenderDeployer] Checking health at ${target}...`);
    await sleep(200);
    return { healthy: true, status: 200 };
  }

  async waitForHealth(url: string, _path?: string): Promise<boolean> {
    console.info(`[StubRenderDeployer] Waiting for health at ${url}...`);
    await sleep(2000);
    return true;
  }
}

export const stubRender = new StubRenderDeployer();
