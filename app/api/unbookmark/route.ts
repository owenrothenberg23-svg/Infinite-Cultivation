import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const sb = getSupabaseServer();

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { storyId } = (await req.json().catch(() => ({}))) as { storyId?: string };
    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    const { error } = await sb.from("story_bookmarks").insert({
      user_id: userData.user.id,
      story_id: storyId,
    });

    // duplicate bookmark = fine
    if (error && !String(error.message || "").toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}