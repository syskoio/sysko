import { NextResponse } from "next/server";

export async function GET() {
  const r = await fetch("https://api.github.com/zen");
  const text = await r.text();
  return NextResponse.json({ zen: text });
}
