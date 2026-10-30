import { Deployer, DeployResult, DeployConfig } from "./types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class StubVercelDeployer implements Deployer {
  async deploy(
    serviceType: "frontend" | "backend",
    repoUrl: string,
    name: string,
    config: DeployConfig,
    envVars: Record<string, string>
  ): Promise<DeployResult> {
    console.info(
      `[StubVercelDeployer] Deploying ${serviceType} '${name}' from ${repoUrl} with root '${config?.rootDirectory || "."}' and buildCommand '${config?.buildCommand || "npm run build"}'`
    );
    console.info(
      `[StubVercelDeployer] Injected environment variables:`,
      Object.keys(envVars)
    );

    await sleep(3000);

    const generatedUrl = "https://stub-frontend.vercel.app";
    console.info(
      `[StubVercelDeployer] Deployment successful. Generated URL: ${generatedUrl}`
    );

    return {
      success: true,
      url: generatedUrl,
      serviceId: `stub-vercel-${Date.now()}`,
      logs: [
        `Cloning ${repoUrl}...`,
        `Detected framework: ${config?.framework || "vite"}`,
        `Running ${config?.buildCommand || "npm run build"}...`,
        `Build finished. Output directory: ${config?.outputDirectory || "dist"}`,
        `Deployed to ${generatedUrl}`,
      ],
    };
  }

  async setEnvVar(
    serviceIdOrUrl: string,
    key: string,
    value: string
  ): Promise<{ success: boolean; error?: string }> {
    console.info(
      `[StubVercelDeployer] Setting environment variable on ${serviceIdOrUrl}: ${key}=${value}`
    );
    await sleep(500);
    return { success: true };
  }

  async checkHealth(
    url: string,
    path: string
  ): Promise<{ healthy: boolean; status: number; error?: string }> {
    const target = `${url.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    console.info(`[StubVercelDeployer] Checking health at ${target}...`);
    await sleep(200);
    return { healthy: true, status: 200 };
  }

  async waitForHealth(url: string, _path?: string): Promise<boolean> {
    console.info(`[StubVercelDeployer] Waiting for health at ${url}...`);
    await sleep(2000);
    return true;
  }
}

export const stubVercel = new StubVercelDeployer();
