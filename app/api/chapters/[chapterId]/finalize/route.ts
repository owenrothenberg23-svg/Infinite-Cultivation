// app/api/chapters/[chapterId]/finalize/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

const S = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

// ✅ Type-safe-ish text extractor that won’t crash on Thinking blocks
function atext(msg: any): string {
  const content = Array.isArray(msg?.content) ? msg.content : [];
  const texts: string[] = [];
  for (const block of content) {
    if (block?.type === "text" && typeof block?.text === "string") {
      texts.push(block.text);
    }
  }
  return texts.join("\n").trim();
}

export async function POST(
  req: Request,
  ctx: { params: { chapterId: string } }
) {
  try {
    const supabase = getSupabaseServer();

    // ---- Auth (Bearer token) ----
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!token) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const userId = userData.user.id;
    const chapterId = ctx.params.chapterId;

    // ---- Body ----
    const body = await req.json().catch(() => ({} as any));
    const finalContent =
      typeof body?.final_content === "string" ? body.final_content.trim() : "";

    if (!finalContent || finalContent.length < 100) {
      return NextResponse.json(
        { error: "Final content is too short." },
        { status: 400 }
      );
    }

    // ---- Load chapter + story ownership ----
    // NOTE: this assumes stories has user_id and chapters has story_id.
    const { data: ch, error: chErr } = await supabase
      .from("chapters")
      .select("id, story_id, chapter_number, is_final")
      .eq("id", chapterId)
      .single();

    if (chErr || !ch) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const storyId = ch.story_id as string;
    const chapterNumber = (ch.chapter_number ?? 0) as number;

    // Verify story owner
    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .select("id, user_id, title, world_bible")
      .eq("id", storyId)
      .single();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (story.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (ch.is_final) {
      return NextResponse.json({ error: "Chapter already finalized." }, { status: 400 });
    }

    // ---- 1) Finalize chapter (private canon) ----
    const { error: finErr } = await supabase
      .from("chapters")
      .update({
        content: finalContent,
        draft_content: null,
        is_final: true,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", chapterId);

    if (finErr) {
      return NextResponse.json({ error: finErr.message }, { status: 500 });
    }

    // ---- 2) Extract canon updates + memories (non-fatal) ----
    let worldBibleAdditions = "";
    let memories: Record<string, string[]> = {};

    try {
      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1200,
        temperature: 0,
        system: "You are a continuity librarian for a xianxia webnovel. Return STRICT JSON only.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  storyTitle: story.title || "",
                  chapterNumber,
                  chapterText: finalContent,
                  instructions:
                    "Return JSON with keys: world_bible_additions (string), memories (object with arrays: facts, characters, locations, items, threads, rules). Keep additions concise.",
                }),
              },
            ],
          },
        ],
      });

      const raw = atext(msg) || "{}";
      const parsed = JSON.parse(raw);

      worldBibleAdditions = S(parsed?.world_bible_additions, "").trim();
      memories =
        parsed?.memories && typeof parsed.memories === "object"
          ? (parsed.memories as Record<string, string[]>)
          : {};
    } catch (e) {
      console.warn("finalize: extraction failed (non-fatal)", e);
    }

    // ---- 3) Update world bible (append) (non-fatal) ----
    if (worldBibleAdditions) {
      const prev = (story.world_bible || "").trim();
      const appended =
        (prev ? prev + "\n\n" : "") +
        `[Chapter ${chapterNumber} – Canon Updates]\n` +
        worldBibleAdditions;

      const { error: wbErr } = await supabase
        .from("stories")
        .update({ world_bible: appended })
        .eq("id", storyId);

      if (wbErr) console.warn("finalize: world_bible update failed (non-fatal)", wbErr);
    }

    // ---- 4) Insert memories (non-fatal) ----
    try {
      const rows: any[] = [];
      for (const [kind, arr] of Object.entries(memories || {})) {
        if (Array.isArray(arr)) {
          for (const entry of arr) {
            const v = S(entry).trim();
            if (v) {
              rows.push({
                story_id: storyId,
                chapter_number: chapterNumber,
                kind,
                content: v,
              });
            }
          }
        }
      }
      if (rows.length) {
        await supabase.from("memories").insert(rows);
      }
    } catch (e) {
      console.warn("finalize: memories insert failed (non-fatal)", e);
    }

    return NextResponse.json(
      { ok: true, storyId, chapterNumber },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("finalize fatal:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
