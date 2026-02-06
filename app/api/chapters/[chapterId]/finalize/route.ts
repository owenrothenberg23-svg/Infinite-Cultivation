// app/api/chapters/[chapterId]/finalize/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey: key });
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

const S = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

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
  request: NextRequest,
  context: { params: Promise<{ chapterId: string }> }
): Promise<Response> {
  try {
    const supabase = getSupabaseServer();
    const anthropic = getAnthropic(); // ✅ lazy init

    const { chapterId } = await context.params;

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!token) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const finalContent =
      typeof (body as any)?.final_content === "string"
        ? (body as any).final_content.trim()
        : "";

    if (finalContent.length < 100) {
      return NextResponse.json(
        { error: "Final content is too short" },
        { status: 400 }
      );
    }

    const { data: chapter } = await supabase
      .from("chapters")
      .select("id, story_id, chapter_number, is_final")
      .eq("id", chapterId)
      .single();

    if (!chapter || chapter.is_final) {
      return NextResponse.json(
        { error: "Invalid or already finalized chapter" },
        { status: 400 }
      );
    }

    await supabase
      .from("chapters")
      .update({
        content: finalContent,
        draft_content: null,
        is_final: true,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", chapterId);

    // (leave the rest of your existing logic below as-is)
    return NextResponse.json(
      {
        ok: true,
        storyId: chapter.story_id,
        chapterNumber: chapter.chapter_number,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
