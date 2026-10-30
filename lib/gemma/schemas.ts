import { z } from "zod";

export const BlueprintSchema = z.object({
  frontend: z.object({
    framework: z.string(),
    root: z.string(),
    buildCommand: z.string(),
    outputDirectory: z.string(),
    requiredEnv: z.array(z.string()),
  }),
  backend: z
    .object({
      framework: z.string(),
      root: z.string(),
      startCommand: z.string(),
      healthCheckPath: z.string(),
      requiredEnv: z.array(z.string()),
    })
    .nullable(),
  database: z
    .object({
      kind: z.string(),
      requiredEnv: z.array(z.string()),
    })
    .nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string(),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;

export const DeploymentOrderSteps = [
  "deploy_backend",
  "wait_for_backend_health",
  "set_frontend_api_url",
  "set_backend_cors_origin",
  "deploy_frontend",
  "verify_connectivity",
] as const;

export const PlanSchema = z.object({
  deploymentOrder: z.array(z.enum(DeploymentOrderSteps)),
});

export type DeploymentPlan = z.infer<typeof PlanSchema>;

// OpenAPI-subset inlined JSON Schema (no $ref) for Gemini's responseSchema
export const BlueprintJsonSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    frontend: {
      type: "object",
      properties: {
        framework: { type: "string" },
        root: { type: "string" },
        buildCommand: { type: "string" },
        outputDirectory: { type: "string" },
        requiredEnv: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["framework", "root", "buildCommand", "outputDirectory", "requiredEnv"],
    },
    backend: {
      type: "object",
      nullable: true,
      properties: {
        framework: { type: "string" },
        root: { type: "string" },
        startCommand: { type: "string" },
        healthCheckPath: { type: "string" },
        requiredEnv: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["framework", "root", "startCommand", "healthCheckPath", "requiredEnv"],
    },
    database: {
      type: "object",
      nullable: true,
      properties: {
        kind: { type: "string" },
        requiredEnv: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["kind", "requiredEnv"],
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
    notes: { type: "string" },
  },
  required: ["frontend", "backend", "database", "confidence", "notes"],
};

export const PlanJsonSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    deploymentOrder: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "deploy_backend",
          "wait_for_backend_health",
          "set_frontend_api_url",
          "set_backend_cors_origin",
          "deploy_frontend",
          "verify_connectivity",
        ],
      },
    },
  },
  required: ["deploymentOrder"],
};
