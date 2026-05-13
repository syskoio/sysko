import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Derive the base URL from the incoming request so the port is always correct.
  const base = new URL(req.url).origin;
  const r = await fetch(`${base}/api/traceparent/echo`);
  const data = await r.json() as { traceparent: string | null; traceId: string | null };
  return NextResponse.json({
    propagated: data.traceparent !== null,
    receivedTraceparent: data.traceparent,
    sharedTraceId: data.traceId,
  });
}
