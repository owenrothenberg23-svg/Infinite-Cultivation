import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice("Bearer ".length).trim() : "";
}

function S(v: unknown, d = ""): string {
  return typeof v === "string" && v.length ? v : d;
}

export async function POST(req: Request) {
  try {
    const sb = getSupabaseServer();
    const token = getBearer(req);
    if (!token) return NextResponse.json({ error: "Please log in to continue" }, { status: 401 });

    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: "Please log in to continue" }, { status: 401 });
    }

    const userId = userData.user.id;
    const body = await req.json().catch(() => ({} as any));
    const storyId = S(body?.storyId);
    const rating = Number(body?.rating);

    if (!storyId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid storyId/rating" }, { status: 400 });
    }

    // Upsert rating
    const { error } = await sb.from("story_ratings").upsert(
      { story_id: storyId, user_id: userId, rating, updated_at: new Date().toISOString() },
      { onConflict: "story_id,user_id" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
