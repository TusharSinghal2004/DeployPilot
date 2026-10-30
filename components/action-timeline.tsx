"use client";

import React, { useEffect, useState, useRef } from "react";

export interface ActionLogRow {
  id: string;
  analysisId: string | null;
  deploymentId: string | null;
  timestamp: string;
  actor: string;
  action: string;
  target: string | null;
  status: string;
  riskLevel: string;
  approvalStatus: string;
  detailsJson: string | null;
}

export function ActionTimeline() {
  const [logs, setLogs] = useState<ActionLogRow[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;
      setConnectionStatus("connecting");
      es = new EventSource("/api/action-log/stream");

      es.onopen = () => {
        if (isMounted) {
          setConnectionStatus("live");
        }
      };

      es.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const row: ActionLogRow = JSON.parse(event.data);
          setLogs((prev) => {
            // Deduplicate by id
            if (prev.some((p) => p.id === row.id)) {
              return prev;
            }
            return [...prev, row];
          });
        } catch (err) {
          console.error("Failed to parse SSE ActionLog message:", err, event.data);
        }
      };

      es.onerror = () => {
        if (isMounted) {
          setConnectionStatus("reconnecting");
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (es) {
        es.close();
      }
    };
  }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getActorBadgeStyle = (actor: string) => {
    switch (actor.toUpperCase()) {
      case "USER":
        return {
          bg: "#1e3a8a30",
          color: "#60a5fa",
          border: "#3b82f660",
        };
      case "GEMMA":
        return {
          bg: "#581c8730",
          color: "#c084fc",
          border: "#a855f760",
        };
      case "AGENT":
        return {
          bg: "#064e3b30",
          color: "#34d399",
          border: "#10b98160",
        };
      case "GITHUB":
        return {
          bg: "#37415130",
          color: "#cbd5e1",
          border: "#6b728060",
        };
      default:
        return {
          bg: "#1f293730",
          color: "#9ca3af",
          border: "#4b556360",
        };
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "ok":
      case "approved":
        return { bg: "#065f4625", color: "#34d399", border: "#05966940" };
      case "error":
      case "declined":
        return { bg: "#991b1b25", color: "#f87171", border: "#dc262640" };
      default:
        return { bg: "#1e293b", color: "#94a3b8", border: "#334155" };
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {/* Top Header Card with Live Status & Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 1.25rem",
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Status Indicator Dot */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background:
                  connectionStatus === "live"
                    ? "#10b981"
                    : connectionStatus === "reconnecting"
                    ? "#ef4444"
                    : "#f59e0b",
                boxShadow:
                  connectionStatus === "live"
                    ? "0 0 10px #10b981"
                    : connectionStatus === "reconnecting"
                    ? "0 0 10px #ef4444"
                    : "0 0 10px #f59e0b",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color:
                  connectionStatus === "live"
                    ? "#34d399"
                    : connectionStatus === "reconnecting"
                    ? "#f87171"
                    : "#fbbf24",
              }}
            >
              {connectionStatus === "live"
                ? "Live Stream Connected"
                : connectionStatus === "reconnecting"
                ? "Reconnecting..."
                : "Connecting..."}
            </span>
          </div>

          <span style={{ color: "#475569", fontSize: "0.85rem" }}>•</span>

          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
            {logs.length} {logs.length === 1 ? "action recorded" : "actions recorded"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.82rem",
              color: "#cbd5e1",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              style={{ accentColor: "#2563eb", cursor: "pointer" }}
            />
            Auto-scroll
          </label>

          <button
            onClick={() => setLogs([])}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#94a3b8",
              fontSize: "0.78rem",
              padding: "0.3rem 0.65rem",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#334155")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#1e293b")}
          >
            Clear View
          </button>
        </div>
      </div>

      {/* Timeline Stream Container */}
      <div
        style={{
          background: "#090d16",
          border: "1px solid #1e293b",
          borderRadius: "12px",
          padding: "1.5rem",
          minHeight: "450px",
          maxHeight: "720px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {logs.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "4rem 1rem",
              color: "#64748b",
              textAlign: "center",
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ marginBottom: "1rem", opacity: 0.6 }}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 500 }}>
              Waiting for action events...
            </p>
            <p style={{ margin: "0.4rem 0 0 0", fontSize: "0.85rem", color: "#475569" }}>
              Analyze a repository or approve a deployment to see events stream live.
            </p>
          </div>
        ) : (
          <div style={{ position: "relative", paddingLeft: "1.75rem" }}>
            {/* Vertical timeline guide line */}
            <div
              style={{
                position: "absolute",
                top: "0.5rem",
                bottom: "0.5rem",
                left: "8px",
                width: "2px",
                background: "#1e293b",
              }}
            />

            {logs.map((log) => {
              const actorStyle = getActorBadgeStyle(log.actor);
              const statusStyle = getStatusBadgeStyle(log.status);
              const isExpanded = expandedIds.has(log.id);
              const formattedTime = new Date(log.timestamp).toLocaleTimeString([], {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              return (
                <div
                  key={log.id}
                  style={{
                    position: "relative",
                    marginBottom: "1.25rem",
                  }}
                >
                  {/* Timeline Node Dot */}
                  <div
                    style={{
                      position: "absolute",
                      left: "-1.75rem",
                      top: "0.35rem",
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: actorStyle.color,
                      border: "2px solid #090d16",
                      boxShadow: `0 0 8px ${actorStyle.color}60`,
                    }}
                  />

                  {/* Event Card */}
                  <div
                    style={{
                      background: "#111827",
                      border: "1px solid #1f2937",
                      borderRadius: "8px",
                      padding: "0.85rem 1.1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                      transition: "border-color 0.15s ease",
                    }}
                  >
                    {/* Header Row: [Timestamp] ACTOR: action (target/status) */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "0.6rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.6rem",
                          flexWrap: "wrap",
                        }}
                      >
                        {/* Timestamp */}
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.82rem",
                            color: "#94a3b8",
                            background: "#1e293b",
                            padding: "0.15rem 0.45rem",
                            borderRadius: "4px",
                          }}
                        >
                          [{formattedTime}]
                        </span>

                        {/* ACTOR badge (USER=blue, GEMMA=purple, AGENT=green) */}
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            padding: "0.15rem 0.55rem",
                            borderRadius: "4px",
                            background: actorStyle.bg,
                            color: actorStyle.color,
                            border: `1px solid ${actorStyle.border}`,
                          }}
                        >
                          {log.actor.toUpperCase()}
                        </span>

                        {/* Action text */}
                        <span
                          style={{
                            fontWeight: 600,
                            color: "#f8fafc",
                            fontSize: "0.92rem",
                          }}
                        >
                          {log.action}
                        </span>

                        {/* Target if present */}
                        {log.target && (
                          <span
                            style={{
                              fontSize: "0.85rem",
                              color: "#60a5fa",
                              maxWidth: "260px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={log.target}
                          >
                            ({log.target})
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {/* Status Badge */}
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "0.1rem 0.45rem",
                            borderRadius: "4px",
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            border: `1px solid ${statusStyle.border}`,
                            textTransform: "uppercase",
                          }}
                        >
                          {log.status}
                        </span>

                        {/* Expand Details button if detailsJson exists */}
                        {log.detailsJson && (
                          <button
                            onClick={() => toggleExpand(log.id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#94a3b8",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              textDecoration: "underline",
                              padding: "0.2rem 0.4rem",
                            }}
                          >
                            {isExpanded ? "Hide Details" : "View Details"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable detailsJson display */}
                    {isExpanded && log.detailsJson && (
                      <div
                        style={{
                          marginTop: "0.4rem",
                          background: "#030712",
                          border: "1px solid #1e293b",
                          borderRadius: "6px",
                          padding: "0.75rem",
                          overflowX: "auto",
                        }}
                      >
                        <pre
                          style={{
                            margin: 0,
                            fontSize: "0.78rem",
                            fontFamily: "monospace",
                            color: "#a5b4fc",
                            lineHeight: 1.45,
                          }}
                        >
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(log.detailsJson), null, 2);
                            } catch {
                              return log.detailsJson;
                            }
                          })()}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
