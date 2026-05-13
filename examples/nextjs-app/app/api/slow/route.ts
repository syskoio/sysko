import { NextResponse } from "next/server";

export async function GET() {
  await new Promise<void>((r) => setTimeout(r, 250));
  return NextResponse.json({ ok: true });
}
