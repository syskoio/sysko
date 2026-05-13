import { NextResponse } from "next/server";
import { withSpan } from "@syskoio/core";

export async function GET() {
  console.log("request received");
  console.info("fetching user from db");

  const user = await withSpan({ kind: "db.query", name: "users.findOne" }, async () => {
    await new Promise<void>((r) => setTimeout(r, 30));
    console.log("query executed, 1 row returned");
    return { id: 1, name: "alice", role: "admin" };
  });

  if (user.role === "admin") {
    console.warn("admin access detected");
  }

  console.error("simulated error mid-request (non-fatal)");
  return NextResponse.json(user);
}
