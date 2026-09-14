// app/api/admin/catalog-discovery/novelcool/route.ts

import { NextResponse } from "next/server";

import { discoverNovelCoolUrls } from "@/lib/novelImport/discovery/novelCool";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

const INSERT_BATCH_SIZE = 500;

const MAX_DISCOVERY_NOVELS = 10_000;
const MAX_DISCOVERY_PAGES_PER_CATEGORY = 250;
const MAX_CATEGORIES_PER_JOB = 25;

function isAdmin(
  email: string | undefined | null
) {
  const admins = (
    process.env.ADMIN_EMAILS || ""
  )
    .split(",")
    .map((email) =>
      email.trim().toLowerCase()
    )
    .filter(Boolean);

  return Boolean(
    email &&
      admins.includes(
        email.toLowerCase()
      )
  );
}

function splitIntoBatches<T>(
  items: T[],
  size: number
) {
  const batches: T[][] = [];

  for (
    let index = 0;
    index < items.length;
    index += size
  ) {
    batches.push(
      items.slice(
        index,
        index + size
      )
    );
  }

  return batches;
}

function parseCategories(
  value:
    | string
    | string[]
    | undefined
) {
  const rawValues =
    Array.isArray(value)
      ? value
      : String(value || "")
          .split(",");

  return Array.from(
    new Set(
      rawValues
        .map((category) =>
          category.trim()
        )
        .filter(Boolean)
    )
  ).slice(
    0,
    MAX_CATEGORIES_PER_JOB
  );
}

export async function POST(
  request: Request
) {
  try {
    const ssr =
      await supabaseServerClient();

    const {
      data: userData,
      error: userError,
    } = await ssr.auth.getUser();

    if (userError) {
      return NextResponse.json(
        {
          error:
            `Authentication failed: ${userError.message}`,
        },
        {
          status: 401,
        }
      );
    }

    const user =
      userData?.user;

    if (
      !user ||
      !isAdmin(user.email)
    ) {
      return NextResponse.json(
        {
          error:
            "Not authorized",
        },
        {
          status: 403,
        }
      );
    }

    const body = (
      await request
        .json()
        .catch(() => ({}))
    ) as {
      category?: string;
      categories?:
        | string
        | string[];

      limit?: number;
      max_pages?: number;
      delay_ms?: number;
      name?: string;
    };

    const categories =
      parseCategories(
        body.categories ??
          body.category ??
          "Xianxia"
      );

    if (
      categories.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "At least one NovelCool category is required.",
        },
        {
          status: 400,
        }
      );
    }

    const requestedLimit =
      Number(body.limit);

    const limit =
      Number.isFinite(
        requestedLimit
      )
        ? Math.max(
            1,
            Math.min(
              Math.floor(
                requestedLimit
              ),
              MAX_DISCOVERY_NOVELS
            )
          )
        : 500;

    const requestedMaxPages =
      Number(
        body.max_pages
      );

    const maxPages =
      Number.isFinite(
        requestedMaxPages
      )
        ? Math.max(
            1,
            Math.min(
              Math.floor(
                requestedMaxPages
              ),
              MAX_DISCOVERY_PAGES_PER_CATEGORY
            )
          )
        : 25;

    const requestedDelay =
      Number(body.delay_ms);

    const delayMs =
      Number.isFinite(
        requestedDelay
      )
        ? Math.max(
            0,
            Math.min(
              Math.floor(
                requestedDelay
              ),
              5_000
            )
          )
        : 200;

    const defaultName =
      categories.length === 1
        ? `NovelCool ${categories[0]} Discovery`
        : `NovelCool Multi-Category Discovery (${categories.length})`;

    const name =
      String(
        body.name ||
          defaultName
      ).trim();

    const discovery =
      await discoverNovelCoolUrls({
        categories,
        maxNovels:
          limit,
        maxPages,
        delayMs,
      });

    if (
      discovery.urls.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "NovelCool discovery found no novel URLs.",

          categories,

          pages_scanned:
            discovery.pages_scanned,

          category_stats:
            discovery.category_stats,
        },
        {
          status: 404,
        }
      );
    }

    const admin =
      supabaseAdmin();

    const {
      data: job,
      error: jobError,
    } = await admin
      .from(
        "catalog_import_jobs"
      )
      .insert({
        name,

        source_site:
          "novelcool.com",

        import_method:
          "url_list",

        status:
          "pending",

        total_discovered:
          discovery.urls.length,

        total_pending:
          0,

        created_by:
          user.id,
      })
      .select("id")
      .single();

    if (
      jobError ||
      !job?.id
    ) {
      return NextResponse.json(
        {
          error:
            jobError?.message ||
            "Failed to create NovelCool discovery job.",
        },
        {
          status: 500,
        }
      );
    }

    let queued = 0;

    const batches =
      splitIntoBatches(
        discovery.urls,
        INSERT_BATCH_SIZE
      );

    for (
      const batch of batches
    ) {
      const rows =
        batch.map(
          (sourceUrl) => ({
            job_id:
              job.id,

            source_site:
              "novelcool.com",

            source_url:
              sourceUrl,

            status:
              "pending",

            priority:
              0,

            attempt_count:
              0,

            max_attempts:
              3,
          })
        );

      const {
        data:
          insertedRows,
        error:
          queueError,
      } = await admin
        .from(
          "novel_crawl_queue"
        )
        .upsert(rows, {
          onConflict:
            "source_url",

          ignoreDuplicates:
            true,
        })
        .select("id");

      if (queueError) {
        await admin
          .from(
            "catalog_import_jobs"
          )
          .update({
            status:
              "failed",

            total_failed:
              discovery.urls
                .length -
              queued,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            job.id
          );

        return NextResponse.json(
          {
            error:
              `NovelCool queue insertion failed: ${queueError.message}`,

            job_id:
              job.id,

            queued,
          },
          {
            status: 500,
          }
        );
      }

      queued +=
        insertedRows?.length ??
        0;
    }

    const skipped =
      discovery.urls.length -
      queued;

    const now =
      new Date()
        .toISOString();

    const {
      error:
        updateError,
    } = await admin
      .from(
        "catalog_import_jobs"
      )
      .update({
        status:
          queued > 0
            ? "processing"
            : "completed",

        total_pending:
          queued,

        total_skipped:
          skipped,

        started_at:
          queued > 0
            ? now
            : null,

        completed_at:
          queued === 0
            ? now
            : null,

        updated_at:
          now,
      })
      .eq(
        "id",
        job.id
      );

    if (updateError) {
      return NextResponse.json(
        {
          error:
            `NovelCool URLs were queued, but job totals could not be updated: ${updateError.message}`,

          job_id:
            job.id,

          queued,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,

      job_id:
        job.id,

      categories:
        discovery.categories,

      category_count:
        discovery.categories
          .length,

      discovered:
        discovery.urls.length,

      pages_scanned:
        discovery.pages_scanned,

      stopped_early:
        discovery.stopped_early,

      category_stats:
        discovery.category_stats,

      queued,

      skipped,
    });
  } catch (
    error: unknown
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown NovelCool discovery error.";

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status: 500,
      }
    );
  }
}