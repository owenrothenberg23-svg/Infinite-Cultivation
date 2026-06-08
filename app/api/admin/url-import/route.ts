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

function cleanUrl(raw: string) {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function sourceSiteFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, `"`)
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function getMeta(html: string, key: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }

  return null;
}

function getTitle(html: string) {
  const og = getMeta(html, "og:title") || getMeta(html, "twitter:title");
  if (og) return og.split("|")[0].split(" - ")[0].trim();

  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (match?.[1]) return decodeHtml(match[1]).split("|")[0].split(" - ")[0].trim();

  return null;
}

function extractMetadata(html: string, url: string) {
  const title = getTitle(html);

  const synopsis =
    getMeta(html, "og:description") ||
    getMeta(html, "twitter:description") ||
    getMeta(html, "description");

  const cover =
    getMeta(html, "og:image") ||
    getMeta(html, "twitter:image") ||
    getMeta(html, "twitter:image:src");

  const author =
    getMeta(html, "author") ||
    html.match(/author[^<]{0,40}<\/?[^>]*>\s*([^<]{2,80})/i)?.[1]?.trim() ||
    null;

  const keywords = getMeta(html, "keywords");
  const tags =
    keywords
      ?.split(",")
      .map((t) => t.trim().toLowerCase().replace(/\s+/g, "_"))
      .filter(Boolean)
      .slice(0, 20) || null;

  return {
    source_url: url,
    suggested_title: title,
    suggested_author: author,
    suggested_synopsis: synopsis,
    suggested_cover_url: cover,
    suggested_source_site: sourceSiteFromUrl(url),
    suggested_tags: tags,
  };
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; InfiniteCultivationBot/1.0; metadata import)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
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

    const body = (await req.json().catch(() => ({}))) as { urls?: string };
    const rawUrls = String(body.urls || "")
      .split("\n")
      .map((u) => cleanUrl(u))
      .filter(Boolean) as string[];

    const uniqueUrls = Array.from(new Set(rawUrls));

    if (uniqueUrls.length === 0) {
      return NextResponse.json({ error: "No valid URLs supplied" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    let queued = 0;
    let skipped = 0;
    let failed = 0;

    for (const url of uniqueUrls.slice(0, 100)) {
      try {
        const { data: existingNovel } = await admin
          .from("novels")
          .select("id")
          .eq("source_url", url)
          .maybeSingle();

        if (existingNovel) {
          skipped++;
          continue;
        }

        const { data: existingQueue } = await admin
          .from("novel_import_queue")
          .select("id")
          .eq("source_url", url)
          .in("status", ["pending", "approved"])
          .maybeSingle();

        if (existingQueue) {
          skipped++;
          continue;
        }

        const html = await fetchHtml(url);
        const meta = extractMetadata(html, url);

        const { error } = await admin.from("novel_import_queue").insert({
          source_url: url,
          raw_title: meta.suggested_title,
          raw_payload: JSON.stringify(
            {
              imported_from_url: url,
              extracted_at: new Date().toISOString(),
              extracted: meta,
            },
            null,
            2
          ),
          suggested_title: meta.suggested_title,
          suggested_author: meta.suggested_author,
          suggested_synopsis: meta.suggested_synopsis,
          suggested_cover_url: meta.suggested_cover_url,
          suggested_source_site: meta.suggested_source_site,
          suggested_tags: meta.suggested_tags,
          created_by: user!.id,
          status: "pending",
        });

        if (error) throw error;

        queued++;
      } catch (e) {
        console.warn("URL import failed:", url, e);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      queued,
      skipped,
      failed,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}