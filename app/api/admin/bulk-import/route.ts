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

function cleanTags(raw: string | undefined) {
  if (!raw) return [];
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

      const baseSlug = slugify(title);
      if (!baseSlug) {
        skipped++;
        continue;
      }

      const { data: existing } = await admin
        .from("novels")
        .select("id")
        .eq("slug", baseSlug)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      prepared.push({
        title,
        slug: baseSlug,
        author_name: authorRaw || null,
        primary_genre: genreRaw || null,
        status: statusRaw || "unknown",
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
      return NextResponse.json({
        success: true,
        inserted: 0,
        skipped,
      });
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