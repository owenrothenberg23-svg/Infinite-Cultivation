// app/api/create-list/route.ts
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

    const fd = await req.formData();

    const title = String(fd.get("title") || "").trim();
    const description = String(fd.get("description") || "").trim();
    const isPublic = fd.get("is_public") === "on";

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("novel_lists")
      .insert({
        user_id: userData.user.id,
        title,
        description: description || null,
        is_public: isPublic,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      return NextResponse.json(
        { error: error?.message || "Failed to create list" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL(`/list/${data.id}`, req.url), {
      status: 303,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}