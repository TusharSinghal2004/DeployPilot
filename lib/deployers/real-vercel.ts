import { Deployer, DeployResult, DeployConfig } from "./types";

const VERCEL_BASE_URL = "https://api.vercel.com";

// Cache projects/urls
const projectNameToIdMap = new Map<string, string>();

function parseGithubRepo(repoUrl: string): { org: string; repo: string } {
  try {
    const parsed = new URL(repoUrl);
    const parts = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length >= 2) {
      return { org: parts[0], repo: parts[1] };
    }
  } catch {
    // fallback
  }
  return { org: "owner", repo: "repo" };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForVercelHealth(
  url: string,
  path: string = "/",
  maxWaitMs: number = 3 * 60 * 1000
): Promise<boolean> {
  const startTime = Date.now();
  const pollIntervalMs = 5000;
  let attempt = 0;

  const target = `${url.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  console.info(
    `[RealVercelDeployer] Starting health polling on ${target} (max 3 minutes, every 5s)...`
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
          `[RealVercelDeployer] Frontend health check passed (HTTP 200) after ${elapsedSeconds}s (attempt ${attempt})`
        );
        return true;
      }

      console.info(
        `[RealVercelDeployer] Poll attempt ${attempt} (${elapsedSeconds}s): status ${res.status}. Retrying in 5s...`
      );
    } catch (err: any) {
      console.info(
        `[RealVercelDeployer] Poll attempt ${attempt} (${elapsedSeconds}s): ${err.message || "probe failed"}. Retrying in 5s...`
      );
    }

    await sleep(pollIntervalMs);
  }

  console.error(
    `[RealVercelDeployer] Frontend health check timed out after ${Math.round(maxWaitMs / 1000)}s`
  );
  return false;
}

export class RealVercelDeployer implements Deployer {
  private getApiToken(): string {
    const token = process.env.VERCEL_API_TOKEN?.trim();
    if (!token) {
      throw new Error(
        "VERCEL_API_TOKEN is not defined in environment variables"
      );
    }
    return token;
  }

  async deploy(
    serviceType: "frontend" | "backend",
    repoUrl: string,
    name: string,
    config: DeployConfig,
    envVars: Record<string, string>
  ): Promise<DeployResult> {
    const token = this.getApiToken();
    const { org, repo } = parseGithubRepo(repoUrl);

    // Vercel project name: lowercase alphanumeric, hyphens, <= 52 chars
    const sanitizedName = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 52)
      .replace(/^-|-$/g, "");

    const payload = {
      name: sanitizedName || `vercel-service-${Date.now()}`,
      gitSource: {
        type: "github",
        org,
        repo,
        ref: config.branch || "main",
      },
      projectSettings: {
        framework: config.framework === "vite" ? "vite" : config.framework === "next" ? "nextjs" : null,
        rootDirectory: config.rootDirectory || null,
        buildCommand: config.buildCommand || null,
        outputDirectory: config.outputDirectory || null,
      },
    };

    console.info(
      `[RealVercelDeployer] Sending POST /v13/deployments for ${serviceType} '${sanitizedName}'...`
    );

    const res = await fetch(`${VERCEL_BASE_URL}/v13/deployments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
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
        `Vercel API error (${res.status}): ${errMsg || "Failed to create deployment"}`
      );
    }

    const data = (await res.json()) as {
      id: string;
      name: string;
      url: string;
      readyState?: string;
      projectId?: string;
    };

    const formattedUrl = data.url.startsWith("http")
      ? data.url
      : `https://${data.url}`;

    const resolvedProject = (data as any).projectId || data.name || sanitizedName;
    projectNameToIdMap.set(sanitizedName, resolvedProject);
    projectNameToIdMap.set(formattedUrl, resolvedProject);
    projectNameToIdMap.set(data.url, resolvedProject);
    projectNameToIdMap.set(data.id, resolvedProject);

    console.info(
      `[RealVercelDeployer] Deployment created with ID ${data.id} at ${formattedUrl} (project: ${resolvedProject})`
    );

    // If env vars were provided upfront, inject them
    for (const [key, val] of Object.entries(envVars)) {
      try {
        await this.setEnvVar(sanitizedName, key, val);
      } catch (envErr) {
        console.warn(`[RealVercelDeployer] Warning injecting env ${key}:`, envErr);
      }
    }

    return {
      success: true,
      serviceId: data.id,
      url: formattedUrl,
      logs: [
        `Vercel deployment initiated: ${data.id}`,
        `Target URL: ${formattedUrl}`,
      ],
    };
  }

  async setEnvVar(
    serviceIdOrUrl: string,
    key: string,
    value: string
  ): Promise<{ success: boolean; error?: string }> {
    const token = this.getApiToken();

    let projectId = projectNameToIdMap.get(serviceIdOrUrl) || serviceIdOrUrl;
    if (projectId.startsWith("http")) {
      try {
        const host = new URL(projectId).hostname;
        projectId = host.replace(/\.vercel\.app$/, "");
      } catch {
        // fallback
      }
    }

    const payload = {
      key,
      value,
      type: "plain",
      target: ["production", "preview", "development"],
    };

    const maxRetries = 3;
    let lastError = "";

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      console.info(
        `[RealVercelDeployer] Setting env var ${key} on project '${projectId}' (attempt ${attempt + 1}/${maxRetries + 1})...`
      );

      try {
        const res = await fetch(
          `${VERCEL_BASE_URL}/v10/projects/${encodeURIComponent(projectId)}/env`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        if (res.ok) {
          console.info(
            `[RealVercelDeployer] Successfully configured ${key} on Vercel project '${projectId}'`
          );
          return { success: true };
        }

        if (res.status === 404) {
          if (attempt < maxRetries) {
            console.warn(
              `[RealVercelDeployer] Project '${projectId}' returned 404 (not ready yet). Retrying in 10s (attempt ${attempt + 1}/${maxRetries})...`
            );
            await sleep(10000);
            continue;
          } else {
            lastError = `Vercel project '${projectId}' not found (404) after ${maxRetries} retries`;
            break;
          }
        }

        let errMsg = "";
        try {
          const errJson = await res.json();
          errMsg = JSON.stringify(errJson);
        } catch {
          errMsg = await res.text().catch(() => "");
        }

        if (
          errMsg.includes("ENV_ALREADY_EXISTS") ||
          errMsg.includes("already exists") ||
          res.status === 409
        ) {
          console.info(
            `[RealVercelDeployer] Env var ${key} already exists on project '${projectId}'`
          );
          return { success: true };
        }

        lastError = `Vercel API error (${res.status}): ${errMsg}`;
        console.error(`[RealVercelDeployer] setEnvVar error: ${lastError}`);
        break;
      } catch (networkErr: any) {
        lastError = networkErr.message || String(networkErr);
        if (attempt < maxRetries) {
          console.warn(
            `[RealVercelDeployer] Network error on attempt ${attempt + 1}: ${lastError}. Retrying in 10s...`
          );
          await sleep(10000);
          continue;
        }
        break;
      }
    }

    return { success: false, error: lastError };
  }

  async checkHealth(
    url: string,
    path: string = "/"
  ): Promise<{ healthy: boolean; status: number; error?: string }> {
    const target = `${url.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    console.info(`[RealVercelDeployer] Probing health at ${target}...`);

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
    path: string = "/"
  ): Promise<boolean> {
    return waitForVercelHealth(url, path);
  }
}

export const realVercel = new RealVercelDeployer();
