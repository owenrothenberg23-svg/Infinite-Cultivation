import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

const S = (v: unknown, d = ""): string =>
  typeof v === "string" && v.length ? v : d;

function getBearer(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice("Bearer ".length).trim();
}

async function getAuthedUserId(req: Request, supabaseAdmin: ReturnType<typeof getSupabaseServer>) {
  // 1) Bearer
  const token = getBearer(req);
  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data?.user?.id) return data.user.id;
  }

  // 2) Cookie fallback
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
            for (const c of cookiesToSet) cookieStore.set(c.name, c.value, c.options);
          } catch {
            // no-op
          }
        },
      },
    }
  );

  const { data, error } = await sb.auth.getUser();
  if (!error && data?.user?.id) return data.user.id;

  return null;
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseServer();
    const body = (await req.json().catch(() => null)) as
      | { storyId?: string; chapterNumber?: number | string; title?: string }
      | null;

    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const storyId = S(body.storyId);
    const chapterNumber = Number(body.chapterNumber);
    const title = S(body.title).trim();

    if (!storyId || !Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return NextResponse.json({ error: "Missing or invalid storyId/chapterNumber" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    if (title.length > 80) {
      return NextResponse.json({ error: "Title too long (max 80 chars)" }, { status: 400 });
    }

    const userId = await getAuthedUserId(req, supabaseAdmin);
    if (!userId) return NextResponse.json({ error: "Please log in to continue" }, { status: 401 });

    // ownership
    const { data: story, error: storyErr } = await supabaseAdmin
      .from("stories")
      .select("id, user_id")
      .eq("id", storyId)
      .single();

    if (storyErr || !story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    if (story.user_id !== userId) {
      return NextResponse.json({ error: "You do not have permission to edit this story" }, { status: 403 });
    }

    // update title
    const { data: ch, error: chErr } = await supabaseAdmin
      .from("chapters")
      .update({ title })
      .eq("story_id", storyId)
      .eq("chapter_number", chapterNumber)
      .select("id, chapter_number, title")
      .maybeSingle();

    if (chErr || !ch) {
      return NextResponse.json({ error: chErr?.message || "Could not update title" }, { status: 500 });
    }

    return NextResponse.json({ chapter: ch }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
