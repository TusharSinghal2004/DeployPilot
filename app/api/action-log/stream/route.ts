import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let intervalId: NodeJS.Timeout | null = null;
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        try {
          controller.close();
        } catch {
          // Ignore if already closed
        }
      };

      req.signal.addEventListener("abort", cleanup);

      try {
        // 1. Send all existing logs immediately on connect
        const initialLogs = await prisma.actionLog.findMany({
          orderBy: { timestamp: "asc" },
        });

        let lastTimestamp: Date | null = null;
        const sentIds = new Set<string>();

        for (const log of initialLogs) {
          sendEvent(log);
          sentIds.add(log.id);
          lastTimestamp = log.timestamp;
        }

        // 2. Poll every 1 second for new ActionLog rows
        intervalId = setInterval(async () => {
          if (isClosed) {
            cleanup();
            return;
          }

          try {
            const queryWhere = lastTimestamp
              ? {
                  timestamp: {
                    gte: lastTimestamp,
                  },
                }
              : {};

            const newLogs = await prisma.actionLog.findMany({
              where: queryWhere,
              orderBy: { timestamp: "asc" },
            });

            for (const log of newLogs) {
              if (!sentIds.has(log.id)) {
                sendEvent(log);
                sentIds.add(log.id);
                lastTimestamp = log.timestamp;
              }
            }
          } catch (pollErr: unknown) {
            console.error("[SSE ActionLog] Poll error:", pollErr);
          }
        }, 1000);
      } catch (err: unknown) {
        console.error("[SSE ActionLog] Initial query error:", err);
        cleanup();
      }
    },
    cancel() {
      isClosed = true;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Encoding": "none",
    },
  });
}
