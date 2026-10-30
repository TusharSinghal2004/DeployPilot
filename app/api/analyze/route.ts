import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonOk, jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  getRepoMeta,
  getLatestCommitSha,
  getRepoTree,
  getFileContent,
  GitHubNotFoundError,
  GitHubRateLimitError,
} from "@/lib/github";
import { analyzeRepo } from "@/lib/analyze-repo";
import { generateBlueprint } from "@/lib/gemma/blueprint";
import { GeminiError, GeminiParseError } from "@/lib/gemma/client";

export const runtime = "nodejs";

const analyzeSchema = z.object({
  repoUrl: z
    .string()
    .url("Must be a valid URL")
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return (
            parsed.hostname === "github.com" &&
            parsed.pathname.replace(/^\/+|\/+$/g, "").split("/").length === 2
          );
        } catch {
          return false;
        }
      },
      "Must be a valid GitHub repo URL (https://github.com/owner/name)"
    ),
});

function isCandidateFile(path: string): boolean {
  const parts = path.split("/");
  const fileName = parts[parts.length - 1];

  // Root lockfiles only
  if (parts.length === 1 && ["pnpm-lock.yaml", "yarn.lock", "package-lock.json"].includes(fileName)) {
    return true;
  }

  // package.json: root + up to 2 subdirs of depth 2 (parts.length <= 3)
  if (fileName === "package.json" && parts.length <= 3) {
    return true;
  }

  // Config files and manifests
  const candidateNames = [
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mjs",
    "next.config.ts",
    "next.config.js",
    "next.config.mjs",
    "Dockerfile",
    ".env.example",
    "requirements.txt",
    "render.yaml",
    "vercel.json",
  ];

  if (candidateNames.includes(fileName) && parts.length <= 3) {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  console.info(
    "[analyze] GitHub auth:",
    process.env.GITHUB_TOKEN ? "token" : "unauthenticated"
  );

  let repoUrl = "";
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr("invalid_json", "Malformed JSON request body", 400);
    }

    const validation = analyzeSchema.safeParse(body);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      return jsonErr("validation_error", issue.message, 400);
    }

    repoUrl = validation.data.repoUrl;

    // b. Fetch repo metadata and latest commit SHA
    const meta = await getRepoMeta(repoUrl);
    const commitSha = await getLatestCommitSha(meta.owner, meta.name, meta.defaultBranch);

    // c. Fetch repo tree
    const tree = await getRepoTree(meta.owner, meta.name, commitSha);

    // d. Filter and fetch relevant files, capped at 200KB total
    const filesToFetch = tree.filter(
      (item) => item.type === "blob" && isCandidateFile(item.path)
    );

    const files = new Map<string, string>();
    let totalBytesFetched = 0;
    const MAX_BYTES = 200 * 1024; // 200KB
    let capExceeded = false;

    for (const item of filesToFetch) {
      if (totalBytesFetched >= MAX_BYTES) {
        capExceeded = true;
        break;
      }

      try {
        const content = await getFileContent(meta.owner, meta.name, commitSha, item.path);
        const contentBytes = Buffer.byteLength(content, "utf8");

        if (totalBytesFetched + contentBytes > MAX_BYTES) {
          const allowedBytes = MAX_BYTES - totalBytesFetched;
          files.set(item.path, content.slice(0, allowedBytes));
          totalBytesFetched = MAX_BYTES;
          capExceeded = true;
          break;
        }

        files.set(item.path, content);
        totalBytesFetched += contentBytes;
      } catch (err: unknown) {
        // If an individual file fails to load, continue with remaining
        console.warn(`Could not fetch file ${item.path}:`, err);
      }
    }

    // e. Deterministic repo analysis
    const facts = analyzeRepo({
      owner: meta.owner,
      name: meta.name,
      ref: commitSha,
      tree,
      files,
    });

    if (capExceeded) {
      facts.warnings.push("Fetched files capped at 200KB limit");
    }

    // f. ActionLog: analyze_repo
    await prisma.actionLog.create({
      data: {
        actor: "USER",
        action: "analyze_repo",
        target: repoUrl,
        status: "ok",
        riskLevel: "none",
        detailsJson: JSON.stringify({
          owner: meta.owner,
          name: meta.name,
          defaultBranch: meta.defaultBranch,
          commitSha,
        }),
      },
    });

    // g. Gemma Blueprint & Plan generation
    let blueprint;
    let plan;

    try {
      const gemmaResult = await generateBlueprint({
        facts,
        files,
      });
      blueprint = gemmaResult.blueprint;
      plan = gemmaResult.plan;
    } catch (gemmaErr: unknown) {
      const errMsg = (gemmaErr as Error).message || "Gemini blueprint generation failed";
      await prisma.actionLog.create({
        data: {
          actor: "AGENT",
          action: "generate_blueprint",
          target: repoUrl,
          status: "error",
          riskLevel: "low",
          detailsJson: JSON.stringify({ error: errMsg }),
        },
      });

      return jsonErr("gemini_error", errMsg, 502);
    }

    // h. ActionLog: generate_blueprint
    await prisma.actionLog.create({
      data: {
        actor: "GEMMA",
        action: "generate_blueprint",
        target: repoUrl,
        status: "ok",
        riskLevel: "none",
        detailsJson: JSON.stringify({
          confidence: blueprint.confidence,
          notes: blueprint.notes,
        }),
      },
    });

    // i. Insert Analysis row
    const analysis = await prisma.analysis.create({
      data: {
        repoUrl,
        repoOwner: meta.owner,
        repoName: meta.name,
        defaultBranch: meta.defaultBranch,
        commitSha,
        factsJson: JSON.stringify(facts),
        blueprintJson: JSON.stringify(blueprint),
        planJson: JSON.stringify(plan),
        confidence: blueprint.confidence,
      },
    });

    // j. Return result
    return jsonOk(
      {
        analysisId: analysis.id,
        facts,
        blueprint,
        plan,
        confidence: blueprint.confidence,
      },
      200
    );
  } catch (err: unknown) {
    const errMsg = (err as Error)?.message || "An unexpected error occurred during repository analysis";
    console.error("[analyze] Error occurred during analysis:", err);

    if (repoUrl) {
      try {
        await prisma.actionLog.create({
          data: {
            actor: "AGENT",
            action: "analyze_repo",
            target: repoUrl,
            status: "error",
            riskLevel: "low",
            detailsJson: JSON.stringify({ error: errMsg }),
          },
        });
      } catch {
        // ignore DB write failure during error handling
      }
    }

    if (err instanceof GitHubNotFoundError) {
      return jsonErr("not_found", err.message, 404);
    }

    if (err instanceof GitHubRateLimitError) {
      return NextResponse.json(
        {
          error: {
            code: "rate_limit_exceeded",
            message: err.message,
            resetAt: err.resetAt,
          },
          code: "rate_limit_exceeded",
          message: err.message,
          resetAt: err.resetAt,
        },
        { status: 429 }
      );
    }

    if (errMsg.includes("timed out")) {
      return jsonErr("timeout", errMsg, 504);
    }

    if (err instanceof GeminiError || err instanceof GeminiParseError) {
      return jsonErr("gemini_error", errMsg, 502);
    }

    return jsonErr("internal_server_error", errMsg, 500);
  }
}
