import React from "react";
import { listActiveLinks } from "@/lib/preview-store";
import { signPreviewToken } from "@/lib/preview-token";
import { PreviewCard, PreviewCardItem } from "@/components/preview-card";
import { CreateTestPreviewButton } from "@/components/create-test-preview-button";

export const dynamic = "force-dynamic";

export default async function PreviewsPage() {
  // TODO: replace with session user
  // Fetch active links for user "demo" (stub)
  const links = await listActiveLinks("demo");

  // Sign preview token for each active link to render gate URLs
  const items: PreviewCardItem[] = await Promise.all(
    links.map(async (link) => {
      const token = await signPreviewToken({
        linkId: link.id,
        expiresAt: link.expiresAt,
      });

      return {
        id: link.id,
        token,
        frontendUrl: link.frontendUrl,
        backendUrl: link.backendUrl,
        expiresAt: link.expiresAt.toISOString(),
        passwordProtected: Boolean(link.passwordHash),
      };
    })
  );

  return (
    <main
      style={{
        maxWidth: "760px",
        margin: "0 auto",
        padding: "3rem 1.5rem",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2.5rem",
          paddingBottom: "1.5rem",
          borderBottom: "1px solid #1e293b",
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
            DeployPilot • Layer 0
          </span>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, color: "#f8fafc" }}>
            Ephemeral Preview Gateways
          </h1>
          <p style={{ margin: "0.35rem 0 0 0", color: "#94a3b8", fontSize: "0.95rem" }}>
            Active gated deployments for user &quot;demo&quot;
          </p>
        </div>

        {/* Single test preview button per spec */}
        <CreateTestPreviewButton />
      </header>

      <section>
        {items.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 2rem",
              background: "#111827",
              border: "1px dashed #374151",
              borderRadius: "12px",
              color: "#94a3b8",
            }}
          >
            <p style={{ margin: "0 0 1rem 0", fontSize: "1.05rem" }}>
              No active ephemeral preview links found.
            </p>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
              Click &quot;Create test preview&quot; above to initialize a gated deployment link.
            </p>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <PreviewCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
