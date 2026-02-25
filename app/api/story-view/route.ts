import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const sb = getSupabaseServer();

    const { storyId, viewerKey } = (await req.json().catch(() => ({}))) as {
      storyId?: string;
      viewerKey?: string;
    };

    if (!storyId || !viewerKey) {
      return NextResponse.json(
        { error: "Missing storyId or viewerKey" },
        { status: 400 }
      );
    }

    const viewedOn = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Insert unique view row (dedupe handled by unique constraint)
    const { error: insErr } = await sb.from("story_views").insert({
      story_id: storyId,
      viewer_key: viewerKey,
      viewed_on: viewedOn,
    });

    // If duplicate, ignore
    if (insErr && !String(insErr.message || "").toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    // Best-effort bump counter (do NOT throw if this fails)
    const { error: bumpErr } = await sb.rpc("increment_story_view_count", {
      p_story_id: storyId,
      p_amount: 1,
    });

    if (bumpErr) {
      console.warn("increment_story_view_count failed", bumpErr);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}