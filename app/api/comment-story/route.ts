// app/api/comment-story/route.ts
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
    const content = String(body.content || "").trim();

    if (!storyId) return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    if (!content || content.length < 1) return NextResponse.json({ error: "Comment is empty" }, { status: 400 });
    if (content.length > 2000) return NextResponse.json({ error: "Comment too long" }, { status: 400 });

    // must be public
    const { data: story } = await sb
      .from("stories")
      .select("id, is_public")
      .eq("id", storyId)
      .maybeSingle();

    if (!story?.id || !story.is_public) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const { error } = await sb.from("story_comments").insert({
      story_id: storyId,
      user_id: userData.user.id,
      content,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}