import React from "react";
import Link from "next/link";
import { AnalyzeForm } from "@/components/analyze-form";

export const metadata = {
  title: "Analyze Repository — DeployPilot",
  description: "Repository analysis and Gemma deployment blueprinting",
};

export default function AnalyzePage() {
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
            DeployPilot • Layer 1
          </span>
          <h1 style={{ margin: 0, fontSize: "1.85rem", fontWeight: 700, color: "#f8fafc" }}>
            Repository Analysis & Gemma Blueprint
          </h1>
          <p style={{ margin: "0.4rem 0 0 0", color: "#94a3b8", fontSize: "0.95rem" }}>
            Extract deterministic facts from your repository, generate an AI blueprint, and approve the deployment plan.
          </p>
        </div>

        <nav style={{ display: "flex", gap: "0.75rem" }}>
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
          <Link
            href="/deployments"
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
            Deployments
          </Link>
        </nav>
      </header>

      <AnalyzeForm />
    </main>
  );
}
