import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sb = getSupabaseServer();

  let charged = false;
  let fromUserId: string | null = null;
  let amount = 0;

  try {
    // must be logged in
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    fromUserId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as {
      storyId?: string;
      amount?: number;
      message?: string;
    };

    const storyId = String(body.storyId || "").trim();
    amount = Number(body.amount || 0);
    const message = String(body.message || "").trim().slice(0, 240);

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > 1000) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Load story -> get author to gift
    const { data: story, error: storyErr } = await sb
      .from("stories")
      .select("id, user_id")
      .eq("id", storyId)
      .single();

    if (storyErr || !story?.user_id) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const toUserId = story.user_id as string;

    if (toUserId === fromUserId) {
      return NextResponse.json(
        { error: "You can’t gift your own story." },
        { status: 400 }
      );
    }

    // 1) charge sender (atomic)
    const { data: ok, error: decErr } = await sb.rpc("decrement_spirit_stones", {
      p_user_id: fromUserId,
      p_amount: amount,
    });

    if (decErr || !ok) {
      return NextResponse.json({ error: "Not enough Spirit Stones" }, { status: 402 });
    }
    charged = true;

    // 2) credit receiver (best effort, but we DO want to rollback if it fails)
    const { error: incErr } = await sb.rpc("increment_spirit_stones", {
      p_user_id: toUserId,
      p_amount: amount,
    });

    if (incErr) {
      // rollback sender charge
      const { error: rbErr } = await sb.rpc("increment_spirit_stones", {
        p_user_id: fromUserId,
        p_amount: amount,
      });
      if (rbErr) console.warn("gift rollback failed", rbErr);

      charged = false;
      return NextResponse.json({ error: incErr.message }, { status: 500 });
    }

    // 3) record gift
    const { error: giftErr } = await sb.from("story_gifts").insert({
      story_id: storyId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount,
      message: message || null,
    });

    if (giftErr) {
      // rollback both sides if record insert fails
      const { error: rb1 } = await sb.rpc("increment_spirit_stones", {
        p_user_id: fromUserId,
        p_amount: amount,
      });
      const { error: rb2 } = await sb.rpc("decrement_spirit_stones", {
        p_user_id: toUserId,
        p_amount: amount,
      });
      if (rb1) console.warn("gift rollback sender failed", rb1);
      if (rb2) console.warn("gift rollback receiver failed", rb2);

      charged = false;
      return NextResponse.json({ error: "Failed to record gift" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    // emergency rollback if we charged but didn’t finish
    if (charged && fromUserId && amount > 0) {
      const { error: rbErr } = await sb.rpc("increment_spirit_stones", {
        p_user_id: fromUserId,
        p_amount: amount,
      });
      if (rbErr) console.warn("emergency rollback failed", rbErr);
    }

    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}