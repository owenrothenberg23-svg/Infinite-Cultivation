// app/api/novel-unbookmark/route.ts
import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const sb = await supabaseServerClient();

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { novelId } = (await req.json().catch(() => ({}))) as {
      novelId?: string;
    };

    if (!novelId) {
      return NextResponse.json({ error: "Missing novelId" }, { status: 400 });
    }

    const { error } = await sb
      .from("novel_bookmarks")
      .delete()
      .eq("user_id", userData.user.id)
      .eq("novel_id", novelId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}