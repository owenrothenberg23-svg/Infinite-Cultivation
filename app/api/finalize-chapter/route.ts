import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

async function syncHostedChapterCount(
  supabase: ReturnType<typeof getSupabaseServer>,
  storyId: string
) {
  const { count, error: countErr } = await supabase
    .from("chapters")
    .select("id", { count: "exact", head: true })
    .eq("story_id", storyId)
    .eq("is_deleted", false)
    .not("final_content", "is", null);

  if (countErr) throw countErr;

  const { error: novelErr } = await supabase
    .from("novels")
    .update({
      chapters_total: count ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("hosted_story_id", storyId);

  if (novelErr) throw novelErr;
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServer();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const storyId = typeof body?.storyId === "string" ? body.storyId.trim() : "";
    const chapterNumber = Number(body?.chapterNumber);

    if (!storyId || !Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return NextResponse.json({ error: "Invalid inputs" }, { status: 400 });
    }

    const { data: story } = await supabase
      .from("stories")
      .select("id, user_id, author_id, is_public")
      .eq("id", storyId)
      .maybeSingle();

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const isOwner =
      story.user_id === userData.user.id || story.author_id === userData.user.id;

    if (!isOwner) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { data: chapter, error: chErr } = await supabase
      .from("chapters")
      .select("id, draft_content")
      .eq("story_id", storyId)
      .eq("chapter_number", chapterNumber)
      .eq("is_deleted", false)
      .maybeSingle();

    if (chErr || !chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const draft = String(chapter.draft_content || "").trim();
    if (!draft) {
      return NextResponse.json({ error: "Draft is empty" }, { status: 400 });
    }

    const { error: upErr } = await supabase
      .from("chapters")
      .update({ final_content: draft, content: draft })
      .eq("id", chapter.id);

    if (upErr) {
      console.error("finalize-chapter: update error", upErr);
      return NextResponse.json({ error: "Failed to finalize chapter" }, { status: 500 });
    }

    if (story.is_public) {
      try {
        await syncHostedChapterCount(supabase, storyId);
      } catch (syncErr) {
        console.error("finalize-chapter: catalog sync error", syncErr);
        return NextResponse.json(
          { error: "Chapter finalized, but catalog chapter count could not be synced." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    console.error("finalize-chapter fatal:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}