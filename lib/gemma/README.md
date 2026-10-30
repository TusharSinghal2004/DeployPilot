# Gemma / Gemini Blueprint Engine

This subsystem generates structured deployment blueprints and execution plans from deterministic repository analysis facts.

---

## 1. Model IDs Used

- **Default Model**: `gemini-4-argon` (set via `GEMINI_MODEL_BLUEPRINT` environment variable).
- **Supported Alternatives**: `gemini-1.5-pro`, `gemini-1.5-flash`, or custom tuned/preview checkpoints supporting structured outputs via `responseMimeType: "application/json"`.

---

## 2. Why Direct REST over the SDK

DeployPilot interacts with Gemini exclusively via standard HTTP POST calls to:
```
https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

- **Zero SDK Lag**: The `@google/generative-ai` SDK frequently lags the rapid evolution of the REST API surface, preview parameters, and schema constraints.
- **Inlined OpenAPI Schemas**: The REST API natively accepts inlined OpenAPI 3.0-subset JSON Schemas in `generationConfig.responseSchema` without third-party wrapper quirks or dynamic dependency overhead.
- **Node 24 Native HTTP**: Utilizes native Node.js `fetch` without external HTTP client dependencies (`axios`, `node-fetch`).

---

## 3. How to Swap `GEMINI_MODEL_BLUEPRINT`

Set or override the environment variable in `.env`:

```env
GEMINI_MODEL_BLUEPRINT=gemini-4-argon
```

You can change this to any model identifier supported by the Gemini v1beta endpoint. The client dynamically incorporates this parameter into the endpoint URL.

---

## 4. The Retry Contract

The Gemini client and blueprint generator enforce a strict, bounded retry contract:

1. **Network & Rate-Limit Retries (429 & 5xx)**:
   - Handled with exponential backoff across 3 attempts (`500ms`, `1500ms`, `4000ms`).
   - If rate limits persist after the 3rd attempt, a typed `GeminiError` is raised.

2. **Schema Validation Retries (Zod SafeParse)**:
   - If the returned JSON fails Zod schema validation against `BlueprintSchema` or `PlanSchema`, the client re-prompts the model **exactly once**, appending the specific Zod validation errors to the prompt.
   - If validation fails on retry, the process fails loudly with an error; it **never coerces or silently drops** required schema fields.

---

## 5. The "Facts Are Authoritative" Rule

Repository facts extracted by `lib/analyze-repo.ts` are deterministic and grounded in code evidence:

- **Facts Trump AI Assumptions**: If Gemma's generated blueprint contradicts deterministic facts on any field that facts assert with evidence (such as `framework` or `root`), the deterministic fact is unconditionally retained.
- **Conflict Resolution Protocol**:
  - The deterministic fact overrides the model's value.
  - Overall plan confidence is capped at `"medium"` at best.
  - A note is appended: `Gemma disagreed with deterministic detection on <field>; kept fact.`.
  - An audit record is logged to the database: `ActionLog` row with `actor: "AGENT"`, `action: "blueprint_conflict_resolved"`, and `riskLevel: "low"`.
