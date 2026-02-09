// app/api/chapter/route.ts
import { NextResponse, type NextRequest } from "next/server";
import OpenAI from "openai";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

function getBearer(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice("Bearer ".length).trim();
}

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey: key });
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const supabase = getSupabaseServer();

    // ✅ Require logged-in user (prevents randoms burning your OpenAI key)
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json({ error: "Please log in to continue" }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: "Please log in to continue" }, { status: 401 });
    }

    const userId = userData.user.id;

    const openai = getOpenAI(); // ✅ lazy init (safe)

    const { storyId, prompt } = await req.json().catch(() => ({} as any));
    if (!storyId || typeof storyId !== "string") {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    // 0) Load story + ownership
    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .select("id, user_id")
      .eq("id", storyId)
      .single();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Could not find story" }, { status: 404 });
    }

    if (story.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1) Next chapter number (match your newer schema)
    const { data: existingChapters, error: chaptersErr } = await supabase
      .from("chapters")
      .select("chapter_number")
      .eq("story_id", storyId)
      .order("chapter_number", { ascending: false })
      .limit(1);

    if (chaptersErr) {
      return NextResponse.json({ error: chaptersErr.message }, { status: 500 });
    }

    const nextChapterNumber =
      existingChapters && existingChapters.length > 0
        ? (existingChapters[0].chapter_number ?? 0) + 1
        : 1;

    // 2) Generate
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an advanced Xianxia/Wuxia web novel author. Write vivid, emotionally dramatic cultivation fiction with internal monologue, face-slapping, power progression, and a hook at the end of the chapter. Keep it readable like a webnovel.",
        },
        {
          role: "user",
          content:
            typeof prompt === "string" && prompt.trim().length
              ? prompt
              : `Write Chapter ${nextChapterNumber} of a cultivation story. The MC is in a dangerous sect, just awakened a forbidden/cursed bloodline, and is terrified someone will discover it. Include tension, politics, and a final cliffhanger.`,
        },
      ],
    });

    const chapterText = completion.choices[0].message?.content || "";

    // 3) Insert (match your newer schema)
    const { data: inserted, error: insertErr } = await supabase
      .from("chapters")
      .insert({
        story_id: storyId,
        chapter_number: nextChapterNumber,
        title: `Chapter ${nextChapterNumber}`,
        content: chapterText,
        draft_content: chapterText,
        is_final: false,
      })
      .select("*")
      .single();

    if (insertErr || !inserted) {
      return NextResponse.json({ error: insertErr?.message || "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ chapter: inserted }, { status: 200 });
  } catch (err: any) {
    console.error("chapter route error:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
