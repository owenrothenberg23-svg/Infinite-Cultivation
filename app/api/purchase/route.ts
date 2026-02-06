// app/api/purchase/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

// Keep a server-side copy of pack definitions so the client
// cannot lie about stone counts or prices.
const PACKS = [
  {
    id: "handful",
    stones: 10,
    bonus: 0,
    price_cents: 299,
    label: "Handful of Spirit Stones",
  },
  {
    id: "small_pile",
    stones: 20,
    bonus: 0,
    price_cents: 499,
    label: "Small Pile of Spirit Stones",
  },
  {
    id: "pouch",
    stones: 50,
    bonus: 0,
    price_cents: 999,
    label: "Pouch of Spirit Stones",
  },
  {
    id: "chest",
    stones: 110,
    bonus: 0,
    price_cents: 1999,
    label: "Treasure Chest of Spirit Stones",
  },
  {
    id: "vault",
    stones: 300,
    bonus: 0,
    price_cents: 4999,
    label: "Immortal’s Spatial Vault",
  },
] as const;

type PackId = (typeof PACKS)[number]["id"];

function findPack(packId: string | null | undefined) {
  if (!packId) return null;
  return PACKS.find((p) => p.id === packId) ?? null;
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServer();

    // 1) Parse JSON body
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Expected application/json" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      packId?: PackId;
    };

    const pack = findPack(body.packId);
    if (!pack) {
      return NextResponse.json(
        { error: "Unknown or missing packId" },
        { status: 400 }
      );
    }

    // 2) Require logged-in user (Bearer token, consistent with checkout)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!token) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = userData.user.id;

    // 3) Load profile to get current stones
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, spirit_stones")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) {
      console.error("purchase: profile load error", profileErr);
      return NextResponse.json(
        { error: "Could not load your profile" },
        { status: 500 }
      );
    }

    const currentStones = profile?.spirit_stones ?? 0;
    const stonesToAdd = pack.stones + pack.bonus;
    const newBalance = currentStones + stonesToAdd;

    // 4) In beta we just credit stones immediately.
    //    Later, Stripe webhook will call the same logic.
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ spirit_stones: newBalance })
      .eq("id", userId);

    if (updateErr) {
      console.error("purchase: updateErr", updateErr);
      return NextResponse.json(
        { error: "Failed to update Spirit Stones" },
        { status: 500 }
      );
    }

    // 5) Try to log the purchase (non-fatal)
    try {
      const { error: logErr } = await supabase.from("purchases").insert({
        user_id: userId,
        pack_id: pack.id,
        stones: stonesToAdd,
        price_cents: pack.price_cents,
        currency: "usd",
        source: "beta_fake",
      });

      if (logErr) {
        console.warn("purchase: logErr (non-fatal)", logErr);
      }
    } catch (e) {
      console.warn("purchase: log insert threw (non-fatal)", e);
    }

    return NextResponse.json(
      {
        ok: true,
        pack: {
          id: pack.id,
          stones: pack.stones,
          bonus: pack.bonus,
          label: pack.label,
        },
        newBalance,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("purchase fatal:", msg);
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}
