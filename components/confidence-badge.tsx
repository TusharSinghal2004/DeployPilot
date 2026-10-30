"use client";

import React from "react";

export interface ConfidenceBadgeProps {
  confidence: "high" | "medium" | "low" | string;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const norm = confidence.toLowerCase();

  let bg = "#10b98120";
  let color = "#34d399";
  let border = "#10b98140";
  let label = "HIGH CONFIDENCE";

  if (norm === "medium") {
    bg = "#f59e0b20";
    color = "#fbbf24";
    border = "#f59e0b40";
    label = "MEDIUM CONFIDENCE";
  } else if (norm === "low") {
    bg = "#ef444420";
    color = "#f87171";
    border = "#ef444440";
    label = "LOW CONFIDENCE";
  }

  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "0.06em",
        padding: "0.25rem 0.65rem",
        borderRadius: "9999px",
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}
