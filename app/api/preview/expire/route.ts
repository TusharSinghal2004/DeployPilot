import { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http";
import { expireDueLinks } from "@/lib/preview-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || cronSecretHeader !== expectedSecret) {
    return jsonErr("unauthorized", "Invalid or missing cron secret header", 401);
  }

  const { count, rows } = await expireDueLinks();

  for (const row of rows) {
    // Structured event emission for expired links
    console.log(
      JSON.stringify({
        event: "preview.expired",
        linkId: row.id,
        frontendUrl: row.frontendUrl,
        backendUrl: row.backendUrl,
      })
    );

    // TODO: best-effort provider teardown goes here (Layer 2)
  }

  return jsonOk({
    expired: count,
  });
}
