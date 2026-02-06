// app/api/create-story/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
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

export async function POST(req: Request) {
  try {
    // Admin client for DB writes
    const supabaseAdmin = getSupabaseServer();

    // -----------------------------
    // AUTH: Bearer OR Cookie session
    // -----------------------------
    let authedUserId: string | null = null;

    // 1) Try Bearer token first
    const token = getBearer(req);
    if (token) {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
      if (!userErr && userData?.user?.id) {
        authedUserId = userData.user.id;
      }
    }

    // 2) Fallback to cookie-based auth
    if (!authedUserId) {
      const cookieStore = await cookies();

      const sb = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                for (const c of cookiesToSet) {
                  cookieStore.set(c.name, c.value, c.options);
                }
              } catch {
                // no-op
              }
            },
          },
        }
      );

      const { data, error } = await sb.auth.getUser();
      if (!error && data?.user?.id) {
        authedUserId = data.user.id;
      }
    }

    if (!authedUserId) {
      // If this was a browser navigation, redirect to login instead of JSON
      if (wantsHtml(req)) {
        return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
      }
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    // -----------------------------
    // Parse payload
    // -----------------------------
    const ctypeRaw = req.headers.get("content-type") || "";
    const ctype = ctypeRaw.toLowerCase();

    let title = "";
    let prefs: any = {};
    let story_pitch = "";
    let genres: string[] = [];
    let primary_genre: string | null = null;
    let tags: string[] | null = null;

    if (ctype.includes("application/json")) {
      const body = await req.json().catch(() => ({} as any));

      title = String(body.title || "").trim();
      story_pitch = String(body.story_pitch || "").trim();

      if (Array.isArray(body.genres)) {
        genres = body.genres.map((g: any) => String(g));
      } else if (typeof body.genres === "string" && body.genres.length) {
        genres = [body.genres];
      }

      if (body.primary_genre) {
        const pg = String(body.primary_genre).trim();
        primary_genre = pg || null;
      }

      if (Array.isArray(body.tags)) {
        tags = body.tags
          .map((t: any) => String(t).trim())
          .filter((t: string) => t.length > 0 && t.length <= 40)
          .slice(0, 20);
      }

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
          if (Array.isArray(parsed)) {
            tags = parsed
              .map((t) => String(t).trim())
              .filter((t) => t.length > 0 && t.length <= 40)
              .slice(0, 20);
          }
        } catch (e) {
          console.warn("create-story: failed to parse tags_json", e);
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
      const url = new URL(req.url);
      const qTitle = url.searchParams.get("title");
      if (qTitle) title = qTitle.trim();
    }

    if (!title) {
      if (wantsHtml(req)) {
        return NextResponse.redirect(new URL("/new?err=missing_title", req.url), { status: 303 });
      }
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    // -----------------------------
    // Insert (admin)
    // -----------------------------
    const { data, error } = await supabaseAdmin
      .from("stories")
      .insert({
        title,
        prefs_json: prefs,
        story_pitch,
        user_id: authedUserId,
        genres,
        primary_genre,
        tags,
      })
      .select("id")
      .single();

    if (error || !data) {
      if (wantsHtml(req)) {
        return NextResponse.redirect(new URL("/new?err=insert_failed", req.url), { status: 303 });
      }
      return NextResponse.json(
        { error: error?.message || "Insert failed" },
        { status: 500 }
      );
    }

    // ✅ If browser navigation / form submit: redirect to the story page
    if (wantsHtml(req)) {
      return NextResponse.redirect(new URL(`/story/${data.id}`, req.url), { status: 303 });
    }

    // ✅ If fetch/XHR: JSON
    return NextResponse.json({ story: { id: data.id } }, { status: 200 });
  } catch (err: any) {
    console.error("create-story fatal:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
