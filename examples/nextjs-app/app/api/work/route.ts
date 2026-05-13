import { NextResponse } from "next/server";
import { withSpan } from "@syskoio/core";

export async function GET() {
  const result = await withSpan(
    { kind: "internal", name: "expensive computation" },
    async () => {
      await new Promise<void>((r) => setTimeout(r, 80));
      return 42;
    },
  );
  return NextResponse.json({ result });
}
