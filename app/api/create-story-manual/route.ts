import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

function toBool(v: FormDataEntryValue | null) {
  if (!v) return false;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServer();

    // Auth (cookie-based)
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = userData.user.id;

    const fd = await req.formData();

    const title = String(fd.get("title") || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const story_pitch = String(fd.get("story_pitch") || "").trim();
    const tone = String(fd.get("tone") || "").trim();
    const world_type = String(fd.get("world_type") || "").trim();
    const mc_personality = String(fd.get("mc_personality") || "").trim();
    const op_level = String(fd.get("op_level") || "").trim();
    const romance_level = String(fd.get("romance_level") || "").trim();
    const violence_level = String(fd.get("violence_level") || "").trim();
    const power_progression = String(fd.get("power_progression") || "").trim();

    const primary_genre = String(fd.get("primary_genre") || "").trim();

    // genres[] checkboxes
    const genres = fd.getAll("genres").map((x) => String(x));

    // tags_json
    let tags_json: any = [];
    try {
      tags_json = JSON.parse(String(fd.get("tags_json") || "[]"));
      if (!Array.isArray(tags_json)) tags_json = [];
    } catch {
      tags_json = [];
    }

    // optional flags
    const flag_system_cheats = toBool(fd.get("flag_system_cheats"));
    const flag_transmigration = toBool(fd.get("flag_transmigration"));
    const flag_comedy = toBool(fd.get("flag_comedy"));
    const flag_grimdark = toBool(fd.get("flag_grimdark"));

    // manual initial chapter content (optional)
    const initial_chapter_title = String(fd.get("initial_chapter_title") || "").trim();
    const initial_chapter_content = String(fd.get("initial_chapter_content") || "").trim();

    // 1) Insert story
    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .insert({
        title,
        story_pitch: story_pitch || null,
        tone: tone || null,
        world_type: world_type || null,
        mc_personality: mc_personality || null,
        op_level: op_level || null,
        romance_level: romance_level || null,
        violence_level: violence_level || null,
        power_progression: power_progression || null,
        primary_genre: primary_genre || null,
        genres: genres.length ? genres : null,
        tags_json,
        flag_system_cheats,
        flag_transmigration,
        flag_comedy,
        flag_grimdark,
        user_id: userId,
        last_chapter_number: 1,
      })
      .select("id")
      .single();

    if (storyErr || !story?.id) {
      console.error("create-story-manual: story insert error", storyErr);
      return NextResponse.json({ error: "Failed to create story" }, { status: 500 });
    }

    const storyId = story.id as string;

    // 2) Create chapter 1 as a draft (and optionally finalized if content exists)
    const chapterRow: any = {
      story_id: storyId,
      chapter_number: 1,
      title: initial_chapter_title || null,
      draft_content: initial_chapter_content || "",
      // keep compatibility if you still read `content` anywhere:
      content: initial_chapter_content || "",
      final_content: null,
    };

    const { error: chErr } = await supabase.from("chapters").insert(chapterRow);
    if (chErr) {
      console.error("create-story-manual: chapter insert error", chErr);
      return NextResponse.json({ error: "Story created but failed to create chapter 1" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, story: { id: storyId } }, { status: 200 });
  } catch (err: any) {
    console.error("create-story-manual fatal:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}