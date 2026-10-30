import { RepoFacts } from "@/lib/analyze-repo";
import { prisma } from "@/lib/prisma";
import { generateStructured } from "./client";
import {
  Blueprint,
  BlueprintSchema,
  BlueprintJsonSchema,
  DeploymentPlan,
  PlanSchema,
  PlanJsonSchema,
} from "./schemas";

export interface GenerateBlueprintInput {
  facts: RepoFacts;
  files: Map<string, string>;
  analysisId?: string;
}

export interface GenerateBlueprintResult {
  blueprint: Blueprint;
  plan: DeploymentPlan;
}

function buildFileExcerpts(files: Map<string, string>): string {
  let totalChars = 0;
  const maxTotalChars = 30000;
  const maxPerFileChars = 4096;
  const excerpts: string[] = [];

  for (const [path, content] of Array.from(files.entries())) {
    if (totalChars >= maxTotalChars) break;

    const truncatedContent = content.slice(0, maxPerFileChars);
    const excerpt = `--- FILE: ${path} ---\n${truncatedContent}\n`;

    if (totalChars + excerpt.length > maxTotalChars) {
      const remaining = maxTotalChars - totalChars;
      excerpts.push(excerpt.slice(0, remaining));
      break;
    }

    excerpts.push(excerpt);
    totalChars += excerpt.length;
  }

  return excerpts.join("\n");
}

export async function generateBlueprint(
  input: GenerateBlueprintInput
): Promise<GenerateBlueprintResult> {
  const { facts, files, analysisId } = input;
  const fileExcerpts = buildFileExcerpts(files);

  const systemInstructions =
    `SYSTEM: You are DeployPilot's deployment planner. You receive deterministic repository facts and file excerpts. The facts are AUTHORITATIVE — do not contradict them. Fill only the fields the facts leave blank (buildCommand, startCommand, healthCheckPath, outputDirectory, requiredEnv). If facts are insufficient, set confidence: "low" and explain in notes. For database: if facts.databases has exactly one entry, use it. If zero entries, set database to null. If two or more, choose one only if the excerpts make it obvious; otherwise set database to null and note the ambiguity in notes. Never introduce a database kind that does not appear in facts.databases. Return JSON matching the provided schema. No markdown. No prose.`;

  const userPrompt = `${systemInstructions}

REPOSITORY FACTS (AUTHORITATIVE):
${JSON.stringify(facts, null, 2)}

FILE EXCERPTS:
${fileExcerpts}

BLUEPRINT JSON SCHEMA:
${JSON.stringify(BlueprintJsonSchema, null, 2)}
`;

  // 1. Generate and validate Blueprint
  let rawBlueprint: unknown = await generateStructured<unknown>({
    prompt: userPrompt,
    responseSchema: BlueprintJsonSchema,
  });

  let parsedBlueprint = BlueprintSchema.safeParse(rawBlueprint);

  if (!parsedBlueprint.success) {
    // Retry ONCE with error appended
    const retryPrompt = `${userPrompt}\n\nYour previous output failed schema validation: ${parsedBlueprint.error.message}. Return only JSON that matches the schema.`;
    rawBlueprint = await generateStructured<unknown>({
      prompt: retryPrompt,
      responseSchema: BlueprintJsonSchema,
    });
    parsedBlueprint = BlueprintSchema.safeParse(rawBlueprint);

    if (!parsedBlueprint.success) {
      throw new Error(
        `Gemma blueprint failed schema validation on retry: ${parsedBlueprint.error.message}`
      );
    }
  }

  const blueprint = parsedBlueprint.data;
  const conflictNotes: string[] = [];

  // 2. Authoritative Facts Rules: Frontend checks
  if (facts.frontends.length === 0) {
    if (blueprint.frontend) {
      // Facts say 0, Gemma proposed frontend: keep frontend but cap confidence at "low"
      blueprint.confidence = "low";
      const note =
        "Gemma proposed a frontend but no frontend was detected. Frontend retained with low confidence.";
      conflictNotes.push(note);
      await logConflict(analysisId, "frontend", blueprint.frontend, null, "medium");
    }
  } else if (facts.frontends.length === 1) {
    const factFe = facts.frontends[0];
    if (factFe.framework && blueprint.frontend && blueprint.frontend.framework !== factFe.framework) {
      const gemmaVal = blueprint.frontend.framework;
      blueprint.frontend.framework = factFe.framework;
      conflictNotes.push(
        `Gemma disagreed with deterministic detection on frontend framework; kept fact (${factFe.framework} vs ${gemmaVal}).`
      );
      if (blueprint.confidence === "high") blueprint.confidence = "medium";
      await logConflict(analysisId, "frontend.framework", gemmaVal, factFe.framework, "low");
    }
    if (factFe.root !== undefined && blueprint.frontend && blueprint.frontend.root !== factFe.root) {
      const gemmaVal = blueprint.frontend.root;
      blueprint.frontend.root = factFe.root;
      conflictNotes.push(
        `Gemma disagreed with deterministic detection on frontend root; kept fact (${factFe.root} vs ${gemmaVal}).`
      );
      if (blueprint.confidence === "high") blueprint.confidence = "medium";
      await logConflict(analysisId, "frontend.root", gemmaVal, factFe.root, "low");
    }
  }

  // 3. Authoritative Facts Rules: Backend checks
  if (facts.backends.length === 0) {
    if (blueprint.backend !== null && blueprint.backend !== undefined) {
      // Facts say 0, Gemma proposed backend: set null, confidence = "low"
      const proposedBackend = blueprint.backend;
      blueprint.backend = null;
      blueprint.confidence = "low";
      const note =
        "Gemma proposed a backend but no backend was detected. Supply backend settings manually.";
      conflictNotes.push(note);
      await logConflict(analysisId, "backend", proposedBackend, null, "medium");
    }
  } else if (facts.backends.length === 1) {
    const factBe = facts.backends[0];
    if (blueprint.backend === null || blueprint.backend === undefined) {
      // Facts say 1, Gemma proposed null: restore fact, cap confidence
      blueprint.backend = {
        framework: factBe.framework,
        root: factBe.root,
        startCommand: factBe.startCommand || "node src/server.js",
        healthCheckPath: factBe.healthCheckPath || "/health",
        requiredEnv: factBe.requiredEnv,
      };
      if (blueprint.confidence === "high") blueprint.confidence = "medium";
      conflictNotes.push("Gemma omitted backend but backend was detected; kept fact.");
      await logConflict(analysisId, "backend", null, factBe, "medium");
    } else {
      if (factBe.framework && blueprint.backend.framework !== factBe.framework) {
        const gemmaVal = blueprint.backend.framework;
        blueprint.backend.framework = factBe.framework;
        conflictNotes.push(
          `Gemma disagreed with deterministic detection on backend framework; kept fact (${factBe.framework} vs ${gemmaVal}).`
        );
        if (blueprint.confidence === "high") blueprint.confidence = "medium";
        await logConflict(analysisId, "backend.framework", gemmaVal, factBe.framework, "low");
      }
      if (factBe.root !== undefined && blueprint.backend.root !== factBe.root) {
        const gemmaVal = blueprint.backend.root;
        blueprint.backend.root = factBe.root;
        conflictNotes.push(
          `Gemma disagreed with deterministic detection on backend root; kept fact (${factBe.root} vs ${gemmaVal}).`
        );
        if (blueprint.confidence === "high") blueprint.confidence = "medium";
        await logConflict(analysisId, "backend.root", gemmaVal, factBe.root, "low");
      }
    }
  }

  // 4. Authoritative Facts Rules: Database checks
  if (facts.databases.length === 0 && blueprint.database !== null) {
    const gemmaDb = blueprint.database;
    blueprint.database = null;
    conflictNotes.push("Gemma proposed a database but no database was detected in repository facts; set to null.");
    if (blueprint.confidence === "high") blueprint.confidence = "medium";
    await logConflict(analysisId, "database", gemmaDb, null, "low");
  } else if (
    facts.databases.length > 0 &&
    blueprint.database !== null &&
    !facts.databases.some((d) => d.kind.toLowerCase() === blueprint.database?.kind.toLowerCase())
  ) {
    const gemmaDb = blueprint.database;
    blueprint.database = {
      kind: facts.databases[0].kind,
      requiredEnv: blueprint.database.requiredEnv,
    };
    conflictNotes.push(
      `Gemma introduced unverified database kind '${gemmaDb.kind}'; overridden with detected '${facts.databases[0].kind}'.`
    );
    if (blueprint.confidence === "high") blueprint.confidence = "medium";
    await logConflict(analysisId, "database.kind", gemmaDb.kind, facts.databases[0].kind, "low");
  }

  if (conflictNotes.length > 0) {
    blueprint.notes = `${blueprint.notes ? `${blueprint.notes} ` : ""}${conflictNotes.join(" ")}`.trim();
  }

  // 5. Generate and validate Plan
  const planPrompt = `SYSTEM: You are DeployPilot's deployment execution planner. Confirm the deployment sequence for this validated blueprint.
The only allowed operations are: "deploy_backend", "wait_for_backend_health", "set_frontend_api_url", "set_backend_cors_origin", "deploy_frontend", "verify_connectivity".
Return JSON matching the schema with the deploymentOrder array.

VALIDATED BLUEPRINT:
${JSON.stringify(blueprint, null, 2)}

PLAN JSON SCHEMA:
${JSON.stringify(PlanJsonSchema, null, 2)}
`;

  let rawPlan: unknown = await generateStructured<unknown>({
    prompt: planPrompt,
    responseSchema: PlanJsonSchema,
  });

  let parsedPlan = PlanSchema.safeParse(rawPlan);

  if (!parsedPlan.success) {
    // Retry once
    const retryPlanPrompt = `${planPrompt}\n\nYour previous output failed schema validation: ${parsedPlan.error.message}. Return only JSON matching the schema.`;
    rawPlan = await generateStructured<unknown>({
      prompt: retryPlanPrompt,
      responseSchema: PlanJsonSchema,
    });
    parsedPlan = PlanSchema.safeParse(rawPlan);

    if (!parsedPlan.success) {
      throw new Error(
        `Gemma deployment plan failed schema validation on retry: ${parsedPlan.error.message}`
      );
    }
  }

  return {
    blueprint,
    plan: parsedPlan.data,
  };
}

async function logConflict(
  analysisId: string | undefined,
  field: string,
  gemmaValue: unknown,
  factValue: unknown,
  riskLevel: "low" | "medium" = "low"
): Promise<void> {
  try {
    await prisma.actionLog.create({
      data: {
        analysisId: analysisId || null,
        actor: "AGENT",
        action: "blueprint_conflict_resolved",
        target: field,
        status: "ok",
        riskLevel,
        detailsJson: JSON.stringify({ field, fact: factValue, gemma: gemmaValue }),
      },
    });
  } catch (err: unknown) {
    console.error("Failed to insert blueprint_conflict_resolved ActionLog row:", err);
  }
}
