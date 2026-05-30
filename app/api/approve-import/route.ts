// app/api/approve-import/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

function isAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return !!email && admins.includes(email.toLowerCase());
}

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

function cleanTags(raw: string) {
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean)
    .slice(0, 30);
}

export async function POST(req: Request) {
  try {
    const ssr = await supabaseServerClient();
    const { data: userData } = await ssr.auth.getUser();
    const user = userData?.user;

    if (!isAdmin(user?.email)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const fd = await req.formData();
    const action = String(fd.get("action") || "").trim();

    const importId = Number(fd.get("import_id"));
    if (!Number.isFinite(importId)) {
      return NextResponse.json({ error: "Missing import_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    if (action === "reject" || action === "duplicate") {
      const { error } = await admin
        .from("novel_import_queue")
        .update({
          status: action === "duplicate" ? "duplicate" : "rejected",
          approved_by: user!.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", importId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.redirect(new URL("/admin/imports", req.url), {
        status: 303,
      });
    }

    if (action !== "approve") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const f = (k: string) => String(fd.get(k) || "").trim();

    const title = f("title");
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const baseSlug = slugify(title);
    let slug = baseSlug;
    let suffix = 2;

    while (true) {
      const { data: existing } = await admin
        .from("novels")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (!existing) break;

      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const { data: novel, error: novelErr } = await admin
      .from("novels")
      .insert({
        slug,
        title,
        author_name: f("author_name") || null,
        source_site: f("source_site") || null,
        source_url: f("source_url") || null,
        cover_image_url: f("cover_image_url") || null,
        synopsis: f("synopsis") || null,
        primary_genre: f("primary_genre") || null,
        tags: cleanTags(f("tags")),
        status: f("status") || "unknown",
        translation_status: f("translation_status") || "unknown",
        chapters_total: intOrNull(fd.get("chapters_total")),
        country: f("country") || null,
      })
      .select("id, slug")
      .single();

    if (novelErr || !novel?.slug) {
      return NextResponse.json(
        { error: novelErr?.message || "Failed to create novel" },
        { status: 500 }
      );
    }

    const { error: updateErr } = await admin
      .from("novel_import_queue")
      .update({
        status: "approved",
        approved_by: user!.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.redirect(new URL(`/novel/${novel.slug}`, req.url), {
      status: 303,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}