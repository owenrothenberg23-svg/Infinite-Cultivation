import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

function toBool(v: FormDataEntryValue | null) {
  if (!v) return false;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

function cleanTags(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw
    .map((t) => String(t).trim())
    .filter((t) => t.length > 0 && t.length <= 40)
    .slice(0, 20);
  return cleaned.length ? cleaned : null;
}

export async function POST(req: Request) {
  try {
    const sb = getSupabaseServer();

    // cookie auth
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = userData.user.id;

    const fd = await req.formData();
    const f = (k: string, d = "") => String(fd.get(k) ?? d).trim();

    const title = f("title");
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const story_pitch = f("story_pitch");

    const genres = fd.getAll("genres").map((x) => String(x));
    const primary_genre = f("primary_genre") || null;

    let tags_json: string[] | null = null;
    const tagsRaw = f("tags_json");
    if (tagsRaw) {
      try {
        tags_json = cleanTags(JSON.parse(tagsRaw));
      } catch {
        tags_json = null;
      }
    }

    const prefs_json = {
      tone: f("tone", "epic") || "epic",
      world_type: f("world_type", "xianxia_high") || "xianxia_high",
      mc_personality: f("mc_personality", "steadfast") || "steadfast",
      op_level: f("op_level", "balanced") || "balanced",
      romance_level: f("romance_level", "subplot") || "subplot",
      violence_level: f("violence_level", "balanced") || "balanced",
      power_progression: f("power_progression", "steady") || "steady",
      genres,
      flags: {
        system_cheats: toBool(fd.get("flag_system_cheats")),
        transmigration: toBool(fd.get("flag_transmigration")),
        comedy: toBool(fd.get("flag_comedy")),
        grimdark: toBool(fd.get("flag_grimdark")),
      },
    };

    const initial_chapter_title = f("initial_chapter_title");
    const initial_chapter_content = f("initial_chapter_content");

    // 1) Insert story (CONSISTENT SCHEMA)
    const { data: story, error: storyErr } = await sb
      .from("stories")
      .insert({
        user_id: userId,                    // ✅ ALWAYS SET
        title,
        story_pitch: story_pitch || null,
        prefs_json,
        genres: genres.length ? genres : null,
        primary_genre,
        tags_json,
        last_chapter_number: 1,             // because we create chapter 1 below
      })
      .select("id")
      .single();

    if (storyErr || !story?.id) {
      console.error("create-story-manual: story insert error", storyErr);
      return NextResponse.json({ error: storyErr?.message || "Failed to create story" }, { status: 500 });
    }

    const storyId = story.id as string;

    // 2) Create chapter 1 (draft)
    const chapterRow: any = {
      story_id: storyId,
      chapter_number: 1,
      title: initial_chapter_title || null,
      draft_content: initial_chapter_content || "",
      content: initial_chapter_content || "", // compatibility
      final_content: null,
    };

    const { error: chErr } = await sb.from("chapters").insert(chapterRow);
    if (chErr) {
      console.error("create-story-manual: chapter insert error", chErr);
      return NextResponse.json(
        { error: "Story created but failed to create chapter 1" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, story: { id: storyId } }, { status: 200 });
  } catch (err: any) {
    console.error("create-story-manual fatal:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}