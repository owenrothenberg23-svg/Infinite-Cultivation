import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice("Bearer ".length).trim() : "";
}
function S(v: unknown, d = ""): string {
  return typeof v === "string" && v.length ? v : d;
}

export async function POST(req: Request) {
  try {
    const sb = getSupabaseServer();
    const token = getBearer(req);
    if (!token) return NextResponse.json({ error: "Please log in to continue" }, { status: 401 });

    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: "Please log in to continue" }, { status: 401 });
    }

    const userId = userData.user.id;
    const body = await req.json().catch(() => ({} as any));
    const storyId = S(body?.storyId);
    const content = S(body?.content).trim();

    if (!storyId || !content) {
      return NextResponse.json({ error: "Missing storyId/content" }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: "Comment too long (max 2000 chars)" }, { status: 400 });
    }

    const { error } = await sb.from("story_comments").insert({
      story_id: storyId,
      user_id: userId,
      content,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
