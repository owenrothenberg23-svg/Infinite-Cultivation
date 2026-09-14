// app/api/admin/catalog-worker/route.ts

import { NextResponse } from "next/server";
import { parseNovelMetadata } from "@/lib/novelImport";
import { fetchNovelSource } from "@/lib/novelImport/fetchSource";
import type { ImportedNovelMetadata } from "@/lib/novelImport/types";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 25;

type CrawlRow = {
  id: number;
  job_id: number | null;
  source_site: string;
  source_url: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
};

type SourcePayload = {
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

type ImportRawPayload = {
  imported_from_url: string;
  extracted_at: string;
  extraction_status: "success" | "failed";
  extraction_error?: string;
  extracted?: ImportedNovelMetadata;
  crawl_queue_id: number;
  catalog_job_id: number | null;
  source_data_for_novel_sources: SourcePayload;
};

function isAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(email && admins.includes(email.toLowerCase()));
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
    const finalSegment =
      new URL(url).pathname.split("/").filter(Boolean).pop() || "";

    if (!finalSegment) return null;

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
): SourcePayload {
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

function buildFallbackMetadata(url: string): ImportedNovelMetadata {
  const sourceSite = sourceSiteFromUrl(url);
  const fallbackTitle = titleFromUrl(url);

  return {
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
}

async function sourceAlreadyHandled(
  admin: ReturnType<typeof supabaseAdmin>,
  sourceUrl: string
) {
  const { data: novel, error: novelError } = await admin
    .from("novels")
    .select("id")
    .eq("source_url", sourceUrl)
    .maybeSingle();

  if (novelError) throw novelError;
  if (novel) return true;

  const { data: source, error: sourceError } = await admin
    .from("novel_sources")
    .select("id")
    .eq("source_url", sourceUrl)
    .maybeSingle();

  if (sourceError) throw sourceError;
  if (source) return true;

  const { data: queuedImport, error: queueError } = await admin
    .from("novel_import_queue")
    .select("id")
    .eq("source_url", sourceUrl)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (queueError) throw queueError;

  return Boolean(queuedImport);
}

async function updateJobTotals(
  admin: ReturnType<typeof supabaseAdmin>,
  jobId: number
) {
  const statuses = [
    "pending",
    "processing",
    "completed",
    "failed",
    "skipped",
  ] as const;

  const counts: Record<(typeof statuses)[number], number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const status of statuses) {
    const { count, error } = await admin
      .from("novel_crawl_queue")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("job_id", jobId)
      .eq("status", status);

    if (error) throw error;

    counts[status] = count ?? 0;
  }

  const remaining = counts.pending + counts.processing;

  let jobStatus:
    | "processing"
    | "completed"
    | "completed_with_errors";

  if (remaining > 0) {
    jobStatus = "processing";
  } else if (counts.failed > 0) {
    jobStatus = "completed_with_errors";
  } else {
    jobStatus = "completed";
  }

  const { error } = await admin
    .from("catalog_import_jobs")
    .update({
      status: jobStatus,
      total_pending: counts.pending,
      total_processing: counts.processing,
      total_completed: counts.completed,
      total_failed: counts.failed,
      total_skipped: counts.skipped,
      completed_at:
        remaining === 0 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw error;
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

    const body = (await request.json().catch(() => ({}))) as {
      batch_size?: number;
      job_id?: number;
    };

    const requestedBatchSize = Number(body.batch_size);

    const batchSize = Number.isFinite(requestedBatchSize)
      ? Math.max(
          1,
          Math.min(
            MAX_BATCH_SIZE,
            Math.floor(requestedBatchSize)
          )
        )
      : DEFAULT_BATCH_SIZE;

    const requestedJobId = Number(body.job_id);

    const admin = supabaseAdmin();

    let query = admin
      .from("novel_crawl_queue")
      .select(
        `
          id,
          job_id,
          source_site,
          source_url,
          status,
          attempt_count,
          max_attempts
        `
      )
      .eq("status", "pending")
      .order("priority", {
        ascending: false,
      })
      .order("created_at", {
        ascending: true,
      })
      .limit(batchSize);

    if (Number.isFinite(requestedJobId)) {
      query = query.eq("job_id", requestedJobId);
    }

    const { data, error: loadError } = await query;

    if (loadError) {
      return NextResponse.json(
        {
          error: loadError.message,
        },
        {
          status: 500,
        }
      );
    }

    const rows = (data as CrawlRow[] | null) ?? [];

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        selected: 0,
        completed: 0,
        skipped: 0,
        retried: 0,
        failed: 0,
        message: "No pending crawl rows were found.",
      });
    }

    let completed = 0;
    let skipped = 0;
    let retried = 0;
    let failed = 0;

    const affectedJobIds = new Set<number>();

    const results: Array<{
      crawl_queue_id: number;
      source_url: string;
      status: "completed" | "skipped" | "retrying" | "failed";
      extraction_status?: "success" | "failed";
      extraction_method?: string;
      error?: string;
    }> = [];

    for (const row of rows) {
      if (row.job_id !== null) {
        affectedJobIds.add(row.job_id);
      }

      const claimedAt = new Date().toISOString();

      const { data: claimedRow, error: claimError } = await admin
        .from("novel_crawl_queue")
        .update({
          status: "processing",
          processing_started_at: claimedAt,
          updated_at: claimedAt,
        })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (claimError) {
        console.warn("Failed to claim crawl row:", row.id, claimError);
        continue;
      }

      if (!claimedRow) {
        continue;
      }

      try {
        if (await sourceAlreadyHandled(admin, row.source_url)) {
          const now = new Date().toISOString();

          const { error: skipError } = await admin
            .from("novel_crawl_queue")
            .update({
              status: "skipped",
              processed_at: now,
              updated_at: now,
              last_error: null,
            })
            .eq("id", row.id);

          if (skipError) throw skipError;

          skipped += 1;

          results.push({
            crawl_queue_id: row.id,
            source_url: row.source_url,
            status: "skipped",
          });

          continue;
        }

        let metadata: ImportedNovelMetadata;
        let extractionStatus: "success" | "failed";
        let extractionError: string | undefined;

        try {
          const source = await fetchNovelSource(
            row.source_url
          );

          metadata = parseNovelMetadata(
            source.html,
            row.source_url,
            {
              auxiliary: source.auxiliary,
            }
          );

          extractionStatus = "success";
        } catch (fetchError: unknown) {
          extractionError =
            fetchError instanceof Error
              ? fetchError.message
              : "Metadata fetch failed";

          metadata = buildFallbackMetadata(row.source_url);
          extractionStatus = "failed";
        }

        const rawPayload: ImportRawPayload = {
          imported_from_url: row.source_url,
          extracted_at: new Date().toISOString(),
          extraction_status: extractionStatus,
          extraction_error: extractionError,
          extracted:
            extractionStatus === "success"
              ? metadata
              : undefined,
          crawl_queue_id: row.id,
          catalog_job_id: row.job_id,
          source_data_for_novel_sources: buildSourcePayload(
            row.source_url,
            metadata
          ),
        };

        const { error: importError } = await admin
          .from("novel_import_queue")
          .insert({
            source_url: row.source_url,
            raw_title: metadata.suggested_title,
            raw_payload: JSON.stringify(rawPayload, null, 2),

            suggested_title: metadata.suggested_title,
            suggested_author: metadata.suggested_author,
            suggested_synopsis: metadata.suggested_synopsis,
            suggested_cover_url: metadata.suggested_cover_url,
            suggested_source_site:
              metadata.suggested_source_site,
            suggested_primary_genre:
              metadata.suggested_primary_genre,
            suggested_tags: metadata.suggested_tags,
            suggested_status: metadata.status,
            suggested_chapters_total:
              metadata.chapters_total,

            created_by: user.id,
            status: "pending",
          });

        if (importError) {
          throw importError;
        }

        const completedAt = new Date().toISOString();

        const { error: completeError } = await admin
          .from("novel_crawl_queue")
          .update({
            status: "completed",
            extraction_method:
              metadata.extraction_method,
            processed_at: completedAt,
            updated_at: completedAt,
            last_error: extractionError ?? null,
          })
          .eq("id", row.id);

        if (completeError) throw completeError;

        completed += 1;

        results.push({
          crawl_queue_id: row.id,
          source_url: row.source_url,
          status: "completed",
          extraction_status: extractionStatus,
          extraction_method:
            metadata.extraction_method,
        });
      } catch (processingError: unknown) {
        const message =
          processingError instanceof Error
            ? processingError.message
            : "Unknown worker error";

        const nextAttemptCount =
          (row.attempt_count ?? 0) + 1;

        const shouldFail =
          nextAttemptCount >=
          (row.max_attempts || 3);

        const now = new Date();
        const retryAfter = new Date(
          now.getTime() +
            Math.min(nextAttemptCount * 5, 30) *
              60_000
        ).toISOString();

        const { error: failureUpdateError } = await admin
          .from("novel_crawl_queue")
          .update({
            status: shouldFail ? "failed" : "pending",
            attempt_count: nextAttemptCount,
            last_error: message,
            retry_after: shouldFail
              ? null
              : retryAfter,
            processed_at: shouldFail
              ? now.toISOString()
              : null,
            processing_started_at: null,
            updated_at: now.toISOString(),
          })
          .eq("id", row.id);

        if (failureUpdateError) {
          console.error(
            "Failed to update crawl error state:",
            row.id,
            failureUpdateError
          );
        }

        if (shouldFail) {
          failed += 1;

          results.push({
            crawl_queue_id: row.id,
            source_url: row.source_url,
            status: "failed",
            error: message,
          });
        } else {
          retried += 1;

          results.push({
            crawl_queue_id: row.id,
            source_url: row.source_url,
            status: "retrying",
            error: message,
          });
        }
      }
    }

    for (const jobId of affectedJobIds) {
      try {
        await updateJobTotals(admin, jobId);
      } catch (jobUpdateError) {
        console.warn(
          "Failed to update catalog job totals:",
          jobId,
          jobUpdateError
        );
      }
    }

    return NextResponse.json({
      success: true,
      selected: rows.length,
      completed,
      skipped,
      retried,
      failed,
      results,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown catalog worker error";

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