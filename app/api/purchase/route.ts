import { NextResponse } from "next/server";

export const runtime = "nodejs";

/*
 * Legacy beta purchase endpoint.
 *
 * This route previously credited Spirit Stones without receiving or
 * verifying a Stripe payment. It must remain unavailable. Paid purchases,
 * if reintroduced later, must use the Stripe Checkout route and the
 * signature-verified Stripe webhook.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Spirit Stone purchases are currently unavailable" },
    { status: 503 }
  );
}
