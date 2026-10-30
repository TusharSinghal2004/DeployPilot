import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DeployNowButton } from "@/components/deploy-now-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Deployments — DeployPilot",
  description: "Deployments orchestrated by DeployPilot",
};

export default async function DeploymentsPage() {
  const allDeployments = await prisma.deployment.findMany({
    orderBy: { startedAt: "desc" },
  });

  const pendingDeployments = allDeployments.filter((d) => d.status === "pending");
  const activeDeployments = allDeployments.filter((d) => d.status !== "pending");

  // Group pending by analysisId so we can offer one Deploy button per plan or per item
  const pendingByAnalysis = pendingDeployments.reduce<Record<string, typeof pendingDeployments>>(
    (acc, dep) => {
      acc[dep.analysisId] = acc[dep.analysisId] || [];
      acc[dep.analysisId].push(dep);
      return acc;
    },
    {}
  );

  return (
    <main
      style={{
        maxWidth: "880px",
        margin: "0 auto",
        padding: "3rem 1.5rem",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          marginBottom: "2rem",
          paddingBottom: "1.25rem",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#60a5fa",
              display: "block",
              marginBottom: "0.4rem",
            }}
          >
            DeployPilot • Layer 2a
          </span>
          <h1 style={{ margin: 0, fontSize: "1.85rem", fontWeight: 700, color: "#f8fafc" }}>
            Deployments & Orchestration
          </h1>
          <p style={{ margin: "0.4rem 0 0 0", color: "#94a3b8", fontSize: "0.95rem" }}>
            Pending and active deployments managed by DeployPilot state machine.
          </p>
        </div>

        <nav style={{ display: "flex", gap: "0.75rem" }}>
          <Link
            href="/analyze"
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#94a3b8",
              textDecoration: "none",
              padding: "0.45rem 0.85rem",
              borderRadius: "6px",
              background: "#1e293b",
              border: "1px solid #334155",
            }}
          >
            ← Analyze
          </Link>
          <Link
            href="/timeline"
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#34d399",
              textDecoration: "none",
              padding: "0.45rem 0.85rem",
              borderRadius: "6px",
              background: "#064e3b25",
              border: "1px solid #05966950",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#10b981",
                display: "inline-block",
              }}
            />
            Live Timeline
          </Link>
        </nav>
      </header>

      {/* Pending Deployments Section */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#f8fafc", marginBottom: "1rem" }}>
          Pending Deployments ({pendingDeployments.length})
        </h2>

        {Object.keys(pendingByAnalysis).length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "2.5rem 2rem",
              background: "#111827",
              border: "1px dashed #374151",
              borderRadius: "12px",
              color: "#94a3b8",
            }}
          >
            <p style={{ margin: "0 0 0.75rem 0" }}>No pending deployments queued.</p>
            <Link
              href="/analyze"
              style={{
                color: "#60a5fa",
                textDecoration: "underline",
                fontSize: "0.92rem",
              }}
            >
              Analyze a repository and approve a plan →
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {Object.entries(pendingByAnalysis).map(([analysisId, deps]) => (
              <div
                key={analysisId}
                style={{
                  background: "#161e2e",
                  border: "1px solid #283548",
                  borderRadius: "12px",
                  padding: "1.25rem 1.5rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                    paddingBottom: "0.75rem",
                    borderBottom: "1px solid #1f2937",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.78rem", color: "#64748b", fontFamily: "monospace" }}>
                      Plan: {analysisId}
                    </span>
                    <h3 style={{ margin: "0.2rem 0 0 0", fontSize: "0.98rem", color: "#e2e8f0" }}>
                      {deps[0]?.repoUrl}
                    </h3>
                  </div>

                  {/* Deploy Now Button */}
                  <DeployNowButton analysisId={analysisId} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  {deps.map((dep) => (
                    <div
                      key={dep.id}
                      style={{
                        background: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: "8px",
                        padding: "0.85rem 1rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "0.15rem 0.45rem",
                            borderRadius: "4px",
                            background: dep.serviceType === "frontend" ? "#3b82f620" : "#8b5cf620",
                            color: dep.serviceType === "frontend" ? "#60a5fa" : "#c4b5fd",
                            border: `1px solid ${dep.serviceType === "frontend" ? "#3b82f640" : "#8b5cf640"}`,
                          }}
                        >
                          {dep.serviceType}
                        </span>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "9999px",
                            background: "#f59e0b20",
                            color: "#fbbf24",
                            border: "1px solid #f59e0b40",
                          }}
                        >
                          {dep.status}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
                        Provider: <strong>{dep.provider}</strong>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                        ID: {dep.id}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active & Completed Deployments Section */}
      {activeDeployments.length > 0 && (
        <section>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#f8fafc", marginBottom: "1rem" }}>
            Active & Ready Deployments ({activeDeployments.length})
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {activeDeployments.map((dep) => (
              <div
                key={dep.id}
                style={{
                  background: "#161e2e",
                  border: "1px solid #283548",
                  borderRadius: "10px",
                  padding: "1rem 1.25rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "4px",
                        background: dep.serviceType === "frontend" ? "#3b82f620" : "#8b5cf620",
                        color: dep.serviceType === "frontend" ? "#60a5fa" : "#c4b5fd",
                        border: `1px solid ${dep.serviceType === "frontend" ? "#3b82f640" : "#8b5cf640"}`,
                      }}
                    >
                      {dep.serviceType}
                    </span>
                    <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "#f8fafc" }}>
                      Provider: {dep.provider}
                    </span>
                    {dep.url && (
                      <a
                        href={dep.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: "0.85rem",
                          color: "#38bdf8",
                          textDecoration: "underline",
                        }}
                      >
                        {dep.url} ↗
                      </a>
                    )}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                    Repo: {dep.repoUrl}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "9999px",
                      background:
                        dep.status === "ready"
                          ? "#10b98120"
                          : dep.status === "failed"
                          ? "#ef444420"
                          : "#3b82f620",
                      color:
                        dep.status === "ready"
                          ? "#34d399"
                          : dep.status === "failed"
                          ? "#f87171"
                          : "#60a5fa",
                      border: `1px solid ${
                        dep.status === "ready"
                          ? "#10b98140"
                          : dep.status === "failed"
                          ? "#ef444440"
                          : "#3b82f640"
                      }`,
                    }}
                  >
                    {dep.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
