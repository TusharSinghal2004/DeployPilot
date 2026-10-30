"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { RepoFacts } from "@/lib/analyze-repo";
import { Blueprint, DeploymentPlan } from "@/lib/gemma/schemas";
import { ConfidenceBadge } from "@/components/confidence-badge";

const STEP_LABELS: Record<string, string> = {
  deploy_backend: "Deploy backend to Render",
  wait_for_backend_health: "Wait for backend health check",
  set_frontend_api_url: "Set frontend API URL environment variable",
  set_backend_cors_origin: "Set backend CORS origin",
  deploy_frontend: "Deploy frontend to Vercel",
  verify_connectivity: "Verify end-to-end connectivity",
};

interface AnalysisResult {
  analysisId: string;
  facts: RepoFacts;
  blueprint: Blueprint;
  plan: DeploymentPlan;
  confidence: string;
}

export function AnalyzeForm() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [approving, setApproving] = useState(false);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || "Analysis failed");
      }

      setResult(data);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to analyze repository");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!result) return;
    setApproving(true);
    setError(null);

    try {
      const res = await fetch(`/api/blueprint/${encodeURIComponent(result.analysisId)}/approve`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || "Failed to approve deployment plan");
      }

      router.push("/deployments");
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to approve plan");
      setApproving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Input Form */}
      <form
        onSubmit={handleAnalyze}
        style={{
          background: "#111827",
          border: "1px solid #1f2937",
          borderRadius: "12px",
          padding: "1.75rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
        }}
      >
        <label
          htmlFor="repoUrlInput"
          style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, color: "#f8fafc", marginBottom: "0.75rem" }}
        >
          Paste a GitHub repo URL
        </label>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            id="repoUrlInput"
            type="url"
            required
            placeholder="https://github.com/owner/repository"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={loading}
            style={{
              flex: "1 1 300px",
              padding: "0.75rem 1rem",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#f8fafc",
              fontSize: "0.95rem",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={loading || !repoUrl.trim()}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Analyzing repo..." : "Analyze"}
          </button>
        </div>
      </form>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          style={{
            padding: "1rem 1.25rem",
            background: "#ef444415",
            border: "1px solid #ef444440",
            borderRadius: "10px",
            color: "#f87171",
            fontSize: "0.92rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Stacked Results Sections */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Section 1: What we found (RepoFacts) */}
          <section
            style={{
              background: "#161e2e",
              border: "1px solid #283548",
              borderRadius: "12px",
              padding: "1.75rem",
            }}
          >
            <h2 style={{ margin: "0 0 1.25rem 0", fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc" }}>
              1. What we found
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ fontSize: "0.92rem" }}>
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>Root: </span>
                <span style={{ color: "#f1f5f9" }}>{result.facts.root.path}</span>
                {" • "}
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>Package Manager: </span>
                <span style={{ color: "#60a5fa", fontWeight: 600 }}>{result.facts.root.packageManager}</span>
                {" • "}
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>Lockfile: </span>
                <span style={{ color: result.facts.root.hasLockfile ? "#34d399" : "#f87171" }}>
                  {result.facts.root.hasLockfile ? "Yes" : "No"}
                </span>
              </div>

              {/* Frontends */}
              {result.facts.frontends.length > 0 && (
                <div>
                  <h3 style={{ margin: "0.5rem 0 0.25rem 0", fontSize: "1rem", color: "#e2e8f0" }}>Frontends:</h3>
                  {result.facts.frontends.map((fe, idx) => (
                    <div key={idx} style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
                      <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.9rem", color: "#cbd5e1" }}>
                        <strong>Root:</strong> {fe.root} | <strong>Framework:</strong> {fe.framework} |{" "}
                        <strong>Build:</strong> {fe.buildCommand || "None"} | <strong>Output Dir:</strong>{" "}
                        {fe.outputDirectory || "Default"}
                      </p>
                      {fe.evidence.length > 0 && (
                        <ul style={{ margin: "0.25rem 0 0 0", paddingLeft: "1.25rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                          {fe.evidence.map((ev, i) => (
                            <li key={i}>{ev}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Backends */}
              {result.facts.backends.length > 0 && (
                <div>
                  <h3 style={{ margin: "0.5rem 0 0.25rem 0", fontSize: "1rem", color: "#e2e8f0" }}>Backends:</h3>
                  {result.facts.backends.map((be, idx) => (
                    <div key={idx} style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
                      <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.9rem", color: "#cbd5e1" }}>
                        <strong>Root:</strong> {be.root} | <strong>Framework:</strong> {be.framework} |{" "}
                        <strong>Start:</strong> {be.startCommand || "None"} | <strong>Health Path:</strong>{" "}
                        {be.healthCheckPath || "/"}
                      </p>
                      {be.evidence.length > 0 && (
                        <ul style={{ margin: "0.25rem 0 0 0", paddingLeft: "1.25rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                          {be.evidence.map((ev, i) => (
                            <li key={i}>{ev}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Databases */}
              {result.facts.databases.length > 0 && (
                <div>
                  <h3 style={{ margin: "0.5rem 0 0.25rem 0", fontSize: "1rem", color: "#e2e8f0" }}>Databases:</h3>
                  {result.facts.databases.map((db, idx) => (
                    <div key={idx} style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
                      <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.9rem", color: "#cbd5e1" }}>
                        <strong>Kind:</strong> {db.kind}
                      </p>
                      {db.evidence.length > 0 && (
                        <ul style={{ margin: "0.25rem 0 0 0", paddingLeft: "1.25rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                          {db.evidence.map((ev, i) => (
                            <li key={i}>{ev}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {result.facts.warnings.length > 0 && (
                <div style={{ marginTop: "0.5rem" }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#fbbf24" }}>Warnings: </span>
                  <span style={{ fontSize: "0.88rem", color: "#fcd34d" }}>
                    {result.facts.warnings.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Blueprint (Gemma) */}
          <section
            style={{
              background: "#161e2e",
              border: "1px solid #283548",
              borderRadius: "12px",
              padding: "1.75rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc" }}>
                2. Blueprint (Gemma)
              </h2>
              <ConfidenceBadge confidence={result.blueprint.confidence} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", fontSize: "0.92rem", marginBottom: "1.5rem" }}>
              {/* Frontend Card */}
              <div style={{ background: "#111827", padding: "1rem", borderRadius: "8px", border: "1px solid #1f2937" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#60a5fa" }}>Frontend Service</h4>
                <p style={{ margin: "0.25rem 0" }}><strong>Framework:</strong> {result.blueprint.frontend.framework}</p>
                <p style={{ margin: "0.25rem 0" }}><strong>Root:</strong> {result.blueprint.frontend.root}</p>
                <p style={{ margin: "0.25rem 0" }}><strong>Build Command:</strong> <code>{result.blueprint.frontend.buildCommand}</code></p>
                <p style={{ margin: "0.25rem 0" }}><strong>Output Directory:</strong> <code>{result.blueprint.frontend.outputDirectory}</code></p>
                <p style={{ margin: "0.25rem 0" }}><strong>Required Env:</strong> {result.blueprint.frontend.requiredEnv.join(", ") || "None"}</p>
              </div>

              {/* Backend Card */}
              <div style={{ background: "#111827", padding: "1rem", borderRadius: "8px", border: "1px solid #1f2937" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#a78bfa" }}>Backend Service</h4>
                {result.blueprint.backend ? (
                  <>
                    <p style={{ margin: "0.25rem 0" }}><strong>Framework:</strong> {result.blueprint.backend.framework}</p>
                    <p style={{ margin: "0.25rem 0" }}><strong>Root:</strong> {result.blueprint.backend.root}</p>
                    <p style={{ margin: "0.25rem 0" }}><strong>Start Command:</strong> <code>{result.blueprint.backend.startCommand}</code></p>
                    <p style={{ margin: "0.25rem 0" }}><strong>Health Check Path:</strong> <code>{result.blueprint.backend.healthCheckPath}</code></p>
                    <p style={{ margin: "0.25rem 0" }}><strong>Required Env:</strong> {result.blueprint.backend.requiredEnv.join(", ") || "None"}</p>
                  </>
                ) : (
                  <p style={{ margin: "0.25rem 0", color: "#9ca3af", fontStyle: "italic" }}>
                    No backend service detected. Supply backend settings manually if needed.
                  </p>
                )}
              </div>
            </div>

            {result.blueprint.database && (
              <div style={{ background: "#111827", padding: "1rem", borderRadius: "8px", border: "1px solid #1f2937", marginBottom: "1.25rem" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#34d399" }}>Database</h4>
                <p style={{ margin: "0.25rem 0" }}><strong>Kind:</strong> {result.blueprint.database.kind}</p>
                <p style={{ margin: "0.25rem 0" }}><strong>Required Env:</strong> {result.blueprint.database.requiredEnv.join(", ") || "None"}</p>
              </div>
            )}

            <div style={{ background: "#0f172a", padding: "0.9rem", borderRadius: "8px", border: "1px solid #1e293b" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
                Gemma Notes:
              </span>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#cbd5e1", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {result.blueprint.notes || "No additional notes."}
              </p>
            </div>
          </section>

          {/* Section 3: Plan */}
          <section
            style={{
              background: "#161e2e",
              border: "1px solid #283548",
              borderRadius: "12px",
              padding: "1.75rem",
            }}
          >
            <h2 style={{ margin: "0 0 1.25rem 0", fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc" }}>
              3. Plan
            </h2>

            <ol style={{ margin: "0 0 1.75rem 0", paddingLeft: "1.5rem", color: "#e2e8f0", fontSize: "0.95rem" }}>
              {result.plan.deploymentOrder.map((step, idx) => (
                <li key={idx} style={{ margin: "0.6rem 0", color: "#f1f5f9" }}>
                  <strong>{STEP_LABELS[step] || step}</strong>
                  <span style={{ marginLeft: "0.5rem", color: "#64748b", fontSize: "0.85rem" }}>({step})</span>
                </li>
              ))}
            </ol>

            <button
              onClick={handleApprove}
              disabled={approving}
              style={{
                padding: "0.8rem 1.75rem",
                background: "#10b981",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: approving ? "not-allowed" : "pointer",
                opacity: approving ? 0.7 : 1,
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.4)",
              }}
            >
              {approving ? "Approving plan..." : "Approve plan"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
