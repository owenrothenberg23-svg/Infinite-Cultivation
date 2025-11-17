import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabase";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { storyId, prompt } = await req.json();

    // 1. Figure out what chapter number this should be
    const { data: existingChapters, error: chaptersErr } = await supabaseServer
      .from("chapters")
      .select("number")
      .eq("story_id", storyId)
      .order("number", { ascending: false })
      .limit(1);

    if (chaptersErr) {
      console.error("fetch chapters error:", chaptersErr);
      return NextResponse.json({ error: chaptersErr.message }, { status: 500 });
    }

    const nextChapterNumber =
      existingChapters && existingChapters.length > 0
        ? existingChapters[0].number + 1
        : 1;

    // 2. Ask OpenAI to write that chapter
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
            prompt ||
            `Write Chapter ${nextChapterNumber} of a cultivation story. The MC is in a dangerous sect, just awakened a forbidden/cursed bloodline, and is terrified someone will discover it. Include tension, politics, and a final cliffhanger.`,
        },
      ],
    });

    const chapterText = completion.choices[0].message?.content || "";

    // 3. Save this new chapter into Supabase
    const { data: inserted, error: insertErr } = await supabaseServer
      .from("chapters")
      .insert([
        {
          story_id: storyId,
          number: nextChapterNumber,
          title: `Chapter ${nextChapterNumber}`,
          text: chapterText,
          summary: "", // we'll add summaries later for memory
        },
      ])
      .select("*")
      .single();

    if (insertErr) {
      console.error("insert chapter error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 4. Return the saved chapter row
    return NextResponse.json({
      chapter: inserted,
    });
  } catch (err: any) {
    console.error("chapter route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
