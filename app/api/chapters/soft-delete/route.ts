import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

async function syncHostedChapterCount(
  sb: Awaited<ReturnType<typeof supabaseServerClient>>,
  storyId: string
) {
  const { count, error: countErr } = await sb
    .from("chapters")
    .select("id", { count: "exact", head: true })
    .eq("story_id", storyId)
    .eq("is_deleted", false)
    .not("final_content", "is", null);

  if (countErr) throw countErr;

  const { error: novelErr } = await sb
    .from("novels")
    .update({ chapters_total: count ?? 0, updated_at: new Date().toISOString() })
    .eq("hosted_story_id", storyId);

  if (novelErr) throw novelErr;
}

export async function POST(req: Request) {
  try {
    const sb = await supabaseServerClient();
    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const storyId = typeof body?.storyId === "string" ? body.storyId.trim() : "";
    const chapterNumber = Number(body?.chapterNumber);

    if (!storyId || !Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return NextResponse.json(
        { error: "Missing storyId or chapterNumber" },
        { status: 400 }
      );
    }

    const { data: story } = await sb
      .from("stories")
      .select("id, user_id, author_id, is_public")
      .eq("id", storyId)
      .maybeSingle();

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const isOwner = story.user_id === user.id || story.author_id === user.id;
    if (!isOwner) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { data: deletedChapter, error } = await sb
      .from("chapters")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("story_id", storyId)
      .eq("chapter_number", chapterNumber)
      .eq("is_deleted", false)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!deletedChapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    if (story.is_public) {
      try {
        await syncHostedChapterCount(sb, storyId);
      } catch (syncErr) {
        console.error("soft-delete: catalog sync error", syncErr);
        return NextResponse.json(
          { error: "Chapter deleted, but catalog chapter count could not be synced." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}