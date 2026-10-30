export type DeployResult = {
  success: boolean;
  url?: string;
  serviceId?: string;
  error?: string;
  logs?: string[];
};

export interface DeployConfig {
  buildCommand?: string;
  startCommand?: string;
  rootDirectory?: string;
  framework?: string;
  branch?: string;
  [key: string]: any;
}

export interface Deployer {
  deploy(
    serviceType: "frontend" | "backend",
    repoUrl: string,
    name: string,
    config: DeployConfig,
    envVars: Record<string, string>
  ): Promise<DeployResult>;

  setEnvVar(
    serviceIdOrUrl: string,
    key: string,
    value: string
  ): Promise<{ success: boolean; error?: string }>;

  checkHealth(
    url: string,
    path: string
  ): Promise<{ healthy: boolean; status: number; error?: string }>;

  waitForHealth(url: string, path?: string): Promise<boolean>;
}
