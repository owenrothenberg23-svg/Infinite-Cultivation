import { NextResponse } from "next/server";

export const runtime = "nodejs";

/*
 * Legacy view endpoint. No current application surface uses this route.
 * View tracking will be reintroduced through one validated server endpoint.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Story view tracking is currently unavailable" },
    { status: 503 }
  );
}