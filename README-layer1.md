# DeployPilot — Layer 1: Repo Analysis + Gemma Blueprint

Layer 1 makes no Vercel, Render, or health-check calls. Approve persists pending Deployments; Layer 2 executes them.

Layer 1 is the intelligence and planning layer of DeployPilot. It analyzes a GitHub repository, extracts deterministic codebase facts, invokes Gemma via Gemini's structured output REST API to generate an authoritative deployment blueprint and plan, obtains user approval, and persists the approved plan as pending deployments.

---

## 1. Environment Variables

Configure these variables in `.env` (see `.env.example`):

```bash
# Layer 0 Variables
DATABASE_URL="file:./dev.db"
PREVIEW_JWT_SECRET=change-me
CRON_SECRET=change-me

# Layer 1 Variables
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL_BLUEPRINT=gemini-3.8-flash # override to gemini-4-argon if your key has access
GITHUB_TOKEN=optional-personal-access-token
```

- `GEMINI_API_KEY`: API key for Google Gemini REST generateContent calls.
- `GEMINI_MODEL_BLUEPRINT`: Model identifier (defaults to `gemini-3.8-flash`; override to `gemini-4-argon` if your key has access).
- `GITHUB_TOKEN`: Optional GitHub personal access token to avoid public IP rate limits on `api.github.com`.

> [!NOTE]
> A 403 Forbidden or 404 Not Found error from Gemini indicates that your API key does not have access to the configured `GEMINI_MODEL_BLUEPRINT`, rather than an application code error.

---

## 2. Database Migrations

Run Prisma migrations to initialize the Layer 1 tables (`Deployment`, `Analysis`, and `ActionLog`):

```bash
pnpm prisma migrate dev --name add-deployments-and-action-log
```

---

## 3. Smoke Test Procedure

### a. Start development server
```bash
pnpm dev
# Server ready on http://localhost:3000
```

### b. Analyze a public repository
```bash
curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/tastejs/todomvc"}'
```

Expected response shape:
```json
{
  "analysisId": "cmvul...",
  "facts": {
    "root": { "path": ".", "packageManager": "npm", "hasLockfile": true },
    "frontends": [...],
    "backends": [...],
    "databases": [...],
    "warnings": []
  },
  "blueprint": {
    "frontend": {
      "framework": "vite",
      "root": ".",
      "buildCommand": "npm run build",
      "outputDirectory": "dist",
      "requiredEnv": []
    },
    "backend": {
      "framework": "express",
      "root": ".",
      "startCommand": "node src/server.js",
      "healthCheckPath": "/health",
      "requiredEnv": []
    },
    "database": null,
    "confidence": "high",
    "notes": "..."
  },
  "plan": {
    "deploymentOrder": [
      "deploy_backend",
      "wait_for_backend_health",
      "set_frontend_api_url",
      "set_backend_cors_origin",
      "deploy_frontend",
      "verify_connectivity"
    ]
  },
  "confidence": "high"
}
```

*Reading Confidence and Notes*:
- `confidence`: `"high"` | `"medium"` | `"low"` indicates certainty in automated build and start commands.
- `notes`: Verbatim feedback from the planner explaining assumptions or conflict resolutions.

### c. Approve the plan
```bash
curl -s -X POST http://localhost:3000/api/blueprint/$ANALYSIS_ID/approve
```

Expected response:
```json
{
  "deploymentIds": ["cuid-backend-id", "cuid-frontend-id"],
  "status": "pending"
}
```

### d. Verify ActionLog audit rows
Inspect SQLite database rows:
```bash
sqlite3 prisma/dev.db "SELECT actor, action, status, approvalStatus FROM ActionLog ORDER BY timestamp DESC LIMIT 5;"
```

Expected output includes:
- `USER | analyze_repo | ok | n/a`
- `GEMMA | generate_blueprint | ok | n/a`
- `USER | approve_plan | ok | approved`

### e. Verify idempotency
Re-run the approve request:
```bash
curl -s -X POST http://localhost:3000/api/blueprint/$ANALYSIS_ID/approve
```
Returns HTTP 200 with the exact same `deploymentIds` without creating duplicate deployment records.
