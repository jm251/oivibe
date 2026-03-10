import { getSearchParam } from "@/lib/http";
import { resolveExpiries, sanitizeSymbol } from "@/lib/market/service";
import { streamHub } from "@/lib/stream/hub";

export const runtime = "nodejs";

function writeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: Request) {
  const symbol = sanitizeSymbol(getSearchParam(req, "symbol"));
  const expiryParam = getSearchParam(req, "expiry");

  const expiryResult = await resolveExpiries(symbol);
  const expiry = expiryParam ?? expiryResult.expiries[0];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const unsubscribe = streamHub.subscribe(symbol, expiry, (event) => {
        controller.enqueue(encoder.encode(writeSse(event.event, event.data)));
      });

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // no-op
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}