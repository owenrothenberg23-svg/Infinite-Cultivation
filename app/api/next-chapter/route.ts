// app/api/next-chapter/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

// model
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

// ---------- GLOBAL SAFETY CONTROLS ----------
const GENERATION_DISABLED =
  process.env.GENERATION_DISABLED === "true" ||
  process.env.GENERATION_ENABLED === "false";

const MAX_CHAPTERS_PER_STORY_PER_DAY = Number(
  process.env.MAX_CHAPTERS_PER_STORY_PER_DAY || "50"
);

const MAX_CHAPTER_CHARS = Number(process.env.MAX_CHAPTER_CHARS || "20000");

// ---------- helpers ----------
const S = (v: unknown, d = ""): string =>
  typeof v === "string" && v.length ? v : d;
const T = (b: unknown): boolean => !!b && b !== "false" && b !== "0";

type ChapterExcerpt = {
  chapter_number: number;
  final_content?: string | null;
  draft_content?: string | null;
  content?: string | null;
};

type MemorySnippet = { kind: string | null; content: string | null };
type Prefs = Record<string, unknown>;

function atext(msg: any): string {
  const blocks = Array.isArray(msg?.content) ? msg.content : [];
  const out: string[] = [];
  for (const b of blocks) {
    if (b?.type === "text" && typeof b?.text === "string") out.push(b.text);
  }
  return out.join("\n").trim();
}

async function ensureModelAvailable(anthropic: Anthropic) {
  try {
    await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1,
      messages: [{ role: "user", content: [{ type: "text", text: "ping" }] }],
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : String(e);
    throw new Error(
      `Model '${MODEL}' not available. Console model access must match. Upstream: ${msg}`
    );
  }
}

export async function POST(req: Request) {
  const supabase = getSupabaseServer();

  let charged = false;
  let userIdForRefund: string | null = null;

  try {
    // ---------- KILL SWITCH ----------
    if (GENERATION_DISABLED) {
      return NextResponse.json(
        {
          error:
            "Chapter generation is temporarily disabled while the Heavenly Dao recalibrates.",
        },
        { status: 503 }
      );
    }

    // ---------- Require logged-in user via Bearer token ----------
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Please log in to continue" },
        { status: 401 }
      );
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);

    if (userErr || !userData?.user) {
      return NextResponse.json(
        { error: "Please log in to continue" },
        { status: 401 }
      );
    }

    // ✅ Closed beta allowlist check
    const email = userData.user.email?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json(
        { error: "Account email missing." },
        { status: 401 }
      );
    }

    const { data: allow } = await supabase
      .from("beta_allowlist")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (!allow) {
      return NextResponse.json(
        { error: "This is a closed beta. Please request an invite to continue." },
        { status: 403 }
      );
    }

    const userId = userData.user.id;
    userIdForRefund = userId;

    // ---------- Extract storyId ----------
    const ctype = (req.headers.get("content-type") || "").toLowerCase();
    let storyId = "";

    if (ctype.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as any;
      storyId = S(body.storyId);
    } else if (
      ctype.includes("application/x-www-form-urlencoded") ||
      ctype.includes("multipart/form-data")
    ) {
      const fd = await req.formData();
      storyId = S(fd.get("storyId"));
    } else {
      const url = new URL(req.url);
      storyId = S(url.searchParams.get("storyId"));
    }

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    // ---------- Anthropic client (lazy init, avoids import-time crash) ----------
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic API key missing." },
        { status: 500 }
      );
    }
    const anthropic = new Anthropic({ apiKey });

    // ---------- Check model availability ----------
    try {
      await ensureModelAvailable(anthropic);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message }, { status: 400 });
    }

    // ---------- Load story (AND verify ownership) ----------
    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .select(
        "id, user_id, title, last_chapter_number, prefs_json, book_summary, current_arc_summary, world_bible"
      )
      .eq("id", storyId)
      .eq("user_id", userId) // ✅ ownership guard
      .single();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const nextNum = (story.last_chapter_number ?? 0) + 1;
    const prefs = (story.prefs_json as Prefs) || {};

    // ---------- Prevent double-generate / duplicate chapter numbers ----------
    const { data: existing, error: existErr } = await supabase
      .from("chapters")
      .select("id, chapter_number")
      .eq("story_id", storyId)
      .eq("chapter_number", nextNum)
      .maybeSingle();

    if (!existErr && existing?.id) {
      return NextResponse.json(
        { error: "That chapter already exists. Refresh the page.", chapter: existing },
        { status: 409 }
      );
    }

    // ---------- DAILY CAP ----------
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: rec, error: recErr } = await supabase
        .from("chapters")
        .select("id")
        .eq("story_id", storyId)
        .gte("created_at", since);

      if (!recErr) {
        const count = rec?.length ?? 0;
        if (count >= MAX_CHAPTERS_PER_STORY_PER_DAY) {
          return NextResponse.json(
            {
              error: `Daily chapter cap reached. Max = ${MAX_CHAPTERS_PER_STORY_PER_DAY}.`,
            },
            { status: 429 }
          );
        }
      }
    } catch (e) {
      console.warn("cap check failed (non-fatal)", e);
    }

    // ---------- Atomic charge: 1 Spirit Stone ----------
    const { data: ok, error: decErr } = await supabase.rpc(
      "decrement_spirit_stones",
      { p_user_id: userId, p_amount: 1 }
    );

    if (decErr || !ok) {
      return NextResponse.json(
        { error: "Not enough Spirit Stones" },
        { status: 402 }
      );
    }
    charged = true;

    // ---------- Recent chapters ----------
    const { data: recentChapters } = await supabase
      .from("chapters")
      .select("chapter_number, final_content, draft_content, content")
      .eq("story_id", storyId)
      .order("chapter_number", { ascending: false })
      .limit(4);

    const continuity =
      (recentChapters as ChapterExcerpt[])?.length
        ? [...(recentChapters as ChapterExcerpt[])]
            .sort((a, b) => a.chapter_number - b.chapter_number)
            .map((ch) => {
              const best =
                ch.final_content ?? ch.draft_content ?? ch.content ?? "";
              return `CHAPTER ${ch.chapter_number} (excerpt):\n${S(best).slice(
                0,
                2400
              )}`;
            })
            .join("\n\n")
        : "(no previous chapters yet)";

    // ---------- Memory ----------
    const { data: memoryBundle } = await supabase
      .from("memories")
      .select("kind, content, chapter_number")
      .eq("story_id", storyId)
      .order("chapter_number", { ascending: false })
      .limit(150);

    const memoryText =
      (memoryBundle as MemorySnippet[])?.length
        ? (memoryBundle as MemorySnippet[])
            .map((m) => `• [${S(m.kind)}] ${S(m.content)}`)
            .join("\n")
        : "(no memory yet)";

    // ---------- Pref mapping (unchanged) ----------
    const tone = S((prefs as any).tone, "epic");
    const toneStyle =
      {
        epic: "Epic, mythic narration. Sweeping emotional arcs.",
        ruthless: "Brutal, efficient prose. The world is cruel.",
        arrogant: "Cocky humor, dramatic flair.",
        enlightened: "Poetic descriptions, inner reflection.",
        schemer: "Strategic internal monologues.",
      }[tone] ?? "Epic, mythic narration.";

    const worldType = S((prefs as any).world_type, "xianxia_high");
    const worldRules =
      {
        wuxia_low: "Low fantasy; subtle energy.",
        xianxia_high: "High cultivation; realms, sects, artifacts.",
        xuanhuan: "Hybrid Eastern/Wesern fantasy.",
        modern_urban: "Hidden cultivation in modern world.",
        sci_fantasy: "Cultivation + cosmic tech.",
      }[worldType] ?? "High cultivation fantasy.";

    const mc = S((prefs as any).mc_personality, "steadfast");
    const mcVoice =
      {
        ruthless: "MC is unforgiving.",
        steadfast: "MC is principled.",
        playful: "MC uses humor.",
        cunning: "MC manipulates from shadows.",
        compassionate: "MC shows empathy.",
      }[mc] ?? "MC is steady.";

    const op = S((prefs as any).op_level, "balanced");
    const opRules =
      {
        struggle: "Breakthroughs must be earned.",
        balanced: "Growth believable.",
        overpowered: "MC strong; challenge via politics or constraints.",
      }[op] ?? "Balanced progression.";

    const romance = S((prefs as any).romance_level, "subplot");
    const romanceRules =
      {
        none: "No romance.",
        slow_burn: "Subtle tension.",
        subplot: "Occasional romance.",
        harem_light: "Multiple interests; tasteful.",
      }[romance] ?? "Romance as subplot.";

    const violence = S((prefs as any).violence_level, "balanced");
    const violenceRules =
      {
        low: "Limit gore.",
        balanced: "Violence serves plot.",
        savage: "Visceral fights allowed.",
      }[violence] ?? "Balanced combat.";

    const prog = S((prefs as any).power_progression, "steady");
    const progRules =
      {
        slow: "Rare breakthroughs.",
        steady: "Regular earned breakthroughs.",
        fast: "Frequent breakthroughs.",
      }[prog] ?? "Steady progression.";

    const flags = ((prefs as any).flags as any) || {};
    const wantsSystem = T(flags["system_cheats"]);

    const flagLines = [
      wantsSystem
        ? "HARD RULE: At least one [SYSTEM] element must appear if relevant."
        : "",
      T(flags["transmigration"]) ? "Include reincarnation motives." : "",
      T(flags["comedy"]) ? "Allow witty humor." : "",
      T(flags["grimdark"]) ? "Bleak undercurrents allowed." : "",
    ]
      .filter(Boolean)
      .join("\n");

    // ---------- Prompt builder ----------
    const sysHeader = [
      "You are a professional Xianxia webnovel author.",
      `TONE: ${toneStyle}`,
      `WORLD: ${worldRules}`,
      `MC: ${mcVoice}`,
      `OP: ${opRules}`,
      `ROMANCE: ${romanceRules}`,
      `VIOLENCE: ${violenceRules}`,
      `PROGRESSION: ${progRules}`,
      flagLines || "",
      "",
      "Absolute rules:",
      "- Maintain continuity using memory + recent chapters.",
      "- Keep names/items/sects consistent.",
      "- End chapter with a hook.",
      wantsSystem ? "- MUST include at least one in-world [SYSTEM] panel/prompt." : "",
    ]
      .filter(Boolean)
      .join("\n");

    const sharedContext = [
      `Title: ${story.title}`,
      `Writing next: Chapter ${nextNum}`,
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

    // ---------- Outline pass ----------
    const outlineMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: sysHeader + "\n\nProduce a compact outline as STRICT JSON only.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                sharedContext +
                `\n\nReturn JSON with: {scene_goal, conflict, beats[], pov, style_primer[], system_hook}`,
            },
          ],
        },
      ],
    });

    let outline: any = {};
    try {
      outline = JSON.parse(atext(outlineMsg) || "{}");
    } catch {
      outline = {};
    }

    // ---------- Draft ----------
    const draftMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000,
      temperature: 0.7,
      system: sysHeader,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                sharedContext,
                "",
                "OUTLINE:",
                JSON.stringify(outline, null, 2),
                "",
                `Task: Write Chapter ${nextNum}, 1300–2200 words.`,
              ].join("\n"),
            },
          ],
        },
      ],
    });

    let content = atext(draftMsg).trim();

    // ---------- Fix pass ----------
    const fixMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000,
      temperature: 0.2,
      system: "You are a continuity auditor. Return corrected chapter only.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Fix contradictions and ensure SYSTEM (if required) is consistent.\n\n" +
                "MEMORY:\n" +
                memoryText +
                "\n\nEXCERPTS:\n" +
                continuity +
                "\n\nDRAFT:\n" +
                content,
            },
          ],
        },
      ],
    });

    const fixed = atext(fixMsg).trim();
    if (fixed) content = fixed;

    // ---------- Polish ----------
    const polishMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000,
      temperature: 0.1,
      system:
        "Line editor: improve flow, vary rhythm, keep meaning. Return chapter only.",
      messages: [{ role: "user", content: [{ type: "text", text: content }] }],
    });

    const polished = atext(polishMsg).trim();
    if (polished) content = polished;

    // ---------- Server-side max length guard ----------
    if (MAX_CHAPTER_CHARS > 0 && content.length > MAX_CHAPTER_CHARS) {
      content = content.slice(0, MAX_CHAPTER_CHARS).trim();
    }

    // Prevent empty chapters
    if (!content || content.trim().length < 50) {
      // refund if generation produced garbage
      if (charged) {
        await supabase.rpc("increment_spirit_stones", {
          p_user_id: userId,
          p_amount: 1,
        });
        charged = false;
      }

      return NextResponse.json(
        { error: "Generation failed to produce usable chapter text. Please try again." },
        { status: 502 }
      );
    }

    // ---------- Insert chapter ----------
    const { data: inserted, error: insertErr } = await supabase
      .from("chapters")
      .insert({
        story_id: storyId,
        chapter_number: nextNum,
        title: `Chapter ${nextNum}`,
        content,
        draft_content: content,
        is_final: false,
      })
      .select("id, chapter_number")
      .single();

    if (insertErr || !inserted) {
      // refund if insert fails
      if (charged) {
        await supabase.rpc("increment_spirit_stones", {
          p_user_id: userId,
          p_amount: 1,
        });
        charged = false;
      }

      return NextResponse.json(
        { error: insertErr?.message || "Insert failed" },
        { status: 500 }
      );
    }

    // ---------- Bump last_chapter_number ----------
    await supabase
      .from("stories")
      .update({ last_chapter_number: nextNum })
      .eq("id", storyId);

    return NextResponse.json({ chapter: inserted }, { status: 200 });
  } catch (err: any) {
    // best-effort refund on unexpected crash
    if (charged && userIdForRefund) {
      try {
        await supabase.rpc("increment_spirit_stones", {
          p_user_id: userIdForRefund,
          p_amount: 1,
        });
      } catch {}
    }

    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
