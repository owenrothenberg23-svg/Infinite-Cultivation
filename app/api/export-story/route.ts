// app/api/export-story/route.ts
import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get("storyId");

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    const sb = await supabaseServerClient();

    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: story, error: storyErr } = await sb
      .from("stories")
      .select("id, title, user_id, author_id")
      .eq("id", storyId)
      .maybeSingle();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const isOwner =
      story.user_id === user.id || story.author_id === user.id;

    if (!isOwner) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { data: chapters, error: chErr } = await sb
      .from("chapters")
      .select("chapter_number, title, draft_content, final_content, is_final")
      .eq("story_id", storyId)
      .order("chapter_number", { ascending: true });

    if (chErr) {
      return NextResponse.json({ error: chErr.message }, { status: 500 });
    }

    let output = `${story.title}\n\n`;

    for (const ch of chapters ?? []) {
      const content = ch.is_final
        ? ch.final_content
        : ch.draft_content;

      output += `Chapter ${ch.chapter_number}`;
      if (ch.title) output += `: ${ch.title}`;
      output += `\n`;
      output += `-----------------\n\n`;
      output += `${content ?? ""}\n\n\n`;
    }

    return new Response(output, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${story.title.replace(
          /[^a-z0-9]/gi,
          "_"
        )}.txt"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Export failed" },
      { status: 500 }
    );
  }
}