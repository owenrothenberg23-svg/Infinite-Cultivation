// app/api/admin/url-import/route.ts

import { NextResponse } from "next/server";
import { parseNovelMetadata } from "@/lib/novelImport";
import { fetchNovelSource } from "@/lib/novelImport/fetchSource";
import type { ImportedNovelMetadata } from "@/lib/novelImport/types";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

type ImportRawPayload = {
  imported_from_url: string;
  extracted_at: string;
  extraction_status: "success" | "failed";
  extraction_error?: string;
  extracted?: ImportedNovelMetadata;
  source_data_for_novel_sources: {
    source_site: string | null;
    source_url: string;
    external_title: string | null;
    external_author: string | null;
    external_rating: number | null;
    external_rating_count: number | null;
    external_review_count: number | null;
    external_cover_url: string | null;
    external_synopsis: string | null;
    external_genres: string[];
    external_tags: string[];
  };
};

function isAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(email && admins.includes(email.toLowerCase()));
}

function cleanUrl(raw: string) {
  try {
    const url = new URL(raw.trim());

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

function sourceSiteFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function titleFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;

    const finalSegment =
      pathname
        .split("/")
        .filter(Boolean)
        .pop() || "";

    if (!finalSegment) {
      return null;
    }

    return finalSegment
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
      .trim();
  } catch {
    return null;
  }
}

function buildSourcePayload(
  url: string,
  metadata: ImportedNovelMetadata
): ImportRawPayload["source_data_for_novel_sources"] {
  return {
    source_site: metadata.source_site,
    source_url: url,
    external_title: metadata.external_title,
    external_author: metadata.external_author,
    external_rating: metadata.external_rating,
    external_rating_count: metadata.external_rating_count,
    external_review_count: metadata.external_review_count,
    external_cover_url: metadata.external_cover_url,
    external_synopsis: metadata.external_synopsis,
    external_genres: metadata.external_genres,
    external_tags: metadata.external_tags,
  };
}

function buildFailedMetadata(
  url: string,
  errorMessage: string
): {
  meta: ImportedNovelMetadata;
  rawPayload: ImportRawPayload;
} {
  const sourceSite = sourceSiteFromUrl(url);
  const fallbackTitle = titleFromUrl(url);

  const meta: ImportedNovelMetadata = {
    source_url: url,
    source_site: sourceSite,

    suggested_title: fallbackTitle,
    suggested_author: null,
    suggested_synopsis: null,
    suggested_cover_url: null,
    suggested_source_site: sourceSite,
    suggested_primary_genre: null,
    suggested_tags: [],

    external_title: fallbackTitle,
    external_author: null,
    external_synopsis: null,
    external_cover_url: null,
    external_genres: [],
    external_tags: [],
    external_rating: null,
    external_rating_count: null,
    external_review_count: null,

    chapters_total: null,
    status: null,
    extraction_method: "url_fallback",
  };

  return {
    meta,
    rawPayload: {
      imported_from_url: url,
      extracted_at: new Date().toISOString(),
      extraction_status: "failed",
      extraction_error: errorMessage,
      source_data_for_novel_sources: buildSourcePayload(url, meta),
    },
  };
}

async function alreadyExists(
  admin: ReturnType<typeof supabaseAdmin>,
  url: string
) {
  const { data: existingNovel, error: novelError } = await admin
    .from("novels")
    .select("id")
    .eq("source_url", url)
    .maybeSingle();

  if (novelError) throw novelError;
  if (existingNovel) return true;

  const { data: existingSource, error: sourceError } = await admin
    .from("novel_sources")
    .select("id")
    .eq("source_url", url)
    .maybeSingle();

  if (sourceError) throw sourceError;
  if (existingSource) return true;

  const { data: existingQueue, error: queueError } = await admin
    .from("novel_import_queue")
    .select("id")
    .eq("source_url", url)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (queueError) throw queueError;

  return Boolean(existingQueue);
}

export async function POST(request: Request) {
  try {
    const ssr = await supabaseServerClient();

    const {
      data: userData,
      error: userError,
    } = await ssr.auth.getUser();

    if (userError) {
      return NextResponse.json(
        {
          error: `Authentication failed: ${userError.message}`,
        },
        {
          status: 401,
        }
      );
    }

    const user = userData?.user;

    if (!isAdmin(user?.email)) {
      return NextResponse.json(
        {
          error: "Not authorized",
        },
        {
          status: 403,
        }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      urls?: string;
    };

    const urls = Array.from(
      new Set(
        String(body.urls || "")
          .split("\n")
          .map(cleanUrl)
          .filter((value): value is string => Boolean(value))
      )
    );

    if (urls.length === 0) {
      return NextResponse.json(
        {
          error: "No valid URLs supplied",
        },
        {
          status: 400,
        }
      );
    }

    const admin = supabaseAdmin();

    let queued = 0;
    let skipped = 0;
    let failed = 0;

    const results: Array<{
      url: string;
      status: "queued" | "skipped" | "failed";
      extraction_status?: "success" | "failed";
      extraction_method?: string;
      error?: string;
    }> = [];

    for (const url of urls.slice(0, 100)) {
      try {
        if (await alreadyExists(admin, url)) {
          skipped += 1;

          results.push({
            url,
            status: "skipped",
          });

          continue;
        }

        let meta: ImportedNovelMetadata;
        let rawPayload: ImportRawPayload;

        try {
          const source = await fetchNovelSource(url);

          meta = parseNovelMetadata(
            source.html,
            url,
            {
              auxiliary: source.auxiliary,
            }
          );

          rawPayload = {
            imported_from_url: url,
            extracted_at: new Date().toISOString(),
            extraction_status: "success",
            extracted: meta,
            source_data_for_novel_sources: buildSourcePayload(
              url,
              meta
            ),
          };
        } catch (fetchError: unknown) {
          const message =
            fetchError instanceof Error
              ? fetchError.message
              : "Metadata fetch failed";

          const fallback = buildFailedMetadata(url, message);

          meta = fallback.meta;
          rawPayload = fallback.rawPayload;
        }

        const { error: insertError } = await admin
          .from("novel_import_queue")
          .insert({
            source_url: url,
            raw_title: meta.suggested_title,
            raw_payload: JSON.stringify(rawPayload, null, 2),

            suggested_title: meta.suggested_title,
            suggested_author: meta.suggested_author,
            suggested_synopsis: meta.suggested_synopsis,
            suggested_cover_url: meta.suggested_cover_url,
            suggested_source_site: meta.suggested_source_site,
            suggested_primary_genre:
              meta.suggested_primary_genre,
            suggested_tags: meta.suggested_tags,
            suggested_status: meta.status,
            suggested_chapters_total: meta.chapters_total,

            created_by: user!.id,
            status: "pending",
          });

        if (insertError) {
          throw insertError;
        }

        queued += 1;

        results.push({
          url,
          status: "queued",
          extraction_status: rawPayload.extraction_status,
          extraction_method: meta.extraction_method,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown import error";

        console.warn("URL import failed:", url, error);

        failed += 1;

        results.push({
          url,
          status: "failed",
          error: message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      queued,
      skipped,
      failed,
      results,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown route error";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}