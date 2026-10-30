import { RepoTreeItem } from "./github";

export interface FrontendFact {
  root: string;
  framework: string;
  buildCommand?: string;
  outputDirectory?: string;
  requiredEnv: string[];
  evidence: string[];
}

export interface BackendFact {
  root: string;
  framework: string;
  startCommand?: string;
  healthCheckPath?: string;
  requiredEnv: string[];
  evidence: string[];
}

export interface DatabaseFact {
  kind: string;
  evidence: string[];
}

export interface RepoFacts {
  root: {
    path: string;
    packageManager: string;
    hasLockfile: boolean;
  };
  frontends: FrontendFact[];
  backends: BackendFact[];
  databases: DatabaseFact[];
  warnings: string[];
  truncated: boolean;
}

export interface AnalyzeRepoInput {
  owner: string;
  name: string;
  ref: string;
  tree: RepoTreeItem[] & { truncated?: boolean };
  files: Map<string, string>;
}

export function analyzeRepo(input: AnalyzeRepoInput): RepoFacts {
  const { tree, files } = input;
  const warnings: string[] = [];
  const truncated = Boolean(tree.truncated);

  if (truncated) {
    warnings.push("truncated tree");
  }

  // 1. Detect Root Package Manager and Lockfile
  let packageManager = "npm";
  let hasLockfile = false;

  if (files.has("pnpm-lock.yaml") || tree.some((t) => t.path === "pnpm-lock.yaml")) {
    packageManager = "pnpm";
    hasLockfile = true;
  } else if (files.has("yarn.lock") || tree.some((t) => t.path === "yarn.lock")) {
    packageManager = "yarn";
    hasLockfile = true;
  } else if (files.has("package-lock.json") || tree.some((t) => t.path === "package-lock.json")) {
    packageManager = "npm";
    hasLockfile = true;
  }

  // 2. Identify all package.json files
  const packageJsonPaths: string[] = [];
  for (const [filePath] of Array.from(files.entries())) {
    if (filePath.endsWith("package.json")) {
      packageJsonPaths.push(filePath);
    }
  }

  // Also check tree paths if not already in files
  for (const item of tree) {
    if (item.type === "blob" && item.path.endsWith("package.json") && !packageJsonPaths.includes(item.path)) {
      packageJsonPaths.push(item.path);
    }
  }

  // Monorepo check: multiple package.json files across directories
  if (packageJsonPaths.length > 1) {
    warnings.push("monorepo detected");
  }

  // 3. Scan for Environment Variables across all fetched files
  const allRequiredEnv = new Set<string>();

  // Check .env.example specifically
  const envExampleContent = files.get(".env.example") || "";
  if (envExampleContent) {
    const lines = envExampleContent.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
        if (match && match[1]) {
          allRequiredEnv.add(match[1]);
        }
      }
    }
  }

  // Regex scan across all files for process.env.X and import.meta.env.VITE_X
  const procEnvRegex = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g;
  const viteEnvRegex = /import\.meta\.env\.(VITE_[A-Za-z0-9_]*)/g;

  for (const [, content] of Array.from(files.entries())) {
    let match: RegExpExecArray | null;
    while ((match = procEnvRegex.exec(content)) !== null) {
      const varName = match[1];
      if (varName && !["NODE_ENV", "PORT"].includes(varName)) {
        allRequiredEnv.add(varName);
      }
    }
    while ((match = viteEnvRegex.exec(content)) !== null) {
      const varName = match[1];
      if (varName) {
        allRequiredEnv.add(varName);
      }
    }
  }

  const sortedEnvVars = Array.from(allRequiredEnv).sort();

  // 4. Detect Frontends and Backends
  const frontends: FrontendFact[] = [];
  const backends: BackendFact[] = [];

  for (const pkgPath of packageJsonPaths) {
    const content = files.get(pkgPath);
    if (!content) continue;

    let pkgJson: Record<string, any>;
    try {
      pkgJson = JSON.parse(content);
    } catch {
      continue;
    }

    const dirPath = pkgPath === "package.json" ? "." : pkgPath.replace(/\/package\.json$/, "");
    const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) };
    const scripts = pkgJson.scripts || {};

    // Check Next.js
    if (deps["next"]) {
      const evidence: string[] = [`${pkgPath} has next`];
      let distDir = ".next";

      // Check next.config.*
      for (const [fPath, fContent] of Array.from(files.entries())) {
        if (fPath.startsWith(dirPath === "." ? "" : `${dirPath}/`) && fPath.includes("next.config.")) {
          evidence.push(`${fPath} exists`);
          const match = fContent.match(/distDir:\s*['"]([^'"]+)['"]/);
          if (match && match[1]) {
            distDir = match[1];
            evidence.push(`custom distDir '${distDir}' in ${fPath}`);
          }
        }
      }

      const buildCommand = scripts["build"]
        ? `${packageManager === "npm" ? "npm run" : packageManager} build`
        : "next build";

      frontends.push({
        root: dirPath,
        framework: "next",
        buildCommand,
        outputDirectory: distDir,
        requiredEnv: sortedEnvVars,
        evidence,
      });
    }
    // Check React + Vite
    else if (
      (deps["react"] || deps["react-dom"]) &&
      (deps["vite"] || deps["@vitejs/plugin-react"] || tree.some((t) => t.path.includes("vite.config.")))
    ) {
      const evidence: string[] = [`${pkgPath} has react+vite`];
      let outDir = "dist";

      // Check vite.config.*
      for (const [fPath, fContent] of Array.from(files.entries())) {
        if (fPath.startsWith(dirPath === "." ? "" : `${dirPath}/`) && fPath.includes("vite.config.")) {
          evidence.push(`${fPath} exists`);
          const match = fContent.match(/outDir:\s*['"]([^'"]+)['"]/);
          if (match && match[1]) {
            outDir = match[1];
            evidence.push(`custom outDir '${outDir}' in ${fPath}`);
          }
        }
      }

      const buildCommand = scripts["build"]
        ? `${packageManager === "npm" ? "npm run" : packageManager} build`
        : "vite build";

      frontends.push({
        root: dirPath,
        framework: "vite",
        buildCommand,
        outputDirectory: outDir,
        requiredEnv: sortedEnvVars.filter((e) => e.startsWith("VITE_") || e.includes("API") || e.includes("URL")),
        evidence,
      });
    }

    // Check Node Backend: Express, Fastify, Koa
    if (deps["express"] || deps["fastify"] || deps["koa"]) {
      const framework = deps["express"] ? "express" : deps["fastify"] ? "fastify" : "koa";
      const evidence: string[] = [`${pkgPath} has ${framework}`];

      let startCommand = "node src/server.js";
      if (scripts["start"]) {
        startCommand = scripts["start"];
        evidence.push(`scripts.start found: '${startCommand}'`);
      } else if (scripts["dev"]) {
        evidence.push(`scripts.dev found`);
      }

      backends.push({
        root: dirPath,
        framework,
        startCommand,
        healthCheckPath: "/health",
        requiredEnv: sortedEnvVars.filter((e) => !e.startsWith("VITE_")),
        evidence,
      });
    }
  }

  // Check Python backend from requirements.txt
  for (const [filePath, content] of Array.from(files.entries())) {
    if (filePath.endsWith("requirements.txt")) {
      const dirPath = filePath === "requirements.txt" ? "." : filePath.replace(/\/requirements\.txt$/, "");
      const lower = content.toLowerCase();

      if (lower.includes("fastapi")) {
        backends.push({
          root: dirPath,
          framework: "fastapi",
          startCommand: "uvicorn main:app --host 0.0.0.0 --port 8000",
          healthCheckPath: "/health",
          requiredEnv: sortedEnvVars.filter((e) => !e.startsWith("VITE_")),
          evidence: [`${filePath} contains fastapi`],
        });
      } else if (lower.includes("flask")) {
        backends.push({
          root: dirPath,
          framework: "flask",
          startCommand: "python app.py",
          healthCheckPath: "/health",
          requiredEnv: sortedEnvVars.filter((e) => !e.startsWith("VITE_")),
          evidence: [`${filePath} contains flask`],
        });
      } else if (lower.includes("django")) {
        backends.push({
          root: dirPath,
          framework: "django",
          startCommand: "python manage.py runserver 0.0.0.0:8000",
          healthCheckPath: "/health",
          requiredEnv: sortedEnvVars.filter((e) => !e.startsWith("VITE_")),
          evidence: [`${filePath} contains django`],
        });
      }
    }
  }

  // 5. Detect Databases
  const databases: DatabaseFact[] = [];
  const dbEvidenceCombined = Array.from(files.entries())
    .map(([path, c]) => `${path}: ${c.slice(0, 1000)}`)
    .join("\n")
    .toLowerCase();

  if (dbEvidenceCombined.includes("mongo") || dbEvidenceCombined.includes("mongoose")) {
    databases.push({
      kind: "mongodb",
      evidence: ["MongoDB/Mongoose references detected in dependencies or environment"],
    });
  }

  if (
    dbEvidenceCombined.includes("postgres") ||
    dbEvidenceCombined.includes("psycopg") ||
    dbEvidenceCombined.includes("pg")
  ) {
    databases.push({
      kind: "postgres",
      evidence: ["PostgreSQL references detected in dependencies or environment"],
    });
  }

  if (dbEvidenceCombined.includes("sqlite")) {
    databases.push({
      kind: "sqlite",
      evidence: ["SQLite references detected in dependencies or environment"],
    });
  }

  // Warnings for multiple candidates
  if (frontends.length > 1) {
    warnings.push("multiple frontends detected");
  }
  if (backends.length > 1) {
    warnings.push("multiple backends detected");
  }

  return {
    root: {
      path: ".",
      packageManager,
      hasLockfile,
    },
    frontends,
    backends,
    databases,
    warnings,
    truncated,
  };
}
