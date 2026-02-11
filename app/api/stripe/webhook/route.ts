import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const PACK_STONES: Record<string, number> = {
  handful: 10,
  small_pile: 20,
  pouch: 50,
  chest: 110,
  vault: 300,
};

function isDuplicateKey(err: any) {
  const msg = String(err?.message || "");
  return msg.includes("23505") || msg.toLowerCase().includes("duplicate key");
}

export async function POST(req: Request) {
  try {
    const headerList = await headers();
    const sig = headerList.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return NextResponse.json(
        { error: "Missing webhook secret or signature" },
        { status: 400 }
      );
    }

    const body = await req.text();

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
      console.error("⚠️ Webhook signature verification failed:", err?.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const isCheckoutSuccess =
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded";

    if (!isCheckoutSuccess) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const session = event.data.object as any;

    const paymentStatus = session.payment_status;
    if (paymentStatus !== "paid") {
      console.log("webhook: not paid, skipping", {
        eventId: event.id,
        sessionId: session?.id,
        payment_status: paymentStatus,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Identify userId + packId
    let userId: string | undefined =
      session?.metadata?.userId || session?.client_reference_id || undefined;
    let packId: string | undefined = session?.metadata?.packId || undefined;

    const paymentIntentId: string | undefined =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if ((!userId || !packId) && paymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        userId = userId || (pi.metadata?.userId as string | undefined);
        packId = packId || (pi.metadata?.packId as string | undefined);
      } catch (e) {
        console.warn("webhook: could not retrieve payment_intent", e);
      }
    }

    if (!userId || !packId) {
      console.warn("webhook: missing userId/packId", {
        eventId: event.id,
        sessionId: session?.id,
        metadata: session?.metadata,
        client_reference_id: session?.client_reference_id,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const stones = PACK_STONES[packId] ?? 0;
    if (!stones) {
      console.warn("webhook: unknown packId", packId);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const supabase = getSupabaseAdmin();

    // ✅ 1) Idempotency: record event first
    const { error: evErr } = await supabase.from("stripe_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      stripe_session_id: session?.id ?? null,
      stripe_payment_intent_id: paymentIntentId ?? null,
      user_id: userId,
      pack_id: packId,
    });

    if (evErr) {
      if (isDuplicateKey(evErr)) {
        console.log("webhook: duplicate event, already processed", {
          eventId: event.id,
          sessionId: session?.id,
        });
        return NextResponse.json({ received: true }, { status: 200 });
      }
      console.error("webhook: failed to insert stripe_events row", evErr);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // ✅ 2) Credit stones ATOMICALLY (no select + overwrite)
    const { error: incErr } = await supabase.rpc("increment_spirit_stones", {
      p_user_id: userId,
      p_amount: stones,
    });

    if (incErr) {
      console.error("webhook: increment_spirit_stones error", incErr);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    console.log("webhook: credited stones", {
      userId,
      packId,
      stones,
      eventId: event.id,
    });

    // ✅ 3) Log purchase (unchanged) — only after successful credit
    try {
      const { error: purchaseErr } = await supabase.from("purchases").insert({
        user_id: userId,
        pack_id: packId,
        stones,
        amount_total: session?.amount_total ?? null,
        currency: session?.currency ?? null,
        stripe_session_id: session?.id ?? null,
        stripe_payment_intent_id: paymentIntentId ?? null,
        stripe_event_id: event.id,
      });

      if (purchaseErr) {
        if (isDuplicateKey(purchaseErr)) {
          console.log("webhook: purchase already logged", {
            eventId: event.id,
            sessionId: session?.id,
          });
        } else {
          console.warn("webhook: purchase insert error (non-fatal)", purchaseErr);
        }
      }
    } catch (e) {
      console.warn("webhook: purchase insert threw (non-fatal)", e);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("webhook fatal:", err);
    return NextResponse.json(
      { error: err?.message || "Webhook error" },
      { status: 500 }
    );
  }
}
