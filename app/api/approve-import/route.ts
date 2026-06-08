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

function normalizeTag(tag: string) {
  const cleaned = tag.trim().toLowerCase().replace(/\s+/g, "_");

  const map: Record<string, string> = {
    cultivation_novel: "cultivation",
    cultivator: "cultivation",
    xianxia_novel: "xianxia",
    wuxia_novel: "wuxia",
    ruthless: "ruthless_mc",
    ruthless_protagonist: "ruthless_mc",
    villain_mc: "antihero",
    anti_hero: "antihero",
    overpowered: "op_mc",
    overpowered_mc: "op_mc",
    system_cheat: "system",
    game_system: "system",
    reincarnation: "transmigration",
    transmigrated: "transmigration",
    time_regression: "regression",
    kingdom: "kingdom_building",
    sect: "sect_politics",
    sect_building: "sect_politics",
  };

  return map[cleaned] || cleaned;
}

function normalizeGenre(raw: string) {
  const g = normalizeTag(raw || "");

  const map: Record<string, string> = {
    cultivation: "xianxia",
    chinese_fantasy: "xianxia",
    progression: "progression_fantasy",
    progression_fantasy: "progression_fantasy",
    fantasy: "fantasy",
    xianxia: "xianxia",
    wuxia: "wuxia",
    xuanhuan: "xuanhuan",
    urban_cultivation: "urban",
    urban: "urban",
    sci_fantasy: "sci_fantasy",
    scifi: "sci_fantasy",
    sci_fi: "sci_fantasy",
  };

  return map[g] || g || null;
}

function intOrNull(v: FormDataEntryValue | null) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cleanTags(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map(normalizeTag)
        .filter(Boolean)
    )
  ).slice(0, 30);
}

async function uniqueSlug(admin: ReturnType<typeof supabaseAdmin>, title: string) {
  const baseSlug = slugify(title);
  if (!baseSlug) return "";

  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const { data: existing } = await admin
      .from("novels")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!existing) return slug;

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
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

    const { data: existingTitle } = await admin
      .from("novels")
      .select("id, title")
      .ilike("title", title)
      .maybeSingle();

    if (existingTitle) {
      return NextResponse.json(
        { error: `Possible duplicate already exists: ${existingTitle.title}` },
        { status: 409 }
      );
    }

    const slug = await uniqueSlug(admin, title);
    if (!slug) {
      return NextResponse.json({ error: "Could not create slug" }, { status: 400 });
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
        primary_genre: normalizeGenre(f("primary_genre")),
        tags: cleanTags(f("tags")),
        status: normalizeTag(f("status") || "unknown"),
        translation_status: normalizeTag(f("translation_status") || "unknown"),
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