import { Deployer, DeployResult, DeployConfig } from "./types";

const RENDER_BASE_URL = "https://api.render.com/v1";

// Cache service URLs to service IDs
const serviceUrlToIdMap = new Map<string, string>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForHealth(
  url: string,
  path: string = "/health",
  maxWaitMs: number = 5 * 60 * 1000
): Promise<boolean> {
  const startTime = Date.now();
  const pollIntervalMs = 5000;
  let attempt = 0;

  const target = path
    ? `${url.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`
    : url;

  console.info(
    `[RealRenderDeployer] Starting health polling on ${target} (max 5 minutes, every 5s)...`
  );

  while (Date.now() - startTime < maxWaitMs) {
    attempt++;
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(target, {
        method: "GET",
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (res.status === 200) {
        console.info(
          `[RealRenderDeployer] Health check passed (HTTP 200) after ${elapsedSeconds}s (attempt ${attempt})`
        );
        return true;
      }

      if (res.status === 404 && path !== "/") {
        const rootRes = await fetch(url, { method: "GET" }).catch(() => null);
        if (rootRes && rootRes.status === 200) {
          console.info(
            `[RealRenderDeployer] Root health check passed (HTTP 200) after ${elapsedSeconds}s (attempt ${attempt})`
          );
          return true;
        }
      }

      console.info(
        `[RealRenderDeployer] Poll attempt ${attempt} (${elapsedSeconds}s): status ${res.status}. Retrying in 5s...`
      );
    } catch (err: any) {
      console.info(
        `[RealRenderDeployer] Poll attempt ${attempt} (${elapsedSeconds}s): ${err.message || "probe failed"}. Retrying in 5s...`
      );
    }

    await sleep(pollIntervalMs);
  }

  console.error(
    `[RealRenderDeployer] Health check timed out after ${Math.round(maxWaitMs / 1000)}s`
  );
  return false;
}

export class RealRenderDeployer implements Deployer {
  private getApiKey(): string {
    const key = process.env.RENDER_API_KEY?.trim();
    if (!key) {
      throw new Error(
        "RENDER_API_KEY is not defined in environment variables"
      );
    }
    return key;
  }

  private async fetchOwnerId(apiKey: string): Promise<string> {
    const res = await fetch(`${RENDER_BASE_URL}/owners?limit=5`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Failed to retrieve Render owners (${res.status}): ${err}`);
    }

    const owners = (await res.json()) as Array<{ owner: { id: string; name: string } }>;
    if (!owners || owners.length === 0 || !owners[0]?.owner?.id) {
      throw new Error("No Render owner account found for provided RENDER_API_KEY");
    }

    return owners[0].owner.id;
  }

  async deploy(
    serviceType: "frontend" | "backend",
    repoUrl: string,
    name: string,
    config: DeployConfig,
    envVars: Record<string, string>
  ): Promise<DeployResult> {
    const apiKey = this.getApiKey();
    const ownerId = process.env.RENDER_OWNER_ID || (await this.fetchOwnerId(apiKey));

    // Render service name: lowercase alphanumeric + hyphens, <= 32 chars
    const sanitizedName = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 32)
      .replace(/^-|-$/g, "");

    const formattedEnvVars = Object.entries(envVars).map(([key, value]) => ({
      key,
      value,
    }));

    const payload = {
      type: "web_service",
      name: sanitizedName,
      ownerId,
      repo: repoUrl,
      branch: config.branch || "main",
      autoDeploy: "yes",
      serviceDetails: {
        env: "node",
        plan: "starter",
        region: "oregon",
        envSpecificDetails: {
          buildCommand: config.buildCommand || "npm install",
          startCommand: config.startCommand || "npm start",
        },
        rootDir: config.rootDirectory,
      },
    };

    console.info(
      `[RealRenderDeployer] Sending POST /services for ${serviceType} '${sanitizedName}'...`
    );

    const res = await fetch(`${RENDER_BASE_URL}/services`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errMsg = "";
      try {
        const errJson = await res.json();
        errMsg = JSON.stringify(errJson);
      } catch {
        errMsg = await res.text().catch(() => "");
      }
      throw new Error(
        `Render API error (${res.status}): ${errMsg || "Failed to create web service"}`
      );
    }

    const data = (await res.json()) as {
      id: string;
      name: string;
      slug?: string;
      serviceDetails?: { url?: string };
    };

    const serviceUrl =
      data.serviceDetails?.url ||
      (data.slug ? `https://${data.slug}.onrender.com` : `https://${data.name}.onrender.com`);

    serviceUrlToIdMap.set(serviceUrl, data.id);

    console.info(
      `[RealRenderDeployer] Created Render service ${data.id} with URL ${serviceUrl}`
    );

    return {
      success: true,
      serviceId: data.id,
      url: serviceUrl,
      logs: [`Render web service created: ${data.id}`, `Public URL: ${serviceUrl}`],
    };
  }

  async setEnvVar(
    serviceIdOrUrl: string,
    key: string,
    value: string
  ): Promise<{ success: boolean; error?: string }> {
    const apiKey = this.getApiKey();

    let serviceId = serviceIdOrUrl;
    if (serviceIdOrUrl.startsWith("http")) {
      serviceId = serviceUrlToIdMap.get(serviceIdOrUrl) || serviceIdOrUrl;
    }

    console.info(
      `[RealRenderDeployer] Setting env var ${key} on Render service ${serviceId}...`
    );

    const res = await fetch(`${RENDER_BASE_URL}/services/${encodeURIComponent(serviceId)}/env-vars`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify([{ key, value }]),
    });

    if (!res.ok) {
      let errMsg = "";
      try {
        const errJson = await res.json();
        errMsg = JSON.stringify(errJson);
      } catch {
        errMsg = await res.text().catch(() => "");
      }
      throw new Error(`Render API error (${res.status}) on setEnvVar: ${errMsg}`);
    }

    return { success: true };
  }

  async checkHealth(
    url: string,
    path: string
  ): Promise<{ healthy: boolean; status: number; error?: string }> {
    const target = `${url.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    console.info(`[RealRenderDeployer] Probing health at ${target}...`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(target, {
        method: "GET",
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const isHealthy = res.status >= 200 && res.status < 400;
      return { healthy: isHealthy, status: res.status };
    } catch (err: any) {
      return {
        healthy: false,
        status: 0,
        error: err.name === "AbortError" ? "Health check timed out" : err.message,
      };
    }
  }

  async waitForHealth(
    url: string,
    path: string = "/health"
  ): Promise<boolean> {
    return waitForHealth(url, path);
  }
}

export const realRender = new RealRenderDeployer();
