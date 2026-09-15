import { NextResponse } from "next/server";

export const runtime = "nodejs";

/*
 * Spirit Stone gifting is not part of the current beta product.
 * Keep this legacy endpoint unavailable until the economy is deliberately
 * reintroduced with one atomic, server-authorized transfer transaction.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Spirit Stone gifting is currently unavailable" },
    { status: 503 }
  );
}
