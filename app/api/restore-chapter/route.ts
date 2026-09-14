import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const storyId =
      typeof body?.storyId === "string" ? body.storyId.trim() : "";

    const chapterNumber = Number(body?.chapterNumber);

    if (
      !storyId ||
      !Number.isInteger(chapterNumber) ||
      chapterNumber < 1
    ) {
      return NextResponse.json(
        { error: "Invalid story or chapter." },
        { status: 400 }
      );
    }

    const authClient = await supabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const supabase = supabaseAdmin();

    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select("id, user_id, author_id, is_public")
      .eq("id", storyId)
      .maybeSingle();

    if (storyError || !story) {
      return NextResponse.json(
        { error: "Story not found." },
        { status: 404 }
      );
    }

    const isOwner =
      story.user_id === user.id ||
      story.author_id === user.id;

    if (!isOwner) {
      return NextResponse.json(
        { error: "You do not own this story." },
        { status: 403 }
      );
    }

    const { data: chapter, error: chapterError } = await supabase
      .from("chapters")
      .select("id")
      .eq("story_id", storyId)
      .eq("chapter_number", chapterNumber)
      .eq("is_deleted", true)
      .maybeSingle();

    if (chapterError || !chapter) {
      return NextResponse.json(
        { error: "Deleted chapter not found." },
        { status: 404 }
      );
    }

    const { error: restoreError } = await supabase
      .from("chapters")
      .update({
        is_deleted: false,
      })
      .eq("id", chapter.id);

    if (restoreError) {
      return NextResponse.json(
        { error: restoreError.message },
        { status: 500 }
      );
    }

    if (story.is_public) {
      const { count } = await supabase
        .from("chapters")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("story_id", storyId)
        .eq("is_deleted", false)
        .not("final_content", "is", null);

      const { error: novelUpdateError } = await supabase
        .from("novels")
        .update({
          chapters_total: count ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq("hosted_story_id", storyId);

      if (novelUpdateError) {
        console.error(
          "Failed to sync novel chapter count after restore:",
          novelUpdateError
        );
      }
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("restore-chapter error:", error);

    return NextResponse.json(
      { error: "Failed to restore chapter." },
      { status: 500 }
    );
  }
}