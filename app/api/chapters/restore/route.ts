// app/api/chapters/restore/route.ts
import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const sb = await supabaseServerClient();

    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const storyId = body?.storyId as string | undefined;
    const chapterNumber = Number(body?.chapterNumber);

    if (!storyId || !Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return NextResponse.json({ error: "Missing storyId or chapterNumber" }, { status: 400 });
    }

    const { data: story } = await sb
      .from("stories")
      .select("id, user_id, author_id")
      .eq("id", storyId)
      .maybeSingle();

    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

    const isOwner = story.user_id === user.id || story.author_id === user.id;
    if (!isOwner) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    // Restore
    const { error } = await sb
      .from("chapters")
      .update({ is_deleted: false, deleted_at: null })
      .eq("story_id", storyId)
      .eq("chapter_number", chapterNumber)
      .eq("is_deleted", true);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}