// app/api/bookmark/route.ts
import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const sb = await supabaseServerClient(); // ✅ cookie-aware

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { storyId } = (await req.json().catch(() => ({}))) as { storyId?: string };
    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    // ✅ Upsert avoids duplicate issues cleanly (requires unique constraint on (user_id, story_id))
    const { error } = await sb
      .from("story_bookmarks")
      .upsert(
        { user_id: userData.user.id, story_id: storyId },
        { onConflict: "user_id,story_id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}