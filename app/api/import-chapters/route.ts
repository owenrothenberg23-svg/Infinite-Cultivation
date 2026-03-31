// app/api/import-chapters/route.ts
import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

type IncomingChapter = {
  chapter_number: number;
  title: string;
  content: string;
};

type ImportMode = "reject" | "skip" | "overwrite";

function cleanTitle(t: string) {
  return (t || "").trim().slice(0, 200);
}

function cleanContent(c: string) {
  return (c || "").replace(/\r\n/g, "\n").trim();
}

function chunkArray<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(req: Request) {
  try {
    const sb = await supabaseServerClient();

    const { data: userData, error: userErr } = await sb.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const storyId = body?.storyId as string | undefined;
    const chapters = (body?.chapters as IncomingChapter[] | undefined) ?? [];
    const mode = (body?.mode as ImportMode | undefined) ?? "reject";

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    if (!Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json({ error: "No chapters to import" }, { status: 400 });
    }

    if (!["reject", "skip", "overwrite"].includes(mode)) {
      return NextResponse.json({ error: "Invalid import mode" }, { status: 400 });
    }

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

    const normalized = chapters
      .map((ch) => ({
        chapter_number: Number(ch.chapter_number),
        title: cleanTitle(ch.title || ""),
        content: cleanContent(ch.content || ""),
      }))
      .filter(
        (ch) =>
          Number.isFinite(ch.chapter_number) &&
          ch.chapter_number > 0 &&
          !!ch.content
      );

    if (normalized.length === 0) {
      return NextResponse.json({ error: "All chapters were empty/invalid" }, { status: 400 });
    }

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

    const nums = normalized.map((c) => c.chapter_number);
    const minN = Math.min(...nums);
    const maxN = Math.max(...nums);

    // ✅ IMPORTANT: only treat NOT-deleted chapters as conflicts
    const { data: existing, error: existErr } = await sb
      .from("chapters")
      .select("chapter_number")
      .eq("story_id", storyId)
      .eq("is_deleted", false)
      .gte("chapter_number", minN)
      .lte("chapter_number", maxN);

    if (existErr) {
      return NextResponse.json({ error: existErr.message }, { status: 500 });
    }

    const existingSet = new Set<number>(
      (existing ?? []).map((r: any) => Number(r.chapter_number))
    );

    const conflicts = normalized
      .map((c) => c.chapter_number)
      .filter((n) => existingSet.has(n));

    if (conflicts.length > 0 && mode === "reject") {
      return NextResponse.json(
        {
          error: `Chapters already exist for numbers: ${conflicts
            .slice(0, 20)
            .join(", ")}${conflicts.length > 20 ? "…" : ""}`,
        },
        { status: 409 }
      );
    }

    let toInsert = normalized;
    let skipped = 0;

    if (mode === "skip" && conflicts.length > 0) {
      toInsert = normalized.filter((c) => {
        const hit = existingSet.has(c.chapter_number);
        if (hit) skipped++;
        return !hit;
      });
    }

    if (mode === "overwrite" && conflicts.length > 0) {
      // ✅ Soft-delete conflicts in batches (instead of hard delete)
      const UPD_BATCH = 200;
      const updBatches = chunkArray(conflicts, UPD_BATCH);

      for (let i = 0; i < updBatches.length; i++) {
        const batch = updBatches[i];
        const { error: updErr } = await sb
          .from("chapters")
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq("story_id", storyId)
          .eq("is_deleted", false)
          .in("chapter_number", batch);

        if (updErr) {
          return NextResponse.json(
            {
              error: `Overwrite soft-delete failed (batch ${i + 1}/${updBatches.length}): ${updErr.message}`,
            },
            { status: 500 }
          );
        }
      }
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ ok: true, imported: 0, skipped }, { status: 200 });
    }

    const rows = toInsert.map((ch) => ({
      story_id: storyId,
      chapter_number: ch.chapter_number,
      title: ch.title || `Chapter ${ch.chapter_number}`,
      content: ch.content,
      draft_content: ch.content,
      final_content: null,
      is_final: false,
      is_deleted: false,
      deleted_at: null,
    }));

    const INS_BATCH = 50;
    const insBatches = chunkArray(rows, INS_BATCH);

    let imported = 0;
    for (let i = 0; i < insBatches.length; i++) {
      const batch = insBatches[i];
      const { error: insErr } = await sb.from("chapters").insert(batch);

      if (insErr) {
        return NextResponse.json(
          {
            error: `Insert failed (batch ${i + 1}/${insBatches.length}): ${insErr.message}`,
            imported,
            skipped,
          },
          { status: 500 }
        );
      }

      imported += batch.length;
    }

    const insertedMax = Math.max(...toInsert.map((c) => c.chapter_number));
    const newLast = Math.max(Number(story.last_chapter_number ?? 0), insertedMax);

    const { error: upErr } = await sb
      .from("stories")
      .update({ last_chapter_number: newLast })
      .eq("id", storyId);

    if (upErr) {
      return NextResponse.json(
        {
          ok: true,
          imported,
          skipped,
          warning: `Imported, but failed to update last_chapter_number: ${upErr.message}`,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { ok: true, imported, skipped, last_chapter_number: newLast },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("import-chapters error:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}