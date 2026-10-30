# DeployPilot 🚀
### *An Autonomous AI Deployment Orchestrator*

[![Next.js](https://img.shields.io/badge/Next.js-14_App_Router-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-Gemma_AI-8E75B2?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![Render](https://img.shields.io/badge/Render-Backend_Cloud-46E3B7?style=for-the-badge&logo=render)](https://render.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Frontend_Cloud-black?style=for-the-badge&logo=vercel)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

## 📌 1. Overview
**DeployPilot** is an intelligent deployment engine that bridges the gap between raw Git repositories and multi-cloud production environments. Instead of wrestling with fragmented dashboards, guessing build commands, and manually copy-pasting interdependent environment variables, DeployPilot inspects your codebase deterministically, uses Google Gemma AI to formulate an authoritative deployment plan, and autonomously orchestrates the build, health polling, and cross-service environment wiring.

---

## 💥 2. The Problem
Modern full-stack applications are rarely monolithic single-button deploys. They split frontend (React/Vite/Next.js) on edge platforms like **Vercel** and backend services (Node/Express/Python) on compute platforms like **Render**.

This introduces the painful **"Deployment Chicken-and-Egg Catch-22"**:
1. **Interdependent Variables**: 
   - The Frontend requires `VITE_API_URL` pointing to the live Backend URL.
   - The Backend requires `FRONTEND_URL` to configure strict CORS origins.
2. **Manual Juggling**:
   - You must deploy one service first (which inevitably fails or runs half-broken).
   - You wait 3 minutes for a domain to be provisioned.
   - You copy the generated URL, open the other provider's dashboard, paste it into environment variables, trigger a manual rebuild, and wait again.
3. **Fragile and Error-Prone**:
   - A single misnamed environment variable (`API_URL` vs `VITE_API_URL` vs `REACT_APP_BACKEND_URL`) or port mismatch breaks the entire build silently.
4. **Zero Observability**:
   - During multi-cloud deployments, developers are left staring at disjointed browser tabs, hoping services come online in the right order.

---

## 💡 3. The Solution
DeployPilot replaces manual dashboard babysitting with a **Deterministic Analysis + Gemma AI Orchestration Loop**:

```
[GitHub Repository]
         │
         ▼
[Deterministic Fact Extractor] ── (Files, package.json, framework, ports, env keys)
         │
         ▼
[Gemma AI Structured Planner]  ── (Authoritative schema: blueprint & ordered steps)
         │
         ▼
[Human-in-the-Loop Approval]   ── (One-click inspection & validation)
         │
         ▼
[Orchestrator State Machine]
   ├── 1. Deploy Backend (Render)
   ├── 2. Poll Backend /health every 5s until HTTP 200
   ├── 3. Deploy Frontend (Vercel)
   ├── 4. Poll Frontend / every 5s until HTTP 200
   ├── 5. Wire VITE_API_URL to Vercel via REST API (with 404 retries)
   ├── 6. Wire FRONTEND_URL to Render for CORS
   └── 7. Mark Deployments Ready & Healthy
         │
         ▼
[Live Action Timeline (SSE)]   ── (Real-time, color-coded streaming audit trail)
```

- **Deterministic Ground Truth**: We never let the LLM hallucinate repo facts. Package manifests, framework indicators, entrypoints, and required env vars are extracted through deterministic AST & regex scanning first.
- **Strict Gemma Schema**: Gemma acts as the planner to fill blank configuration fields and produce a risk-assessed, step-by-step execution plan adhering to strict JSON schemas.
- **Resilient Polling & Wiring Loop**: Automatically polls cloud health endpoints and handles asynchronous cloud provider provisioning delays with exponential backoff and retry guards.
- **Server-Sent Events (SSE) Timeline**: A high-contrast, real-time audit log streaming every action, target, actor, and status live to the developer.
- **Ephemeral Gated Previews**: JWT-signed, password-protectable preview links with automated TTL expiration.

---

## 📸 4. Screenshots & Walkthrough

| Live Action Timeline | Repository Analysis & Blueprint |
| :---: | :---: |
| ![Timeline Dashboard](./screenshots/timeline.png) | ![Hero & Analysis](./screenshots/hero.png) |
| *Real-time SSE stream tracking health polling & wiring* | *Deterministic fact extraction + Gemma AI planning* |

| Deployments Management | Ephemeral Preview Gating |
| :---: | :---: |
| ![Deployments Dashboard](./screenshots/deployments.png) | ![Preview Gating](./screenshots/preview.png) |
| *Status tracking, provider links, and health metrics* | *Password-protected, timed access to preview URLs* |

---

## ⚡ 5. Quick Start (Local Development)

### Prerequisites
- **Node.js** (v18.17+ or v20+)
- **pnpm** (`npm install -g pnpm` or `corepack enable pnpm`)
- **Google Gemini API Key** ([Get free key from Google AI Studio](https://aistudio.google.com/))
- *(Optional for Live Cloud Mode)*: **Render API Key** & **Vercel API Token**

### 1. Clone & Install
```bash
git clone https://github.com/TusharSinghal2004/hacktobber-demo.git
cd hacktobber-demo
pnpm install
```

### 2. Configure Environment Variables
Copy the template and fill in your secrets:
```bash
cp .env.example .env
```

Your `.env` file structure:
```env
# Database
DATABASE_URL="file:./dev.db"

# Security & Tokens
PREVIEW_JWT_SECRET="generate-a-random-32-char-secret-string"
CRON_SECRET="generate-a-secure-cron-secret-key"

# AI & Blueprint Generation (Google Gemini)
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL_BLUEPRINT="gemini-flash-latest" # or gemini-3.8-flash / gemini-4-argon

# GitHub Integration (Optional: avoids anonymous rate limits)
GITHUB_TOKEN="your-github-pat"

# Cloud Deployment Mode
# "stub" = Instant local simulation (zero cloud accounts needed!)
# "live" = Real cloud deploys to Render & Vercel
DEPLOY_MODE="stub"

# Cloud Credentials (Only required if DEPLOY_MODE="live")
RENDER_API_KEY="rnd_..."
VERCEL_API_TOKEN="..."
```

### 3. Initialize Database
Initialize the SQLite database with Prisma migrations:
```bash
pnpm prisma migrate dev
```

### 4. Run Development Server
```bash
pnpm dev
```
Open **[http://localhost:3000](http://localhost:3000)** (or **http://localhost:3001** if port 3000 is occupied) in your browser.

---

## 🕹️ 6. How to Demo & Test

DeployPilot features two distinct deployment execution modes:

| Feature | `DEPLOY_MODE="stub"` (Default) | `DEPLOY_MODE="live"` |
| :--- | :--- | :--- |
| **Cloud Accounts Required** | **None** (100% self-contained) | Render & Vercel accounts |
| **Execution Speed** | **Fast (~10–15 seconds total)** | **Real-world (~3–5 minutes)** |
| **Health Polling** | Simulated HTTP 200 checks | Real HTTP GET probes to Render & Vercel |
| **Env Var Injection** | Simulated state machine | Real REST API calls (`POST /v10/projects/.../env`) |
| **Best For** | **Hackathons, Local Demos, CI/CD** | **Production Staging & Live Deployments** |

### Step-by-Step Demo Walkthrough

#### Step 1: Analyze Repository
1. Navigate to the home page (`/`).
2. Paste the official demo repository:
   ```text
   https://github.com/TusharSinghal2004/deploypilot-demo
   ```
3. Click **Analyze Repository**.
4. Observe the **Deterministic Facts Card**:
   - Detects `vite` frontend in `/frontend` (`npm run build`, output: `dist`).
   - Detects `express` backend in `/backend` (`node src/server.js`, port `5000`, `/health`).
   - Scans and extracts required environment variables: `PORT`, `FRONTEND_URL`, `VITE_API_URL`.
5. Observe the **Gemma AI Deployment Blueprint & Plan**:
   - Formulates the ordered, risk-assessed execution plan.

#### Step 2: Approve Plan
1. Review the generated plan steps.
2. Click **Approve Plan**.
3. DeployPilot creates idempotent, pending deployment rows in SQLite.

#### Step 3: Trigger Deployment
1. Go to the **Deployments** page (`/deployments`).
2. Click **Deploy Now** (or trigger via API).
3. The orchestrator takes over asynchronously.

#### Step 4: Watch the Live Action Timeline
1. Switch to **[http://localhost:3000/timeline](http://localhost:3000/timeline)**.
2. Watch the real-time Server-Sent Events stream:
   - `[AGENT] deploy_backend` → Starts Render service build.
   - `[AGENT] waiting_for_backend_health` → Polls backend `/health` every 5 seconds until HTTP 200.
   - `[AGENT] deploy_frontend` → Triggers Vercel project deployment.
   - `[AGENT] waiting_for_frontend_health` → Polls frontend URL every 5 seconds until ready.
   - `[AGENT] wire_frontend_api_url` → Injects `VITE_API_URL` to Vercel with 404 retries.
   - `[AGENT] wire_backend_cors_origin` → Injects `FRONTEND_URL` to Render.
   - `[AGENT] deployment_complete` → Both services marked `ready` and `isHealthy: true`.

*(Note: In `live` mode, cloud builds on Render and Vercel take ~3–5 minutes to complete, exactly mirroring production CI/CD delays).*

---

## 🏗️ 7. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Next.js App Router                       │
│   ├── /                  (Repo Analysis & AI Blueprint Review)   │
│   ├── /timeline          (Real-time SSE Action Timeline)         │
│   ├── /deployments       (Deployment State & Triggering)         │
│   └── /previews          (Ephemeral Access Control & Gating)     │
└────────────────┬────────────────────────────────┬────────────────┘
                 │                                │
                 ▼                                ▼
     ┌───────────────────────┐       ┌────────────────────────┐
     │  Deterministic Parser │       │   Gemma AI Engine      │
     │  - GitHub API / Trees │       │   - Google Gemini REST │
     │  - package.json AST   │       │   - Structured Outputs │
     │  - Env regex scanner  │       │   - JSON Schema Guard  │
     └───────────┬───────────┘       └───────────┬────────────┘
                 │                               │
                 └───────────────┬───────────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │     Prisma & SQLite   │
                     │  - Analysis           │
                     │  - Deployment         │
                     │  - ActionLog          │
                     │  - PreviewLink        │
                     └───────────┬───────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 ▼                               ▼
     ┌──────────────────────┐        ┌────────────────────────┐
     │ SSE ActionLog Stream │        │  Orchestration Engine  │
     │ /api/action-log/     │        │  - State Machine       │
     │ stream               │        │  - Health Polling Loop │
     └──────────────────────┘        │  - Env Wiring Logic    │
                                     └───────────┬────────────┘
                                                 │
                                 ┌───────────────┴────────────────┐
                                 │                                │
                       [DEPLOY_MODE="stub"]             [DEPLOY_MODE="live"]
                                 │                                │
                                 ▼                                ▼
                     ┌──────────────────────┐        ┌────────────────────────┐
                     │    Stub Deployers    │        │  Real Cloud Deployers  │
                     │  - Fast simulation   │        │  - Render REST API     │
                     │  - 2s mock health    │        │  - Vercel Deploy & Env │
                     └──────────────────────┘        └────────────────────────┘
```

### Core Components
- **`lib/analyze-repo.ts`**: Pure deterministic fact extractor. Clones tree metadata, reads package configurations, identifies root directories, detects frameworks, and extracts environment variable dependencies.
- **`lib/gemma/client.ts` & `blueprint.ts`**: Structured prompt pipeline invoking Google Gemini using strict schemas to synthesize an actionable blueprint.
- **`lib/orchestrator.ts`**: The deployment state machine that sequences cloud actions, dispatches logs, polls endpoints, and performs cross-service configuration.
- **`lib/deployers/`**: Provider abstractions implementing a common `Deployer` interface (`deploy`, `setEnvVar`, `checkHealth`, `waitForHealth`).
- **`app/api/action-log/stream/route.ts`**: High-efficiency Server-Sent Events (SSE) route streaming SQLite `ActionLog` entries as they are committed.

---

## 🔮 8. What's Next (Roadmap)

- [ ] **Automated Database Provisioning**:
  - Automatically detect PostgreSQL / MySQL requirements from Prisma or ORM manifests.
  - Dynamically provision databases on Neon, Supabase, or Render and inject `DATABASE_URL` directly into the backend deployment step.
- [ ] **AI-Powered Build Failure Diagnosis**:
  - When a build fails or a health probe times out, capture the runtime/build logs.
  - Feed the logs back into Gemma to diagnose syntax errors, missing dependencies, or port binding issues with suggested automated code patches.
- [ ] **One-Click Instant Rollbacks**:
  - Preserve historical deployment records and route traffic instantaneously to the previous healthy revision upon critical health streak failures.
- [ ] **GitHub PR Bot**:
  - A GitHub App integration that automatically comments ephemeral preview links directly on pull requests upon every push.
- [ ] **Multi-Region & Cloud Agnostic Drivers**:
  - Add native deployer drivers for AWS ECS, Fly.io, Railway, and Cloudflare Pages.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
