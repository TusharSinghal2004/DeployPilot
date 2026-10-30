"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface DeployNowButtonProps {
  analysisId: string;
}

export function DeployNowButton({ analysisId }: DeployNowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDeploy = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage("Triggering orchestration...");

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error?.message || "Failed to trigger deployment");
      }

      setStatusMessage("Deployment in progress...");

      // Periodically refresh page data to reflect status changes
      const interval = setInterval(() => {
        router.refresh();
      }, 1500);

      // Stop polling after 12s
      setTimeout(() => {
        clearInterval(interval);
        setLoading(false);
        setStatusMessage(null);
        router.refresh();
      }, 12000);
    } catch (err: any) {
      setError(err.message || "Deployment failed");
      setLoading(false);
      setStatusMessage(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          style={{
            display: "inline-block",
            width: "14px",
            height: "14px",
            border: "2px solid #3b82f6",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <span style={{ fontSize: "0.82rem", color: "#60a5fa", fontWeight: 500 }}>
          {statusMessage || "Deployment in progress..."}
        </span>
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
      <button
        onClick={handleDeploy}
        style={{
          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
          color: "#ffffff",
          border: "none",
          borderRadius: "6px",
          padding: "0.45rem 0.95rem",
          fontSize: "0.82rem",
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
          transition: "transform 0.1s ease, background 0.15s ease",
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = "#1d4ed8")}
        onMouseOut={(e) => (e.currentTarget.style.background = "linear-gradient(135deg, #2563eb, #1d4ed8)")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        Deploy Now
      </button>

      {error && (
        <span style={{ fontSize: "0.75rem", color: "#f87171" }}>
          {error}
        </span>
      )}
    </div>
  );
}
