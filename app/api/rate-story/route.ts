// app/api/rate-story/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const sb = getSupabaseServer();

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const storyId = String(body.storyId || "").trim();
    const rating = Number(body.rating);

    if (!storyId) return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be 1..5" }, { status: 400 });
    }

    // must be public story
    const { data: story } = await sb
      .from("stories")
      .select("id, is_public")
      .eq("id", storyId)
      .maybeSingle();

    if (!story?.id || !story.is_public) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const userId = userData.user.id;

    // upsert rating
    const { error: upErr } = await sb
      .from("story_ratings")
      .upsert(
        { story_id: storyId, user_id: userId, rating },
        { onConflict: "user_id,story_id" }
      );

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    // recompute avg + count
    const { data: rows, error: aggErr } = await sb
      .from("story_ratings")
      .select("rating")
      .eq("story_id", storyId);

    if (!aggErr) {
      const nums = (rows || []).map((r: any) => Number(r.rating)).filter((n) => Number.isFinite(n));
      const count = nums.length || 0;
      const avg = count ? nums.reduce((a, b) => a + b, 0) / count : null;

      await sb
        .from("stories")
        .update({ avg_rating: avg })
        .eq("id", storyId);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}