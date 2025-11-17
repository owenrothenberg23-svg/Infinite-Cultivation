// app/api/next-chapter/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Pick up the model from env; default to a sane “latest” that many orgs have.
// IMPORTANT: This must match a model your org actually has enabled in the Console.
const MODEL =
  process.env.ANTHROPIC_MODEL ||
  "claude-sonnet-4-20250514"; // change if your org uses a different id

// helpers
const S = (v: unknown, d = ""): string =>
  typeof v === "string" && v.length ? v : d;
const T = (b: unknown): boolean => !!b && b !== "false" && b !== "0";

// small row types for TS
type ChapterExcerpt = { chapter_number: number; content: string | null };
type MemorySnippet = { kind: string | null; content: string | null };
type Prefs = Record<string, unknown>;

// Anthropic text extractor
function atext(msg: Anthropic.Messages.Message): string {
  const chunk = msg.content?.find((c) => c.type === "text") as
    | { type: "text"; text: string }
    | undefined;
  return chunk?.text ?? "";
}

// NEW — tiny seeded PRNG so variance is deterministic per story/chapter
function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function rng(seed: number) {
  let x = seed >>> 0;
  return () => {
    // xorshift32
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5; x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}
function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)]!;
}

// Preflight: verify the model is available for this org/key once per request.
async function ensureModelAvailable() {
  try {
    await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1,
      messages: [{ role: "user", content: [{ type: "text", text: "ping" }] }],
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : String(e);
    // Common Anthropic not-found / unauthorized structures:
    const code = e?.status ?? e?.response?.status;
    const body = await (async () => {
      try {
        const t = await e?.response?.text?.();
        return t || "";
      } catch {
        return "";
      }
    })();

    // Normalize an actionable error
    const hint = [
      `Anthropic model not available for API.`,
      `Set ANTHROPIC_MODEL to an enabled model id (e.g., "claude-sonnet-4-20250514" or "claude-3-5-sonnet-latest").`,
      `Then enable that family for API in Anthropic Console → Settings → API keys → Model access.`,
      `Current ANTHROPIC_MODEL="${MODEL}".`,
    ].join(" ");

    throw new Error(
      `${hint} Upstream: status=${code ?? "?"} message="${msg}" body="${body}"`
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServer();

    // ---------- 0) storyId from JSON / form / query ----------
    const ctype = (req.headers.get("content-type") || "").toLowerCase();
    let storyId = "";

    if (ctype.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
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

    // 🔎 Check the Anthropic model is reachable before doing any heavy work
    try {
      await ensureModelAvailable();
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || "Anthropic model not available" },
        { status: 400 }
      );
    }

    // ---------- 1) Load story + prefs ----------
    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .select(
        "id, title, last_chapter_number, prefs_json, book_summary, current_arc_summary, world_bible"
      )
      .eq("id", storyId)
      .single();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const nextNum = (story.last_chapter_number ?? 0) + 1;
    const prefs = (story.prefs_json as Prefs) || {};

    // ---------- 1b) Variance knobs (safe defaults) // NEW ----------
    const varianceLevel = S(prefs["variance_level"], "medium"); // low | medium | high
    const twistIntensity = S(prefs["twist_intensity"], "light"); // none | light | bold
    const povVariance = T(prefs["pov_variance"]); // allow occasional antagonist/ally POV slice
    const targetWords = Number(prefs["chapter_words"] ?? 1700); // guidance, not hard limit

    // Deterministic variance seed // NEW
    const seed = hash32(`${storyId}#${nextNum}`);
    const rnd = rng(seed);
    const pickedMotif = pick(rnd, [
      "echoes & oaths",
      "masks & hidden blades",
      "debt & balance",
      "stars & fate-threads",
      "flame vs frost",
      "iron law vs living Dao",
    ]);
    const pickedSense = pick(rnd, [
      "scent (metal, resin, rain, blood, incense)",
      "sound (distant bells, cicadas, chanting, wind chimes)",
      "texture (rough stone, lacquer wood, silk thread)",
      "light (lantern-glow, moon-sheen, jade refraction)",
    ]);
    const povPlan = povVariance ? pick(rnd, ["antagonist", "ally", "witness"]) : "mc";

    // ---------- 2) Recent chapters (continuity) ----------
    const { data: recentChapters } = await supabase
      .from("chapters")
      .select("chapter_number, content")
      .eq("story_id", storyId)
      .order("chapter_number", { ascending: false })
      .limit(4);

    const continuity =
      (recentChapters as ChapterExcerpt[] | null)?.length
        ? [...(recentChapters as ChapterExcerpt[])]
            .sort((a, b) => a.chapter_number - b.chapter_number)
            .map(
              (ch) =>
                `CHAPTER ${ch.chapter_number} (excerpt):\n${S(
                  ch.content
                ).slice(0, 2400)}`
            )
            .join("\n\n")
        : "(no previous chapters yet)";

    // ---------- 3) Durable memory ----------
    const { data: memoryBundle } = await supabase
      .from("memories")
      .select("kind, content, chapter_number")
      .eq("story_id", storyId)
      .order("chapter_number", { ascending: false })
      .limit(150);

    const memoryText =
      (memoryBundle as MemorySnippet[] | null)?.length
        ? (memoryBundle as MemorySnippet[])
            .map((m) => `• [${S(m.kind)}] ${S(m.content)}`)
            .join("\n")
        : "(no memory yet)";

    // ---------- 4) Map prefs to explicit rules ----------
    const tone = S(prefs.tone, "epic");
    const toneStyle: string =
      {
        epic: "Epic, mythic narration. Sweeping emotional arcs.",
        ruthless: "Brutal, efficient prose. The world is cruel. Strength rules.",
        arrogant: "Cocky humor, dramatic flair, stylish insults.",
        enlightened: "Poetic descriptions, calm pacing, deep internal insight.",
        schemer: "Strategic internal monologues, political tension, quiet domination.",
      }[tone] ?? "Epic, mythic narration. Sweeping emotional arcs.";

    const worldType = S(prefs.world_type, "xianxia_high");
    const worldRules: string =
      {
        wuxia_low:
          "Low fantasy: subtle internal energy; no planet-busting.",
        xianxia_high:
          "High cultivation: realms, sects, tribulations, artifacts, spirit beasts.",
        xuanhuan:
          "Hybrid Eastern cultivation with Western fantasy; mixed systems allowed.",
        modern_urban:
          "Contemporary Earth with hidden cultivation; concealment matters.",
        sci_fantasy:
          "Cultivation + sci-tech; cosmic scale permitted.",
      }[worldType] ?? "High cultivation fantasy.";

    const mc = S(prefs.mc_personality, "steadfast");
    const mcVoice: string =
      {
        ruthless: "MC is decisive and unforgiving toward enemies.",
        steadfast: "MC is principled, enduring hardship with resolve.",
        playful: "MC uses humor and swagger in tense moments.",
        cunning: "MC schemes from the shadows; plans and manipulates.",
        compassionate: "MC protects allies and shows empathy amid conflict.",
      }[mc] ?? "MC is steady and focused.";

    const op = S(prefs.op_level, "balanced");
    const opRules: string =
      {
        struggle: "No deus-ex-machina. Success requires bargains or sacrifices.",
        balanced: "Wins feel earned; setbacks still occur. Growth believable.",
        overpowered: "MC is strong; challenge with clever foes, politics, constraints.",
      }[op] ?? "Balanced growth.";

    const romance = S(prefs.romance_level, "subplot");
    const romanceRules: string =
      {
        none: "Keep romance out of frame.",
        slow_burn: "Subtle tension; gradual progress with earned milestones.",
        subplot: "Romance appears periodically; do not overtake main plot.",
        harem_light: "Multiple interests exist; keep tasteful and coherent.",
      }[romance] ?? "Romance as an occasional subplot.";

    const violence = S(prefs.violence_level, "balanced");
    const violenceRules: string =
      {
        low: "Limit gore. Focus on technique and strategy.",
        balanced: "Violence serves stakes; do not dwell on gore.",
        savage: "Visceral fights; brutality allowed but purposeful.",
      }[violence] ?? "Balanced combat tone.";

    const prog = S(prefs.power_progression, "steady");
    const progRules: string =
      {
        slow: "Breakthroughs are rare and costly.",
        steady: "Regular but earned breakthroughs gated by trials.",
        fast: "Frequent breakthroughs; escalate external obstacles.",
      }[prog] ?? "Steady progression.";

    const flags = (prefs.flags as Record<string, unknown>) || {};
    const wantsSystem = T(flags["system_cheats"]);

    const flagLines = [
      wantsSystem
        ? "HARD REQUIREMENT: Include at least ONE in-world [SYSTEM] panel or prompt in the first two chapters, and whenever relevant thereafter."
        : "",
      T(flags["transmigration"])
        ? "Transmigration/reincarnation backstory can inform motives or secrets."
        : "",
      T(flags["comedy"])
        ? "Allow witty banter and comedic reversals when appropriate."
        : "",
      T(flags["grimdark"])
        ? "Bleak undercurrents exist; victories can be pyrrhic."
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    // ---------- 5) Prompts
    const craftDepth = [
      "Depth rules:",
      "- Always include: (1) clear scene goal, (2) meaningful obstacle, (3) consequence that changes state.",
      "- Weave ONE B-plot beat (ally, rivalry, romance, or personal trial) connected to the A-plot.",
      "- Show antagonist activity off-screen or directly (a choice, order, scheme) that pressures the MC.",
      `- Establish a recurring motif this chapter (“${pickedMotif}”) in at least two subtle callbacks.`,
      `- Ground at least two moments with concrete sensory detail (focus today: ${pickedSense}).`,
      "- Plant 1 Chekhov seed (object, vow, clue) that can pay off within 3–5 chapters.",
      "- Give the MC an explicit choice with tradeoffs; end the chapter on the chosen path or the cost of not choosing.",
    ].join("\n");

    const sysHeader = [
      "You are a professional Xianxia webnovel author.",
      `TONE: ${toneStyle}`,
      `WORLD: ${worldRules}`,
      `MC: ${mcVoice}`,
      `OP LEVEL: ${opRules}`,
      `ROMANCE: ${romanceRules}`,
      `VIOLENCE: ${violenceRules}`,
      `PROGRESSION: ${progRules}`,
      craftDepth, // NEW
      flagLines ? `FLAGS:\n${flagLines}` : "",
      "",
      "Absolute rules:",
      "- Maintain strict continuity with memory and recent chapters.",
      "- Keep names, sects, ranks, items, and power rules consistent. Do NOT retcon.",
      "- End the chapter with a clear hook for the next one.",
      wantsSystem
        ? "- The chapter MUST visibly include an in-world [SYSTEM] element (panel, prompt, or notification) that advances the plot or MC choices."
        : "",
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
      `Book summary: ${S(story.book_summary, "(none)")}`,
      `Current arc summary: ${S(story.current_arc_summary, "(none)")}`,
      `World bible: ${S(story.world_bible, "(none)")}`,
      "",
      "Continuity Memory (most recent first):",
      memoryText,
      "",
      "Recent continuity (latest first):",
      continuity,
      "",
      `Variance seed: ${seed} | POV plan: ${povPlan} | Variance level: ${varianceLevel} | Twist: ${twistIntensity}`, // NEW
    ].join("\n");

    // ---------- Pass 0 — Outline (strict JSON)
    const outlineMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2400, // slight bump
      temperature: varianceLevel === "high" ? 0.9 : varianceLevel === "low" ? 0.4 : 0.7, // NEW
      system:
        sysHeader +
        "\n\nYou will FIRST produce a compact outline for the next chapter.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                sharedContext +
                "\n\nProduce STRICT JSON with keys exactly:\n" +
                `{
  "scene_goal": "...",
  "conflict": "...",
  "antagonist_beat": "...",
  "b_plot": "...",
  "beats": ["..."],
  "pov": "${povPlan}",
  "setting_texture": ["..."], 
  "motif": "${pickedMotif}",
  "foreshadow": "...",
  "choice_with_cost": "...",
  "style_primer": ["..."],
  ` +
                (wantsSystem
                  ? `"system_hook": "..."}`
                  : `"system_hook": "(none or keep consistent)"}`
                ) +
                "\nReturn ONLY JSON. No prose.",
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

    // ---------- Pass 0.5 — Micro twist planner (cheap; optional) // NEW
    let twist: string | null = null;
    if (twistIntensity !== "none") {
      const twistMsg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 400,
        temperature: twistIntensity === "bold" ? 0.9 : 0.6,
        system:
          "You are a tight plot designer. Propose ONE small twist that escalates stakes without breaking continuity. 1–3 sentences. Return ONLY text.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "Given this outline and memory, propose a twist:",
                  JSON.stringify(outline, null, 2),
                  "",
                  "MEMORY:",
                  memoryText,
                ].join("\n"),
              },
            ],
          },
        ],
      });
      twist = atext(twistMsg).trim() || null;
    }

    // ---------- Pass 1 — Draft
    const draftMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000,
      temperature: varianceLevel === "high" ? 0.95 : varianceLevel === "low" ? 0.55 : 0.7, // NEW
      top_p: varianceLevel === "high" ? 0.95 : 0.9, // NEW (Anthropic supports top_p)
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
                twist ? `\nTwist to incorporate (keep plausible & earned): ${twist}\n` : "",
                "",
                `Task: Write Chapter ${nextNum}.`,
                `- Aim for ~${Math.max(1100, Math.min(2600, targetWords))} words; readable on web (short paragraphs, clear beats).`,
                "- Open with a situational anchor (where/when/who).",
                "- Keep internal monologue purposeful and not repetitive.",
                "- Include the antagonist beat (direct or off-screen pressure).",
                "- Weave the B-plot for depth (ally, rivalry, romance, or inner trial).",
                "- Pay the motif in at least two callbacks; include one concrete sensory detail per major beat.",
                "- End on a natural hook tied to the chapter conflict or the unresolved cost of the choice.",
              ].join("\n"),
            },
          ],
        },
      ],
    });

    let content = atext(draftMsg).trim();

    // ---------- Pass 2 — Continuity auditor/fixer
    const fixMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000,
      temperature: 0.2,
      system:
        "You are a ruthless continuity auditor and fixer. If the draft violates constraints, return a corrected chapter only (no commentary).",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Constraints to enforce:",
                "- Must respect continuity memory and recent chapter excerpts.",
                wantsSystem
                  ? "- Must contain at least one explicit, in-world [SYSTEM] element that impacts scene logic (panel, prompt, notification)."
                  : "- If any [SYSTEM] elements appear, they must be internally consistent.",
                "- Keep names/items/sects/ranks/rules consistent with provided memory.",
                "- Keep tone and style per settings.",
                "- Remove contradictions and dangling details.",
                "- Ensure the chapter includes: antagonist pressure, one B-plot beat, motif callbacks, at least one explicit choice with tradeoff.",
                "",
                "DRAFT CHAPTER:",
                content,
                "",
                "MEMORY:",
                memoryText,
                "",
                "EXCERPTS:",
                continuity,
              ].join("\n"),
            },
          ],
        },
      ],
    });

    const fixed = atext(fixMsg).trim();
    if (fixed) content = fixed;

    // ---------- Pass 3 — Line-edit polish
    const polishMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000,
      temperature: 0.1,
      system:
        "You are a line editor. Return a stylistically polished version only. Improve flow, vary sentence length, cut filler, keep meaning. Preserve [SYSTEM] blocks verbatim except small grammar fixes.",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: content }],
        },
      ],
    });

    const polished = atext(polishMsg).trim();
    if (polished) content = polished;

    // ---------- 6) Save chapter ----------
    const { data: inserted, error: insertErr } = await supabase
      .from("chapters")
      .insert({
        story_id: storyId,
        chapter_number: nextNum,
        title: `Chapter ${nextNum}`,
        content,
      })
      .select("id, chapter_number")
      .single();

    if (insertErr || !inserted) {
      console.error("insertErr:", insertErr);
      return NextResponse.json(
        { error: insertErr?.message || "Insert failed" },
        { status: 500 }
      );
    }

    // ---------- 7) Bump last_chapter_number (non-fatal if fails) ----------
    const { error: bumpErr } = await supabase
      .from("stories")
      .update({ last_chapter_number: nextNum })
      .eq("id", storyId);
    if (bumpErr) console.error("updateErr:", bumpErr);

    // ---------- 8) Memory extraction (non-fatal)
    try {
      const memMsg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2000,
        temperature: 0,
        system:
          "Extract ONLY durable facts from the chapter. Return STRICT JSON with arrays: facts, characters, locations, items, threads, rules. Each entry <= 200 chars. Return ONLY JSON.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  storyTitle: story.title,
                  chapterNumber: nextNum,
                  chapterText: content,
                }),
              },
            ],
          },
        ],
      });

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(atext(memMsg) || "{}");
      } catch {
        parsed = {};
      }

      const rows: Array<{
        story_id: string;
        chapter_number: number;
        kind: string;
        content: string;
      }> = [];

      for (const [kind, arr] of Object.entries(parsed)) {
        if (Array.isArray(arr)) {
          for (const s of arr as unknown[]) {
            const val = S(s).trim();
            if (val)
              rows.push({
                story_id: storyId,
                chapter_number: nextNum,
                kind,
                content: val,
              });
          }
        }
      }

      if (rows.length) {
        await supabase.from("memories").insert(rows);
      }
    } catch (e) {
      console.warn("memory extraction failed (non-fatal):", e);
    }

    // ---------- 9) Bootstrap summaries on Chapter 1 ----------
    if (nextNum === 1) {
      try {
        const bibleMsg = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 2000,
          temperature: 0.2,
          system:
            "Summarize long-term book premise, current arc, and world rules in 3 short sections: book_summary, current_arc_summary, world_bible (concise). Return STRICT JSON only.",
          messages: [{ role: "user", content: [{ type: "text", text: content }] }],
        });

        const obj = JSON.parse(atext(bibleMsg) || "{}") as Record<
          string,
          unknown
        >;

        await supabase
          .from("stories")
          .update({
            book_summary: S(obj["book_summary"]),
            current_arc_summary: S(obj["current_arc_summary"]),
            world_bible: S(obj["world_bible"]),
          })
          .eq("id", storyId);
      } catch (e) {
        console.warn("bible bootstrap failed (non-fatal):", e);
      }
    }

    return NextResponse.json({ chapter: inserted }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("next-chapter fatal:", msg);
    return NextResponse.json({ error: msg || "Unknown error" }, { status: 500 });
  }
}
