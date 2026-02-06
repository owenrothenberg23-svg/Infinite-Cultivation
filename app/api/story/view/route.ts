import { NextResponse, NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import crypto from "crypto";

export const runtime = "nodejs";

function S(v: unknown, d = ""): string {
  return typeof v === "string" && v.length ? v : d;
}

function getOrSetViewerId(req: NextRequest) {
  const existing = req.cookies.get("ic_viewer")?.value;
  if (existing) return { viewerId: existing, setCookie: null as null | string };

  const viewerId = crypto.randomUUID();
  // cookie string set in response
  const cookie = `ic_viewer=${viewerId}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  return { viewerId, setCookie: cookie };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const body = await req.json().catch(() => ({} as any));
    const storyId = S(body?.storyId);

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    const { viewerId, setCookie } = getOrSetViewerId(req);

    // Count once per day per viewer_key
    const viewerKey = `anon:${viewerId}`;

    const { error } = await supabase.from("story_views").insert({
      story_id: storyId,
      viewer_key: viewerKey,
      // viewed_on defaults to today
    });

    // If it violates unique constraint, it’s fine (already counted today)
    const res = NextResponse.json({ ok: true }, { status: 200 });

    if (setCookie) res.headers.set("Set-Cookie", setCookie);
    // ignore unique conflicts
    return res;
  } catch (e: any) {
    // Non-fatal: viewing should never break reading
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
