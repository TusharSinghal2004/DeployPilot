import { Deployer } from "./types";
import { stubRender } from "./stub-render";
import { stubVercel } from "./stub-vercel";
import { realRender } from "./real-render";
import { realVercel } from "./real-vercel";

export * from "./types";
export * from "./stub-render";
export * from "./stub-vercel";
export * from "./real-render";
export * from "./real-vercel";

export interface DeployerSuite {
  render: Deployer;
  vercel: Deployer;
}

export function getDeployers(): DeployerSuite {
  const mode = (process.env.DEPLOY_MODE || "stub").toLowerCase().trim();

  if (mode === "live") {
    const renderKey = process.env.RENDER_API_KEY?.trim();
    const vercelToken = process.env.VERCEL_API_TOKEN?.trim();

    if (!renderKey || !vercelToken) {
      const missing: string[] = [];
      if (!renderKey) missing.push("RENDER_API_KEY");
      if (!vercelToken) missing.push("VERCEL_API_TOKEN");

      throw new Error(
        `DEPLOY_MODE is configured as 'live' but required API credentials are missing: ${missing.join(
          ", "
        )}. Please configure them in your .env file or switch DEPLOY_MODE to 'stub'.`
      );
    }

    console.info("[Deployers] Initialized in LIVE mode with real Render and Vercel cloud deployers.");
    return {
      render: realRender,
      vercel: realVercel,
    };
  }

  console.info("[Deployers] Initialized in STUB mode with simulated deployment latencies.");
  return {
    render: stubRender,
    vercel: stubVercel,
  };
}
