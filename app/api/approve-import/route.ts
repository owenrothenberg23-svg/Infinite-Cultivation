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

function safeJsonParse(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

    const { data: importRow } = await admin
      .from("novel_import_queue")
      .select("*")
      .eq("id", importId)
      .maybeSingle();

    if (!importRow) {
      return NextResponse.json({ error: "Import row not found" }, { status: 404 });
    }

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

    const sourceUrl = f("source_url") || null;
    const sourceSite = f("source_site") || null;
    const coverUrl = f("cover_image_url") || null;
    const synopsis = f("synopsis") || null;
    const tags = cleanTags(f("tags"));

    const { data: novel, error: novelErr } = await admin
      .from("novels")
      .insert({
        slug,
        title,
        author_name: f("author_name") || null,
        source_site: sourceSite,
        source_url: sourceUrl,
        cover_image_url: coverUrl,
        synopsis,
        primary_genre: normalizeGenre(f("primary_genre")),
        tags,
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

    const rawPayloadParsed = safeJsonParse(importRow.raw_payload);
    const sourceData = rawPayloadParsed?.source_data_for_novel_sources || null;

    if (sourceUrl && sourceSite) {
      const { error: sourceErr } = await admin.from("novel_sources").upsert(
        {
          novel_id: novel.id,
          source_site: sourceData?.source_site || sourceSite,
          source_url: sourceData?.source_url || sourceUrl,

          external_title: sourceData?.external_title || title,
          external_author: sourceData?.external_author || f("author_name") || null,
          external_rating: sourceData?.external_rating ?? null,
          external_rating_count: sourceData?.external_rating_count ?? null,
          external_review_count: sourceData?.external_review_count ?? null,

          external_cover_url: sourceData?.external_cover_url || coverUrl,
          external_synopsis: sourceData?.external_synopsis || synopsis,
          external_genres: sourceData?.external_genres || [],
          external_tags: sourceData?.external_tags || tags,

          raw_payload: rawPayloadParsed,
          scraped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "source_url",
        }
      );

      if (sourceErr) {
        return NextResponse.json(
          { error: `Novel created, but source insert failed: ${sourceErr.message}` },
          { status: 500 }
        );
      }
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