// app/api/edit-assist/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

async function badRequest(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  try {
    // Parse body safely
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      return badRequest("Invalid JSON body", 400);
    }

    // Cookie-based Supabase server client (must be cookie-based)
    const sb = getSupabaseServer();

    // Get user from cookies/session
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      // 401 if not authenticated
      return badRequest("Not authenticated. Please sign in and try again.", 401);
    }
    const user = userData.user;

    // Validate inputs
    const { text, mode, instruction } = body ?? {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return badRequest("Missing `text` in request body", 400);
    }

    // Check Anthropic API key on server
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfigured: Anthropic API key missing" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // Build system prompt by mode
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
          "Provide actionable writing suggestions. Do NOT rewrite the text.";
        break;
      default:
        systemPrompt = "You are a professional editor. Improve clarity and polish.";
    }

    if (instruction && typeof instruction === "string" && instruction.trim()) {
      systemPrompt += `\nAdditional instruction: ${instruction.trim()}`;
    }

    // Call the Anthropic SDK
    let msg;
    try {
      msg = await anthropic.messages.create({
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
    } catch (anthErr: any) {
      console.error("Anthropic error:", anthErr);
      const status =
        (anthErr?.statusCode && Number(anthErr.statusCode)) || 502;
      return NextResponse.json(
        { error: `AI provider error: ${anthErr?.message || "unknown"}` },
        { status }
      );
    }

    // Anthropic response content shape can vary; guard safely
    const blocks = Array.isArray(msg?.content) ? msg.content : [];
    const output = blocks
      .filter((b: any) => b?.type === "text" && typeof b?.text === "string")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ result: output ?? "" }, { status: 200 });
  } catch (err: any) {
    console.error("edit-assist error:", err);
    const message = err?.message || "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Explicitly return 405 for other methods (helps debug wrong-client-method)
export async function GET() {
  return NextResponse.json(
    { error: "Method GET not allowed — POST only" },
    { status: 405 }
  );
}