// app/api/create-story/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

function getBearer(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice("Bearer ".length).trim();
}

function wantsHtml(req: Request) {
  const accept = (req.headers.get("accept") || "").toLowerCase();
  return accept.includes("text/html");
}

function cleanTags(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw
    .map((t) => String(t).trim())
    .filter((t) => t.length > 0 && t.length <= 40)
    .slice(0, 20);
  return cleaned.length ? cleaned : null;
}

export async function POST(req: Request) {
  try {
    const sb = getSupabaseServer();

    // -----------------------------
    // AUTH: Bearer OR Cookie session
    // -----------------------------
    let authedUserId: string | null = null;

    const token = getBearer(req);
    if (token) {
      const { data, error } = await sb.auth.getUser(token);
      if (!error && data?.user?.id) authedUserId = data.user.id;
    }

    if (!authedUserId) {
      const { data, error } = await sb.auth.getUser();
      if (!error && data?.user?.id) authedUserId = data.user.id;
    }

    if (!authedUserId) {
      if (wantsHtml(req)) {
        return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
      }
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    // -----------------------------
    // Parse payload (JSON or FormData)
    // -----------------------------
    const ctype = (req.headers.get("content-type") || "").toLowerCase();

    let title = "";
    let story_pitch = "";
    let genres: string[] = [];
    let primary_genre: string | null = null;
    let tags_json: string[] | null = null;

    let prefs: any = {};

    if (ctype.includes("application/json")) {
      const body = await req.json().catch(() => ({} as any));

      title = String(body.title || "").trim();
      story_pitch = String(body.story_pitch || "").trim();

      if (Array.isArray(body.genres)) {
        genres = body.genres.map((g: any) => String(g));
      } else if (typeof body.genres === "string" && body.genres.length) {
        genres = [body.genres];
      }

      const pg = String(body.primary_genre || "").trim();
      primary_genre = pg || null;

      tags_json = cleanTags(body.tags);

      prefs = {
        tone: body.tone || "epic",
        world_type: body.world_type || "xianxia_high",
        mc_personality: body.mc_personality || "steadfast",
        op_level: body.op_level || "balanced",
        romance_level: body.romance_level || "subplot",
        violence_level: body.violence_level || "balanced",
        power_progression: body.power_progression || "steady",
        genres,
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

      genres = fd.getAll("genres").map((g) => String(g));

      const pg = f("primary_genre", "").trim();
      primary_genre = pg || null;

      const tagsRaw = f("tags_json", "").trim();
      if (tagsRaw) {
        try {
          const parsed = JSON.parse(tagsRaw);
          tags_json = cleanTags(parsed);
        } catch {
          tags_json = null;
        }
      }

      prefs = {
        tone: f("tone", "epic"),
        world_type: f("world_type", "xianxia_high"),
        mc_personality: f("mc_personality", "steadfast"),
        op_level: f("op_level", "balanced"),
        romance_level: f("romance_level", "subplot"),
        violence_level: f("violence_level", "balanced"),
        power_progression: f("power_progression", "steady"),
        genres,
        flags: {
          system_cheats: !!fd.get("flag_system_cheats"),
          transmigration: !!fd.get("flag_transmigration"),
          comedy: !!fd.get("flag_comedy"),
          grimdark: !!fd.get("flag_grimdark"),
        },
      };
    }

    if (!title) {
      if (wantsHtml(req)) {
        return NextResponse.redirect(new URL("/new?err=missing_title", req.url), {
          status: 303,
        });
      }
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    // -----------------------------
    // Insert story (CONSISTENT SCHEMA)
    // -----------------------------
    const { data: story, error: insertErr } = await sb
      .from("stories")
      .insert({
        user_id: authedUserId,      // ✅ ALWAYS SET
        title,
        story_pitch: story_pitch || null,
        prefs_json: prefs,
        genres: genres.length ? genres : null,
        primary_genre,
        tags_json,                  // ✅ correct column name
      })
      .select("id")
      .single();

    if (insertErr || !story?.id) {
      console.error("create-story: insertErr", insertErr);
      if (wantsHtml(req)) {
        return NextResponse.redirect(new URL("/new?err=insert_failed", req.url), {
          status: 303,
        });
      }
      return NextResponse.json(
        { error: insertErr?.message || "Insert failed" },
        { status: 500 }
      );
    }

    if (wantsHtml(req)) {
      return NextResponse.redirect(new URL(`/story/${story.id}`, req.url), {
        status: 303,
      });
    }

    return NextResponse.json({ story: { id: story.id } }, { status: 200 });
  } catch (err: any) {
    console.error("create-story fatal:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}