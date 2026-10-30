import React from "react";
import Link from "next/link";
import { ActionTimeline } from "@/components/action-timeline";

export const metadata = {
  title: "Live Action Timeline — DeployPilot",
  description: "Real-time action audit stream for DeployPilot operations",
};

export default function TimelinePage() {
  return (
    <main
      style={{
        maxWidth: "960px",
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
            DeployPilot • Layer 1.5
          </span>
          <h1 style={{ margin: 0, fontSize: "1.85rem", fontWeight: 700, color: "#f8fafc" }}>
            Live Action Timeline
          </h1>
          <p style={{ margin: "0.4rem 0 0 0", color: "#94a3b8", fontSize: "0.95rem" }}>
            Real-time server-sent events stream monitoring user, agent, and Gemma interactions.
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
            ← Back to Analyze
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

      <ActionTimeline />
    </main>
  );
}
