// app/api/rate-novel/route.ts
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
      rating?: number;
    };

    const novelId = String(body.novelId || "").trim();
    const rating = Number(body.rating);

    if (!novelId) {
      return NextResponse.json({ error: "Missing novelId" }, { status: 400 });
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });
    }

    const { error } = await sb.from("novel_ratings").upsert(
      {
        novel_id: novelId,
        user_id: userData.user.id,
        rating: Math.round(rating),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "novel_id,user_id",
      }
    );

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