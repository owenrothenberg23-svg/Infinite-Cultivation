// app/api/import-chapters/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

type IncomingChapter = {
  chapter_number: number;
  title: string;
  content: string;
};

function cleanTitle(t: string) {
  return (t || "").trim().slice(0, 200);
}

function cleanContent(c: string) {
  return (c || "").replace(/\r\n/g, "\n").trim();
}

export async function POST(req: Request) {
  try {
    const sb = getSupabaseServer();

    const { data: userData, error: userErr } = await sb.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const storyId = body?.storyId as string | undefined;
    const chapters = (body?.chapters as IncomingChapter[] | undefined) ?? [];

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    if (!Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json({ error: "No chapters to import" }, { status: 400 });
    }

    // Load story + ownership guard (supports both user_id and author_id)
    const { data: story, error: storyErr } = await sb
      .from("stories")
      .select("id, user_id, author_id, last_chapter_number")
      .eq("id", storyId)
      .maybeSingle();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const isOwner = story.user_id === user.id || story.author_id === user.id;
    if (!isOwner) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Normalize + validate incoming chapters
    const normalized = chapters
      .map((ch) => ({
        chapter_number: Number(ch.chapter_number),
        title: cleanTitle(ch.title || ""),
        content: cleanContent(ch.content || ""),
      }))
      .filter((ch) => Number.isFinite(ch.chapter_number) && ch.chapter_number > 0 && ch.content);

    if (normalized.length === 0) {
      return NextResponse.json({ error: "All chapters were empty/invalid" }, { status: 400 });
    }

    // Ensure unique chapter numbers in request
    const seen = new Set<number>();
    for (const ch of normalized) {
      if (seen.has(ch.chapter_number)) {
        return NextResponse.json(
          { error: `Duplicate chapter_number in import: ${ch.chapter_number}` },
          { status: 400 }
        );
      }
      seen.add(ch.chapter_number);
    }

    // Check for conflicts with existing chapters
    const nums = normalized.map((c) => c.chapter_number);
    const minN = Math.min(...nums);
    const maxN = Math.max(...nums);

    const { data: existing, error: existErr } = await sb
      .from("chapters")
      .select("chapter_number")
      .eq("story_id", storyId)
      .gte("chapter_number", minN)
      .lte("chapter_number", maxN);

    if (existErr) {
      return NextResponse.json({ error: existErr.message }, { status: 500 });
    }

    const existingSet = new Set<number>((existing ?? []).map((r: any) => Number(r.chapter_number)));
    const conflicts = normalized
      .map((c) => c.chapter_number)
      .filter((n) => existingSet.has(n));

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: `Chapters already exist for numbers: ${conflicts.slice(0, 20).join(", ")}${
            conflicts.length > 20 ? "…" : ""
          }`,
        },
        { status: 409 }
      );
    }

    // Insert as drafts
    const rows = normalized.map((ch) => ({
      story_id: storyId,
      chapter_number: ch.chapter_number,
      title: ch.title || `Chapter ${ch.chapter_number}`,
      // safest with your schema:
      content: ch.content, // legacy/read helpers
      draft_content: ch.content,
      final_content: null,
      is_final: false,
    }));

    const { error: insErr } = await sb.from("chapters").insert(rows);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // Update last_chapter_number
    const newLast = Math.max(Number(story.last_chapter_number ?? 0), maxN);
    const { error: upErr } = await sb
      .from("stories")
      .update({ last_chapter_number: newLast })
      .eq("id", storyId);

    if (upErr) {
      // Not fatal, but helpful to know
      return NextResponse.json(
        { ok: true, imported: rows.length, warning: `Imported, but failed to update last_chapter_number: ${upErr.message}` },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, imported: rows.length, last_chapter_number: newLast }, { status: 200 });
  } catch (err: any) {
    console.error("import-chapters error:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}