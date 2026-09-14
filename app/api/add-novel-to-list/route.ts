// app/api/add-novel-to-list/route.ts
import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const sb = await supabaseServerClient();

    const { data: userData, error: userErr } = await sb.auth.getUser();
    const user = userData?.user ?? null;

    if (userErr || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      novelId?: string;
      listId?: number | string;
    };

    const novelId = String(body.novelId || "").trim();
    const listId = Number(body.listId);

    if (!novelId || !Number.isInteger(listId) || listId <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid novelId/listId" },
        { status: 400 }
      );
    }

    // Never trust a client-supplied list ID by itself.
    const { data: list, error: listErr } = await sb
      .from("novel_lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (listErr) {
      console.error("add-novel-to-list list lookup error:", listErr);
      return NextResponse.json(
        { error: "Could not verify list ownership" },
        { status: 500 }
      );
    }

    if (!list) {
      return NextResponse.json(
        { error: "List not found or not owned by you" },
        { status: 403 }
      );
    }

    const { data: novel, error: novelErr } = await sb
      .from("novels")
      .select("id")
      .eq("id", novelId)
      .maybeSingle();

    if (novelErr) {
      console.error("add-novel-to-list novel lookup error:", novelErr);
      return NextResponse.json(
        { error: "Could not verify novel" },
        { status: 500 }
      );
    }

    if (!novel) {
      return NextResponse.json(
        { error: "Novel not found" },
        { status: 404 }
      );
    }

    const { error } = await sb.from("novel_list_items").insert({
      list_id: listId,
      novel_id: novelId,
    });

    const message = String(error?.message || "").toLowerCase();

    if (
      error &&
      !message.includes("duplicate") &&
      !message.includes("unique")
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}