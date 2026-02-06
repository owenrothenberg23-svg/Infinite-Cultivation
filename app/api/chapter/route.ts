// app/api/chapter/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabase";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { storyId, prompt } = await req.json();

    // 0. Look up the story to find the author
    const { data: story, error: storyErr } = await supabaseServer
      .from("stories")
      .select("user_id")
      .eq("id", storyId)
      .maybeSingle();

    if (storyErr || !story) {
      console.error("chapter: story lookup error:", storyErr);
      return NextResponse.json(
        { error: "Could not find story for this chapter." },
        { status: 400 }
      );
    }

    const authorId = story.user_id as string;

    // 1. Figure out what chapter number this should be (for this story)
    const { data: existingChapters, error: chaptersErr } =
      await supabaseServer
        .from("chapters")
        .select("number")
        .eq("story_id", storyId)
        .order("number", { ascending: false })
        .limit(1);

    if (chaptersErr) {
      console.error("fetch chapters error:", chaptersErr);
      return NextResponse.json(
        { error: chaptersErr.message },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: insertErr.message },
        { status: 500 }
      );
    }

    // 4. After inserting, check if the author just hit 10 total chapters
    try {
      // 4a. Find all stories for this author
      const { data: authorStories, error: authorStoriesErr } =
        await supabaseServer
          .from("stories")
          .select("id")
          .eq("user_id", authorId);

      if (authorStoriesErr) {
        console.error(
          "chapter: author stories lookup error:",
          authorStoriesErr
        );
      } else if (authorStories && authorStories.length > 0) {
        const storyIds = authorStories.map((s) => s.id);

        // 4b. Count all chapters across those stories
        const { count: chapterCount, error: chapterCountErr } =
          await supabaseServer
            .from("chapters")
            .select("id", { count: "exact", head: true })
            .in("story_id", storyIds);

        if (chapterCountErr) {
          console.error(
            "chapter: chapter count error for wandering storyteller:",
            chapterCountErr
          );
        } else if (typeof chapterCount === "number" && chapterCount === 10) {
          // 4c. Unlock "Wandering Storyteller" when they reach exactly 10 chapters
          const { data: titleRow, error: titleErr } = await supabaseServer
            .from("titles")
            .select("id")
            .eq("label", "Wandering Storyteller")
            .maybeSingle();

          if (titleErr || !titleRow) {
            console.error(
              "chapter: wandering storyteller title lookup error:",
              titleErr
            );
          } else {
            const wanderingTitleId = titleRow.id;

            // Check if user already has it
            const { data: existingTitle, error: existingTitleErr } =
              await supabaseServer
                .from("user_titles")
                .select("id")
                .eq("user_id", authorId)
                .eq("title_id", wanderingTitleId)
                .maybeSingle();

            if (
              existingTitleErr &&
              existingTitleErr.code !== "PGRST116" // PGRST116 = no rows found
            ) {
              console.error(
                "chapter: existing wandering title check error:",
                existingTitleErr
              );
            } else if (!existingTitle) {
              const { error: insertTitleErr } = await supabaseServer
                .from("user_titles")
                .insert({
                  user_id: authorId,
                  title_id: wanderingTitleId,
                  is_active: false, // let them equip it on /titles
                });

              if (insertTitleErr) {
                console.error(
                  "chapter: wandering storyteller title insert error:",
                  insertTitleErr
                );
              }
            }
          }
        }
      }
    } catch (unlockErr) {
      console.error("chapter: wandering storyteller unlock fatal error:", unlockErr);
      // we don't block chapter creation on unlock failure
    }

    // 5. Return the saved chapter row
    return NextResponse.json({
      chapter: inserted,
    });
  } catch (err: any) {
    console.error("chapter route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
