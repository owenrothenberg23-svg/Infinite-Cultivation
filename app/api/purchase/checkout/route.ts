import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

const PURCHASES_ENABLED = process.env.PURCHASES_ENABLED === "true";
const OWNER_EMAIL = (process.env.BETA_OWNER_EMAIL || "")
  .trim()
  .toLowerCase();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, {});
}

function firstEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) return value.trim();
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
        "STRIPE_PRICE_ID_HANDFUL",
        "STRIPE_PRICE_ID_HAND_FUL",
        "STRIPE_PRICE_HANDFUL"
      );
    case "small_pile":
      return firstEnv(
        "STRIPE_PRICE_ID_SMALL_PILE",
        "STRIPE_PRICE_SMALL_PILE"
      );
    case "pouch":
      return firstEnv("STRIPE_PRICE_ID_POUCH", "STRIPE_PRICE_POUCH");
    case "chest":
      return firstEnv("STRIPE_PRICE_ID_CHEST", "STRIPE_PRICE_CHEST");
    case "vault":
      return firstEnv("STRIPE_PRICE_ID_VAULT", "STRIPE_PRICE_VAULT");
    default:
      return undefined;
  }
}

function getBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    // Purchases default to disabled and no Stripe operation occurs unless
    // the feature is deliberately enabled in the server environment.
    if (!PURCHASES_ENABLED) {
      return NextResponse.json(
        { error: "Spirit Stone purchases are currently unavailable" },
        { status: 503 }
      );
    }

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

    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);

    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: "Please log in to continue" },
        { status: 401 }
      );
    }

    const user = userData.user;
    const emailLower = (user.email || "").trim().toLowerCase();

    if (!emailLower) {
      return NextResponse.json(
        { error: "Account email is unavailable" },
        { status: 403 }
      );
    }

    const isOwner = Boolean(OWNER_EMAIL && emailLower === OWNER_EMAIL);

    if (!isOwner) {
      const { data: allowlistRow, error: allowlistError } =
        await supabase
          .from("beta_allowlist")
          .select("email")
          .eq("email", emailLower)
          .maybeSingle();

      if (allowlistError) {
        console.error(
          "checkout: allowlist lookup failed",
          allowlistError
        );

        return NextResponse.json(
          { error: "Could not verify beta access" },
          { status: 503 }
        );
      }

      if (!allowlistRow?.email) {
        return NextResponse.json(
          { error: "Beta access required" },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => null);
    const packId = normalizePackId(body?.packId);

    if (!packId) {
      return NextResponse.json(
        { error: "Missing packId" },
        { status: 400 }
      );
    }

    const priceId = priceIdForPack(packId);

    if (!priceId) {
      console.error("checkout: missing price configuration", packId);

      return NextResponse.json(
        { error: "This purchase option is unavailable" },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    const userId = user.id;
    const email = user.email ?? undefined;

    // Find or create the Stripe customer associated with this user.
    let stripeCustomerId: string | null = null;

    const { data: existingCustomer, error: customerLookupError } =
      await supabase
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .maybeSingle();

    if (customerLookupError) {
      console.error(
        "checkout: customer lookup failed",
        customerLookupError
      );

      return NextResponse.json(
        { error: "Could not initialize checkout" },
        { status: 500 }
      );
    }

    if (existingCustomer?.stripe_customer_id) {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId },
      });

      stripeCustomerId = customer.id;

      const { error: customerSaveError } = await supabase
        .from("stripe_customers")
        .upsert({
          user_id: userId,
          stripe_customer_id: stripeCustomerId,
        });

      if (customerSaveError) {
        console.error(
          "checkout: customer save failed",
          customerSaveError
        );

        return NextResponse.json(
          { error: "Could not initialize checkout" },
          { status: 500 }
        );
      }
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
  } catch (error) {
    console.error("checkout fatal:", error);

    return NextResponse.json(
      { error: "Could not initialize checkout" },
      { status: 500 }
    );
  }
}
