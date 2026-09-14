// app/api/admin/catalog-discovery/route.ts

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

const MAX_DISCOVERED_URLS = 25_000;
const MAX_SITEMAP_FILES = 100;
const INSERT_BATCH_SIZE = 500;
const FETCH_TIMEOUT_MS = 20_000;

type DiscoveryBody = {
  name?: string;
  sitemap_url?: string;
  include_pattern?: string;
  exclude_pattern?: string;
};

type SitemapFetchResult = {
  pageUrls: string[];
  nestedSitemaps: string[];
};

function isAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
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
    return new URL(url).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, `"`)
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function extractLocValues(xml: string) {
  return Array.from(
    xml.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi)
  )
    .map((match) => decodeXml(match[1] || ""))
    .map(cleanUrl)
    .filter((url): url is string => Boolean(url));
}

function isSitemapIndex(xml: string) {
  return /<sitemapindex[\s>]/i.test(xml);
}

function splitIntoBatches<T>(items: T[], size: number) {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

function matchesPattern(value: string, pattern: string) {
  if (!pattern.trim()) return true;

  try {
    return new RegExp(pattern, "i").test(value);
  } catch {
    return value.toLowerCase().includes(pattern.toLowerCase());
  }
}

function shouldIncludeUrl(
  url: string,
  includePattern: string,
  excludePattern: string
) {
  if (!matchesPattern(url, includePattern)) {
    return false;
  }

  if (
    excludePattern.trim() &&
    matchesPattern(url, excludePattern)
  ) {
    return false;
  }

  return true;
}

async function fetchSitemap(url: string): Promise<SitemapFetchResult> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent":
          "InfiniteCultivationMetadataIndexer/1.0",
        Accept:
          "application/xml,text/xml,text/plain;q=0.9,*/*;q=0.5",
      },
    });

    if (!response.ok) {
      throw new Error(`Sitemap returned HTTP ${response.status}`);
    }

    const xml = await response.text();
    const locations = extractLocValues(xml);

    if (isSitemapIndex(xml)) {
      return {
        pageUrls: [],
        nestedSitemaps: locations,
      };
    }

    return {
      pageUrls: locations,
      nestedSitemaps: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverFromSitemap(
  rootSitemapUrl: string,
  includePattern: string,
  excludePattern: string
) {
  const pendingSitemaps = [rootSitemapUrl];
  const visitedSitemaps = new Set<string>();
  const discoveredUrls = new Set<string>();

  while (
    pendingSitemaps.length > 0 &&
    visitedSitemaps.size < MAX_SITEMAP_FILES &&
    discoveredUrls.size < MAX_DISCOVERED_URLS
  ) {
    const currentSitemap = pendingSitemaps.shift();

    if (!currentSitemap) break;
    if (visitedSitemaps.has(currentSitemap)) continue;

    visitedSitemaps.add(currentSitemap);

    const result = await fetchSitemap(currentSitemap);

    for (const nestedSitemap of result.nestedSitemaps) {
      if (
        !visitedSitemaps.has(nestedSitemap) &&
        pendingSitemaps.length + visitedSitemaps.size <
          MAX_SITEMAP_FILES
      ) {
        pendingSitemaps.push(nestedSitemap);
      }
    }

    for (const pageUrl of result.pageUrls) {
      if (
        shouldIncludeUrl(
          pageUrl,
          includePattern,
          excludePattern
        )
      ) {
        discoveredUrls.add(pageUrl);
      }

      if (discoveredUrls.size >= MAX_DISCOVERED_URLS) {
        break;
      }
    }
  }

  return {
    urls: Array.from(discoveredUrls),
    sitemapFilesScanned: visitedSitemaps.size,
  };
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

    if (!user || !isAdmin(user.email)) {
      return NextResponse.json(
        {
          error: "Not authorized",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      (await request.json().catch(() => ({}))) as DiscoveryBody;

    const name = String(body.name || "").trim();

    const sitemapUrl = cleanUrl(
      String(body.sitemap_url || "")
    );

    const includePattern = String(
      body.include_pattern || ""
    ).trim();

    const excludePattern = String(
      body.exclude_pattern || ""
    ).trim();

    if (!name) {
      return NextResponse.json(
        {
          error: "Catalog job name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!sitemapUrl) {
      return NextResponse.json(
        {
          error: "A valid sitemap URL is required.",
        },
        {
          status: 400,
        }
      );
    }

    const discovery = await discoverFromSitemap(
      sitemapUrl,
      includePattern,
      excludePattern
    );

    if (discovery.urls.length === 0) {
      return NextResponse.json(
        {
          error:
            "No matching page URLs were found in the sitemap.",
          sitemap_files_scanned:
            discovery.sitemapFilesScanned,
        },
        {
          status: 400,
        }
      );
    }

    const sourceSite =
      sourceSiteFromUrl(sitemapUrl) || "unknown";

    const admin = supabaseAdmin();

    const { data: job, error: jobError } = await admin
      .from("catalog_import_jobs")
      .insert({
        name,
        source_site: sourceSite,
        import_method: "sitemap",
        status: "pending",
        total_discovered: discovery.urls.length,
        total_pending: 0,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (jobError || !job?.id) {
      return NextResponse.json(
        {
          error:
            jobError?.message ||
            "Failed to create catalog job.",
        },
        {
          status: 500,
        }
      );
    }

    let queued = 0;

    const batches = splitIntoBatches(
      discovery.urls,
      INSERT_BATCH_SIZE
    );

    for (const batch of batches) {
      const rows = batch.map((sourceUrl) => ({
        job_id: job.id,
        source_site:
          sourceSiteFromUrl(sourceUrl) || sourceSite,
        source_url: sourceUrl,
        status: "pending",
        priority: 0,
        attempt_count: 0,
        max_attempts: 3,
      }));

      const { data: insertedRows, error: insertError } =
        await admin
          .from("novel_crawl_queue")
          .upsert(rows, {
            onConflict: "source_url",
            ignoreDuplicates: true,
          })
          .select("id");

      if (insertError) {
        await admin
          .from("catalog_import_jobs")
          .update({
            status: "failed",
            total_failed:
              discovery.urls.length - queued,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        return NextResponse.json(
          {
            error:
              `Queue insertion failed: ${insertError.message}`,
            job_id: job.id,
            queued,
          },
          {
            status: 500,
          }
        );
      }

      queued += insertedRows?.length ?? 0;
    }

    const skipped = discovery.urls.length - queued;
    const now = new Date().toISOString();

    const { error: updateError } = await admin
      .from("catalog_import_jobs")
      .update({
        status:
          queued > 0
            ? "processing"
            : "completed",
        total_pending: queued,
        total_skipped: skipped,
        started_at: queued > 0 ? now : null,
        completed_at: queued === 0 ? now : null,
        updated_at: now,
      })
      .eq("id", job.id);

    if (updateError) {
      return NextResponse.json(
        {
          error:
            `Catalog was queued, but job totals failed to update: ${updateError.message}`,
          job_id: job.id,
          queued,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      job_id: job.id,
      sitemap_files_scanned:
        discovery.sitemapFilesScanned,
      discovered: discovery.urls.length,
      queued,
      skipped,
      limit_reached:
        discovery.urls.length >= MAX_DISCOVERED_URLS,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown sitemap discovery error.";

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