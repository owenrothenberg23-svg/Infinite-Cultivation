import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServer();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const storyId = String(body?.storyId || "");
    const chapterNumber = Number(body?.chapterNumber);
    const title = body?.title === null ? null : String(body?.title || "").trim();
    const content = String(body?.content || "");

    if (!storyId || !Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return NextResponse.json({ error: "Invalid inputs" }, { status: 400 });
    }

    // Ensure author owns story
    const { data: story } = await supabase
      .from("stories")
      .select("id, user_id")
      .eq("id", storyId)
      .maybeSingle();

    if (!story || story.user_id !== userData.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Update chapter draft fields (and keep legacy `content` in sync)
    const { error: upErr } = await supabase
      .from("chapters")
      .update({
        title: title || null,
        draft_content: content,
        content, // compatibility if you still read this
      })
      .eq("story_id", storyId)
      .eq("chapter_number", chapterNumber);

    if (upErr) {
      console.error("save-draft: update error", upErr);
      return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("save-draft fatal:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}