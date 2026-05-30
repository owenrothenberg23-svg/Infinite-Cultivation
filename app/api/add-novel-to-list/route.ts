// app/api/add-novel-to-list/route.ts
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
      listId?: number | string;
    };

    const novelId = String(body.novelId || "").trim();
    const listId = Number(body.listId);

    if (!novelId || !Number.isFinite(listId)) {
      return NextResponse.json(
        { error: "Missing novelId or listId" },
        { status: 400 }
      );
    }

    const { error } = await sb.from("novel_list_items").insert({
      list_id: listId,
      novel_id: novelId,
    });

    const msg = String(error?.message || "").toLowerCase();

    if (error && !msg.includes("duplicate") && !msg.includes("unique")) {
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