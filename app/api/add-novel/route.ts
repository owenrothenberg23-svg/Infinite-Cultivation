// app/api/add-novel/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function intOrNull(v: FormDataEntryValue | null) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(req: Request) {
  try {
    const ssr = await supabaseServerClient();
    const { data: userData } = await ssr.auth.getUser();
    const user = userData?.user;

    if (!user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Simple admin gate. Add this to .env.local:
    // ADMIN_EMAILS=your@email.com,another@email.com
    const admins = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!admins.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const fd = await req.formData();
    const f = (k: string) => String(fd.get(k) || "").trim();

    const title = f("title");
    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const tags = f("tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("novels")
      .insert({
        slug: slugify(title),
        title,
        author_name: f("author_name") || null,
        source_site: f("source_site") || null,
        source_url: f("source_url") || null,
        cover_image_url: f("cover_image_url") || null,
        synopsis: f("synopsis") || null,
        primary_genre: f("primary_genre") || null,
        tags,
        status: f("status") || "unknown",
        translation_status: f("translation_status") || "unknown",
        chapters_total: intOrNull(fd.get("chapters_total")),
        country: f("country") || null,
        year_started: intOrNull(fd.get("year_started")),
        year_completed: intOrNull(fd.get("year_completed")),
      })
      .select("slug")
      .single();

    if (error || !data?.slug) {
      return NextResponse.json(
        { error: error?.message || "Failed to add novel" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL(`/novel/${data.slug}`, req.url), {
      status: 303,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}