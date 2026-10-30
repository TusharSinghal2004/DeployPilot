"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PreviewCountdown } from "@/components/preview-countdown";

export interface PreviewCardItem {
  id: string;
  token: string;
  frontendUrl: string;
  backendUrl: string;
  expiresAt: string;
  passwordProtected: boolean;
}

export function PreviewCard({ item }: { item: PreviewCardItem }) {
  const router = useRouter();
  const [isExpired, setIsExpired] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const gateUrlPath = `/api/preview/${encodeURIComponent(item.token)}`;

  const handleOpenDemo = () => {
    window.open(gateUrlPath, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    try {
      const fullUrl = `${window.location.origin}${gateUrlPath}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError("Failed to copy link to clipboard");
    }
  };

  const handleExtend = async () => {
    setActionError(null);
    setLoadingAction("extend");
    try {
      const res = await fetch(`${gateUrlPath}/admin/extend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dashboard-user": "demo", // TODO: replace with session
        },
        credentials: "include",
        body: JSON.stringify({ extraHours: 1 }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error?.message || "Failed to extend link");
      }

      router.refresh();
    } catch (err: unknown) {
      setActionError((err as Error).message || "Extension failed");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDestroy = async () => {
    if (!window.confirm("Are you sure you want to destroy this preview link now?")) {
      return;
    }

    setActionError(null);
    setLoadingAction("destroy");
    try {
      const res = await fetch(`${gateUrlPath}/admin/destroy`, {
        method: "POST",
        headers: {
          "x-dashboard-user": "demo", // TODO: replace with session
        },
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error?.message || "Failed to destroy link");
      }

      router.refresh();
    } catch (err: unknown) {
      setActionError((err as Error).message || "Destroy action failed");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      style={{
        background: "#161e2e",
        border: "1px solid #283548",
        borderRadius: "12px",
        padding: "1.5rem",
        marginBottom: "1.25rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc" }}>
          Temporary demo created
        </h3>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            padding: "0.2rem 0.6rem",
            borderRadius: "9999px",
            background: isExpired ? "#ef444420" : "#10b98120",
            color: isExpired ? "#f87171" : "#34d399",
            border: `1px solid ${isExpired ? "#ef444440" : "#10b98140"}`,
          }}
        >
          {isExpired ? "EXPIRED" : "ACTIVE"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", rowGap: "0.5rem", fontSize: "0.92rem", marginBottom: "1.25rem" }}>
        <span style={{ color: "#94a3b8", fontWeight: 500 }}>Frontend:</span>
        <span style={{ color: "#e2e8f0", wordBreak: "break-all" }}>{item.frontendUrl}</span>

        <span style={{ color: "#94a3b8", fontWeight: 500 }}>Backend:</span>
        <span style={{ color: "#e2e8f0", wordBreak: "break-all" }}>{item.backendUrl}</span>

        <span style={{ color: "#94a3b8", fontWeight: 500 }}>Expires:</span>
        <div>
          <PreviewCountdown
            expiresAt={item.expiresAt}
            onExpire={() => setIsExpired(true)}
          />
        </div>

        <span style={{ color: "#94a3b8", fontWeight: 500 }}>Access:</span>
        <span style={{ color: item.passwordProtected ? "#fbbf24" : "#60a5fa", fontWeight: 500 }}>
          {item.passwordProtected ? "Password protected" : "Open"}
        </span>
      </div>

      {actionError && (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            background: "#ef444415",
            border: "1px solid #ef444435",
            borderRadius: "6px",
            color: "#f87171",
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          {actionError}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={handleOpenDemo}
          disabled={isExpired}
          style={{
            padding: "0.5rem 0.9rem",
            background: isExpired ? "#334155" : "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: isExpired ? "not-allowed" : "pointer",
            opacity: isExpired ? 0.6 : 1,
          }}
        >
          Open demo
        </button>

        <button
          onClick={handleExtend}
          disabled={isExpired || loadingAction === "extend"}
          style={{
            padding: "0.5rem 0.9rem",
            background: "#1e293b",
            color: "#e2e8f0",
            border: "1px solid #334155",
            borderRadius: "6px",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: isExpired || loadingAction === "extend" ? "not-allowed" : "pointer",
            opacity: isExpired ? 0.6 : 1,
          }}
        >
          {loadingAction === "extend" ? "Extending..." : "Extend 1 hour"}
        </button>

        <button
          onClick={handleDestroy}
          disabled={isExpired || loadingAction === "destroy"}
          style={{
            padding: "0.5rem 0.9rem",
            background: "#ef444415",
            color: "#f87171",
            border: "1px solid #ef444435",
            borderRadius: "6px",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: isExpired || loadingAction === "destroy" ? "not-allowed" : "pointer",
            opacity: isExpired ? 0.6 : 1,
          }}
        >
          {loadingAction === "destroy" ? "Destroying..." : "Destroy now"}
        </button>

        <button
          onClick={handleCopyLink}
          style={{
            padding: "0.5rem 0.9rem",
            background: "#1e293b",
            color: "#94a3b8",
            border: "1px solid #334155",
            borderRadius: "6px",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
