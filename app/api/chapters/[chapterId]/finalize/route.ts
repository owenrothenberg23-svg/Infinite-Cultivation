// app/api/chapters/[chapterId]/finalize/route.ts
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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
  req: NextRequest,
  context: { params: Promise<{ chapterId: string }> }
) {
  try {
    const supabase = getSupabaseServer();
    const { chapterId } = await context.params;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!token) {
      return new Response(JSON.stringify({ error: "Not logged in" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Not logged in" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({} as any));
    const finalContent =
      typeof body?.final_content === "string" ? body.final_content.trim() : "";

    if (!finalContent || finalContent.length < 100) {
      return new Response(
        JSON.stringify({ error: "Final content is too short." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ... (rest of your logic stays EXACTLY the same)

    return new Response(
      JSON.stringify({ ok: true, storyId: chapterId }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
