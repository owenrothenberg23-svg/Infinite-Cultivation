// app/api/ai/edit-assist/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

// Keep this modest so we don’t blow up tokens/cost
const MAX_INPUT_CHARS = Number(process.env.AI_ASSIST_MAX_INPUT_CHARS || "20000");
const MAX_OUTPUT_CHARS = Number(process.env.AI_ASSIST_MAX_OUTPUT_CHARS || "25000");

type Mode = "fix" | "rewrite" | "continue" | "suggest";
const isMode = (m: any): m is Mode =>
  m === "fix" || m === "rewrite" || m === "continue" || m === "suggest";

const S = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

function atext(msg: any): string {
  const blocks = Array.isArray(msg?.content) ? msg.content : [];
  const out: string[] = [];
  for (const b of blocks) {
    if (b?.type === "text" && typeof b?.text === "string") out.push(b.text);
  }
  return out.join("\n").trim();
}

export async function POST(req: Request) {
  try {
    const sb = getSupabaseServer();

    // ✅ cookie auth (same model as /api/save-draft, /api/finalize-chapter)
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as any;

    const storyId = S(body.storyId).trim();
    const chapterNumber = Number(body.chapterNumber);
    const mode = body.mode;
    const instruction = S(body.instruction).trim();
    let text = S(body.text).trim();

    if (!storyId || !Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return NextResponse.json({ error: "Missing storyId/chapterNumber" }, { status: 400 });
    }
    if (!isMode(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    if (MAX_INPUT_CHARS > 0 && text.length > MAX_INPUT_CHARS) {
      text = text.slice(0, MAX_INPUT_CHARS);
    }

    // ✅ ownership guard (author-only)
    const { data: story, error: storyErr } = await sb
      .from("stories")
      .select("id, user_id, title, prefs_json, book_summary, current_arc_summary, world_bible")
      .eq("id", storyId)
      .single();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    if (story.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load lightweight continuity (memories + last few chapters)
    const { data: mems } = await sb
      .from("memories")
      .select("kind, content, chapter_number")
      .eq("story_id", storyId)
      .order("chapter_number", { ascending: false })
      .limit(80);

    const memoryText =
      mems?.length
        ? mems
            .map((m: any) => `• [${S(m.kind)}] (ch ${m.chapter_number}) ${S(m.content)}`)
            .join("\n")
        : "(no memory yet)";

    const { data: recentChapters } = await sb
      .from("chapters")
      .select("chapter_number, final_content, draft_content, content")
      .eq("story_id", storyId)
      .order("chapter_number", { ascending: false })
      .limit(3);

    const continuity =
      recentChapters?.length
        ? [...recentChapters]
            .sort((a: any, b: any) => a.chapter_number - b.chapter_number)
            .map((ch: any) => {
              const best = ch.final_content ?? ch.draft_content ?? ch.content ?? "";
              return `CHAPTER ${ch.chapter_number} (excerpt):\n${S(best).slice(0, 1800)}`;
            })
            .join("\n\n")
        : "(no previous chapters yet)";

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Anthropic API key missing." }, { status: 500 });
    }
    const anthropic = new Anthropic({ apiKey });

    const prefs = story.prefs_json ?? {};

    // Shared context to keep names/terms consistent
    const sharedContext = [
      `Story: ${S(story.title)}`,
      `Editing: Chapter ${chapterNumber}`,
      "",
      "Preferences JSON:",
      JSON.stringify(prefs, null, 2),
      "",
      "Book summary:",
      S((story as any).book_summary, "(none)"),
      "Arc summary:",
      S((story as any).current_arc_summary, "(none)"),
      "World bible:",
      S((story as any).world_bible, "(none)"),
      "",
      "Durable memory:",
      memoryText,
      "",
      "Recent continuity:",
      continuity,
    ].join("\n");

    // System instruction per mode
    const modeSystem =
      mode === "fix"
        ? "You are a line editor. Fix typos, grammar, punctuation, and awkward phrasing. Preserve meaning, names, and tone. Return ONLY the revised chapter text."
        : mode === "rewrite"
        ? "You are a stylistic editor. Rewrite for clarity and impact while preserving plot facts, names, abilities, and tone. Return ONLY the revised chapter text."
        : mode === "continue"
        ? "You are the story author. Continue the chapter with 1–4 additional paragraphs that match voice and continuity. Return ONLY the continuation text (do not repeat the existing text)."
        : "You are an expert writing coach. Provide actionable suggestions as a BULLETED LIST. Do not rewrite. Keep it specific (pacing, clarity, dialogue, stakes, consistency).";

    const userTask =
      mode === "fix"
        ? `Task: Fix grammar/typos and improve readability.`
        : mode === "rewrite"
        ? `Task: Rewrite for stronger prose.`
        : mode === "continue"
        ? `Task: Continue the scene naturally from the last line.`
        : `Task: Provide suggestions only (no rewriting).`;

    const extra = instruction ? `\n\nExtra instruction: ${instruction}` : "";

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: mode === "suggest" ? 1200 : 5000,
      temperature: mode === "fix" ? 0.1 : mode === "rewrite" ? 0.5 : 0.7,
      system: modeSystem,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                sharedContext +
                "\n\n" +
                userTask +
                extra +
                "\n\n---\nCURRENT TEXT:\n" +
                text,
            },
          ],
        },
      ],
    });

    let output = atext(msg);

    if (!output) {
      return NextResponse.json({ error: "AI returned empty output." }, { status: 502 });
    }

    // Hard output clamp
    if (MAX_OUTPUT_CHARS > 0 && output.length > MAX_OUTPUT_CHARS) {
      output = output.slice(0, MAX_OUTPUT_CHARS).trim();
    }

    return NextResponse.json({ ok: true, output }, { status: 200 });
  } catch (err: any) {
    console.error("ai/edit-assist fatal:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}