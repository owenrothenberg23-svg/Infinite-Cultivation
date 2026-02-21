import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

export async function POST(req: Request) {
  try {
    const sb = getSupabaseServer();

    // ✅ COOKIE-BASED AUTH (NOT Bearer)
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      text,
      mode,
      instruction,
    }: {
      text?: string;
      mode?: string;
      instruction?: string;
    } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Missing text" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic API key missing" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    let systemPrompt = "";

    switch (mode) {
      case "grammar":
        systemPrompt =
          "You are a professional line editor. Fix grammar and typos only. Do NOT change tone or structure.";
        break;

      case "rewrite":
        systemPrompt =
          "Rewrite this chapter to improve flow and clarity while preserving meaning.";
        break;

      case "continue":
        systemPrompt =
          "Continue writing the chapter naturally from where it ends.";
        break;

      case "suggest":
        systemPrompt =
          "Provide actionable writing suggestions, do NOT rewrite the text.";
        break;

      default:
        systemPrompt =
          "You are a professional editor. Improve clarity and polish.";
    }

    if (instruction && instruction.trim()) {
      systemPrompt += `\nAdditional instruction: ${instruction}`;
    }

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text }],
        },
      ],
    });

    const blocks = Array.isArray(msg?.content) ? msg.content : [];
    const output = blocks
      .filter((b: any) => b?.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ result: output }, { status: 200 });
  } catch (err: any) {
    console.error("edit-assist error:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}