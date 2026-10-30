"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateTestPreviewButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: replace with real deployment URLs
      const res = await fetch("/api/preview/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frontendUrl: "https://example.com",
          backendUrl: "https://example.com",
          expiresInHours: 2,
          createdBy: "demo",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error?.message || "Failed to create preview");
      }

      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message || "Creation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleCreate}
        disabled={loading}
        style={{
          padding: "0.6rem 1.2rem",
          background: "#2563eb",
          color: "#ffffff",
          border: "none",
          borderRadius: "8px",
          fontWeight: 600,
          fontSize: "0.9rem",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          boxShadow: "0 2px 4px rgba(37, 99, 235, 0.3)",
        }}
      >
        {loading ? "Creating preview..." : "Create test preview"}
      </button>

      {error && (
        <span style={{ marginLeft: "1rem", color: "#f87171", fontSize: "0.85rem" }}>
          {error}
        </span>
      )}
    </div>
  );
}
