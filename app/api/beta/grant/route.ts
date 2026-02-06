import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

const ENABLED = process.env.BETA_GRANT_ENABLED === "true";
const MAX_USERS = Number(process.env.BETA_MAX_USERS || "50");
const GRANT = Number(process.env.BETA_GRANT_STONES || "20");

export async function POST() {
  try {
    if (!ENABLED) {
      return NextResponse.json({ ok: true, skipped: "disabled" }, { status: 200 });
    }

    // Identify current user (normal server client)
    const sb = getSupabaseServer();
    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;
    if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const userId = user.id;

    const admin = getSupabaseAdmin();

    // If already granted -> done
    const { data: me } = await admin
      .from("profiles")
      .select("beta_granted")
      .eq("id", userId)
      .maybeSingle();

    if (me?.beta_granted) {
      return NextResponse.json({ ok: true, already: true }, { status: 200 });
    }

    // Count how many already granted
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("beta_granted", true);

    const grantedCount = count ?? 0;

    if (grantedCount >= MAX_USERS) {
      return NextResponse.json(
        { ok: true, skipped: "cap_reached", grantedCount },
        { status: 200 }
      );
    }

    // Grant stones + mark
    const { data: profile } = await admin
      .from("profiles")
      .select("spirit_stones")
      .eq("id", userId)
      .maybeSingle();

    const prev = profile?.spirit_stones ?? 0;
    const newBalance = prev + GRANT;

    await admin
      .from("profiles")
      .update({
        spirit_stones: newBalance,
        beta_granted: true,
        beta_granted_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return NextResponse.json(
      { ok: true, granted: GRANT, newBalance, grantedCount: grantedCount + 1 },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("beta grant fatal:", e);
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
