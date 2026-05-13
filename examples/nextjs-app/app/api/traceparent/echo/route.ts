import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const header = req.headers.get("traceparent");
  return NextResponse.json({
    traceparent: header,
    traceId: header ? (header.split("-")[1] ?? null) : null,
  });
}
