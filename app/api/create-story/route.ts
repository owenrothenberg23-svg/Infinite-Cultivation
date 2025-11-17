// app/api/create-story/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServer();

    const ctype = req.headers.get("content-type") || "";
    let title = "";
    let prefs: any = {};
    let story_pitch = "";

    if (ctype.includes("application/json")) {
      const body = await req.json().catch(() => ({} as any));
      title = String(body.title || "").trim();
      story_pitch = String(body.story_pitch || "").trim();

      prefs = {
        tone: body.tone || "epic",
        world_type: body.world_type || "xianxia_high",
        mc_personality: body.mc_personality || "steadfast",
        op_level: body.op_level || "balanced",
        romance_level: body.romance_level || "subplot",
        violence_level: body.violence_level || "balanced",
        power_progression: body.power_progression || "steady",
        flags: {
          system_cheats: !!body.flag_system_cheats,
          transmigration: !!body.flag_transmigration,
          comedy: !!body.flag_comedy,
          grimdark: !!body.flag_grimdark,
        },
      };
    } else {
      const fd = await req.formData();
      const f = (k: string, d = "") => String(fd.get(k) ?? d);

      title = f("title").trim();
      story_pitch = f("story_pitch").trim();

      prefs = {
        tone: f("tone", "epic"),
        world_type: f("world_type", "xianxia_high"),
        mc_personality: f("mc_personality", "steadfast"),
        op_level: f("op_level", "balanced"),
        romance_level: f("romance_level", "subplot"),
        violence_level: f("violence_level", "balanced"),
        power_progression: f("power_progression", "steady"),
        flags: {
          system_cheats: !!fd.get("flag_system_cheats"),
          transmigration: !!fd.get("flag_transmigration"),
          comedy: !!fd.get("flag_comedy"),
          grimdark: !!fd.get("flag_grimdark"),
        },
      };
    }

    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

    const { data, error } = await supabase
      .from("stories")
      .insert({
        title,
        prefs_json: prefs,
        story_pitch, // NEW
        user_id: user?.id ?? null,
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Insert failed" },
        { status: 500 }
      );
    }

    if (!ctype.includes("application/json")) {
      return NextResponse.redirect(new URL(`/read/${data.id}`, req.url));
    }

    return NextResponse.json({ story: { id: data.id } }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
