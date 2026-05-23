// app/api/comment-novel/route.ts
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

    const body = (await req.json().catch(() => ({}))) as {
      novelId?: string;
      content?: string;
    };

    const novelId = String(body.novelId || "").trim();
    const content = String(body.content || "").trim();

    if (!novelId) {
      return NextResponse.json({ error: "Missing novelId" }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
    }

    if (content.length > 4000) {
      return NextResponse.json({ error: "Comment too long" }, { status: 400 });
    }

    const { error } = await sb.from("novel_comments").insert({
      novel_id: novelId,
      user_id: userData.user.id,
      content,
    });

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