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

    if (!storyId || !Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return NextResponse.json({ error: "Invalid inputs" }, { status: 400 });
    }

    const { data: story } = await supabase
      .from("stories")
      .select("id, user_id, last_chapter_number")
      .eq("id", storyId)
      .maybeSingle();

    if (!story || story.user_id !== userData.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Load chapter draft
    const { data: chapter, error: chErr } = await supabase
      .from("chapters")
      .select("id, draft_content, title")
      .eq("story_id", storyId)
      .eq("chapter_number", chapterNumber)
      .maybeSingle();

    if (chErr || !chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const draft = String((chapter as any)?.draft_content || "").trim();
    if (!draft) {
      return NextResponse.json({ error: "Draft is empty" }, { status: 400 });
    }

    // Finalize: draft -> final (and keep legacy `content`)
    const { error: upErr } = await supabase
      .from("chapters")
      .update({
        final_content: draft,
        content: draft,
      })
      .eq("story_id", storyId)
      .eq("chapter_number", chapterNumber);

    if (upErr) {
      console.error("finalize-chapter: update error", upErr);
      return NextResponse.json({ error: "Failed to finalize chapter" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("finalize-chapter fatal:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}