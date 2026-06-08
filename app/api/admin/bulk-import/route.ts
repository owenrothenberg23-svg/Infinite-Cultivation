import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

function isAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return !!email && admins.includes(email.toLowerCase());
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function intOrNull(value: string | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeTag(tag: string) {
  const cleaned = tag.trim().toLowerCase().replace(/\s+/g, "_");

  const map: Record<string, string> = {
    cultivation_novel: "cultivation",
    cultivator: "cultivation",
    cultivation_world: "cultivation",
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

function normalizeGenre(raw: string | undefined) {
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

function cleanTags(raw: string | undefined) {
  if (!raw) return [];
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
  const base = slugify(title);
  if (!base) return "";

  let slug = base;
  let suffix = 2;

  while (true) {
    const { data } = await admin
      .from("novels")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;

    slug = `${base}-${suffix}`;
    suffix++;
  }
}

export async function POST(req: Request) {
  try {
    const ssr = await supabaseServerClient();
    const { data: userData } = await ssr.auth.getUser();

    if (!isAdmin(userData?.user?.email)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { text } = (await req.json().catch(() => ({}))) as { text?: string };

    if (!text?.trim()) {
      return NextResponse.json({ error: "No text supplied" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const lines = text
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    const prepared: any[] = [];
    let skipped = 0;

    for (const line of lines) {
      const [
        titleRaw,
        authorRaw,
        genreRaw,
        statusRaw,
        chaptersRaw,
        tagsRaw,
        sourceUrlRaw,
        coverUrlRaw,
      ] = line.split("|").map((v) => v?.trim() || "");

      const title = titleRaw?.trim();
      if (!title) {
        skipped++;
        continue;
      }

      const slug = await uniqueSlug(admin, title);
      if (!slug) {
        skipped++;
        continue;
      }

      const { data: exactDuplicate } = await admin
        .from("novels")
        .select("id")
        .ilike("title", title)
        .maybeSingle();

      if (exactDuplicate) {
        skipped++;
        continue;
      }

      prepared.push({
        title,
        slug,
        author_name: authorRaw || null,
        primary_genre: normalizeGenre(genreRaw),
        status: normalizeTag(statusRaw || "unknown"),
        chapters_total: intOrNull(chaptersRaw),
        tags: cleanTags(tagsRaw),
        source_url: sourceUrlRaw || null,
        cover_image_url: coverUrlRaw || null,
        source_site: sourceUrlRaw
          ? (() => {
              try {
                return new URL(sourceUrlRaw).hostname.replace(/^www\./, "");
              } catch {
                return null;
              }
            })()
          : null,
      });
    }

    if (prepared.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, skipped });
    }

    const { error } = await admin.from("novels").insert(prepared);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      inserted: prepared.length,
      skipped,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}