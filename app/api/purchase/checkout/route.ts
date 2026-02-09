// app/api/purchase/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { });
}

function firstEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function normalizePackId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase().replace(/-/g, "_");
}

function priceIdForPack(packId: string): string | undefined {
  switch (packId) {
    case "handful":
      return firstEnv(
        "STRIPE_PRICE_HANDFUL",
        "STRIPE_PRICE_ID_HANDFUL",
        "STRIPE_PRICE_ID_HAND_FUL"
      );
    case "small_pile":
      return firstEnv("STRIPE_PRICE_SMALL_PILE", "STRIPE_PRICE_ID_SMALL_PILE");
    case "pouch":
      return firstEnv("STRIPE_PRICE_POUCH", "STRIPE_PRICE_ID_POUCH");
    case "chest":
      return firstEnv("STRIPE_PRICE_CHEST", "STRIPE_PRICE_ID_CHEST");
    case "vault":
      return firstEnv("STRIPE_PRICE_VAULT", "STRIPE_PRICE_ID_VAULT");
    default:
      return undefined;
  }
}

function getBaseUrl() {
  // Prefer explicit site URL. Fallback to Vercel-provided URL.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe(); // ✅ lazy init prevents build-time crash
    const supabase = getSupabaseServer();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Please log in to continue" },
        { status: 401 }
      );
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { error: "Please log in to continue" },
        { status: 401 }
      );
    }

    const emailLower = userData.user.email?.toLowerCase().trim();
    if (!emailLower) {
      return NextResponse.json({ error: "Account email missing." }, { status: 401 });
    }

    const { data: allow } = await supabase
      .from("beta_allowlist")
      .select("email")
      .eq("email", emailLower)
      .maybeSingle();

    if (!allow) {
      return NextResponse.json(
        { error: "This is a closed beta. Please request an invite to continue." },
        { status: 403 }
      );
    }

    const user = userData.user;
    const userId = user.id;
    const email = user.email ?? undefined;

    const body = await req.json().catch(() => ({} as any));
    const packId = normalizePackId(body?.packId);

    if (!packId) {
      return NextResponse.json({ error: "Missing packId" }, { status: 400 });
    }

    const priceId = priceIdForPack(packId);
    if (!priceId) {
      return NextResponse.json(
        {
          error:
            `Missing Stripe price id for pack '${packId}'. ` +
            `Set the STRIPE_PRICE_ID_* env vars on Vercel.`,
          packId,
        },
        { status: 500 }
      );
    }

    let stripeCustomerId: string | null = null;

    const { data: existingCustomer } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingCustomer?.stripe_customer_id) {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId },
      });

      stripeCustomerId = customer.id;

      await supabase.from("stripe_customers").upsert({
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
      });
    }

    const baseUrl = getBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId ?? undefined,
      customer_email: stripeCustomerId ? undefined : email,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/store?success=1`,
      cancel_url: `${baseUrl}/store?canceled=1`,
      metadata: { userId, packId },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("checkout fatal:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
