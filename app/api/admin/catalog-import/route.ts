import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

const MAX_URLS_PER_JOB = 25_000;
const INSERT_BATCH_SIZE = 500;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type ParsedRequest = {
  name: string;
  rawText: string;
  importMethod: "url_list" | "csv_upload" | "txt_upload";
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
    const cleanedRaw = raw
      .trim()
      .replace(/^["']|["']$/g, "");

    const url = new URL(cleanedRaw);

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

function splitIntoBatches<T>(items: T[], size: number) {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(
    value.trim().replace(/^["']|["']$/g, "")
  );
}

function extractUrlsFromText(rawText: string) {
  const values: string[] = [];

  for (const line of rawText.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine) continue;

    if (looksLikeUrl(trimmedLine)) {
      values.push(trimmedLine);
      continue;
    }

    const csvValues = trimmedLine.split(",");

    for (const csvValue of csvValues) {
      const cleanedValue = csvValue.trim();

      if (looksLikeUrl(cleanedValue)) {
        values.push(cleanedValue);
      }
    }
  }

  return values;
}

async function parseIncomingRequest(
  request: Request
): Promise<ParsedRequest> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();

    const name = String(formData.get("name") || "").trim();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      throw new Error("No catalog file was supplied.");
    }

    if (fileValue.size === 0) {
      throw new Error("The uploaded file is empty.");
    }

    if (fileValue.size > MAX_FILE_SIZE) {
      throw new Error("The uploaded file must be 5 MB or smaller.");
    }

    const lowerName = fileValue.name.toLowerCase();

    const isCsv = lowerName.endsWith(".csv");
    const isTxt = lowerName.endsWith(".txt");

    if (!isCsv && !isTxt) {
      throw new Error("Only CSV and TXT files are supported.");
    }

    const rawText = await fileValue.text();

    return {
      name,
      rawText,
      importMethod: isCsv ? "csv_upload" : "txt_upload",
    };
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    urls?: string;
  };

  return {
    name: String(body.name || "").trim(),
    rawText: String(body.urls || ""),
    importMethod: "url_list",
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

    let parsedRequest: ParsedRequest;

    try {
      parsedRequest = await parseIncomingRequest(request);
    } catch (parseError: unknown) {
      return NextResponse.json(
        {
          error:
            parseError instanceof Error
              ? parseError.message
              : "Could not read the import request.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      name,
      rawText,
      importMethod,
    } = parsedRequest;

    if (!name) {
      return NextResponse.json(
        {
          error: "Import job name is required.",
        },
        {
          status: 400,
        }
      );
    }

    const submittedValues = extractUrlsFromText(rawText);

    if (submittedValues.length === 0) {
      return NextResponse.json(
        {
          error:
            "No URLs were found. Use one URL per line or include a URL column in the CSV.",
        },
        {
          status: 400,
        }
      );
    }

    if (submittedValues.length > MAX_URLS_PER_JOB) {
      return NextResponse.json(
        {
          error: `A single job may contain at most ${MAX_URLS_PER_JOB.toLocaleString()} URLs.`,
        },
        {
          status: 400,
        }
      );
    }

    let invalid = 0;

    const cleanedUrls = submittedValues
      .map((value) => {
        const cleaned = cleanUrl(value);

        if (!cleaned) {
          invalid += 1;
        }

        return cleaned;
      })
      .filter((url): url is string => Boolean(url));

    const uniqueUrls = Array.from(new Set(cleanedUrls));

    if (uniqueUrls.length === 0) {
      return NextResponse.json(
        {
          error: "No valid URLs were supplied.",
        },
        {
          status: 400,
        }
      );
    }

    const sourceSites = Array.from(
      new Set(
        uniqueUrls
          .map(sourceSiteFromUrl)
          .filter((site): site is string => Boolean(site))
      )
    );

    const jobSourceSite =
      sourceSites.length === 1
        ? sourceSites[0]
        : "mixed";

    const admin = supabaseAdmin();

    const { data: job, error: jobError } = await admin
      .from("catalog_import_jobs")
      .insert({
        name,
        source_site: jobSourceSite,
        import_method: importMethod,
        status: "pending",
        total_discovered: uniqueUrls.length,
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
            "Failed to create catalog import job.",
        },
        {
          status: 500,
        }
      );
    }

    let queued = 0;

    const batches = splitIntoBatches(
      uniqueUrls,
      INSERT_BATCH_SIZE
    );

    for (const batch of batches) {
      const rows = batch.map((sourceUrl) => ({
        job_id: job.id,
        source_site:
          sourceSiteFromUrl(sourceUrl) || "unknown",
        source_url: sourceUrl,
        status: "pending",
        priority: 0,
        attempt_count: 0,
        max_attempts: 3,
      }));

      const { data: insertedRows, error: queueError } =
        await admin
          .from("novel_crawl_queue")
          .upsert(rows, {
            onConflict: "source_url",
            ignoreDuplicates: true,
          })
          .select("id");

      if (queueError) {
        await admin
          .from("catalog_import_jobs")
          .update({
            status: "failed",
            total_failed:
              uniqueUrls.length - queued,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        return NextResponse.json(
          {
            error: `Queue insertion failed: ${queueError.message}`,
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

    const skipped =
      uniqueUrls.length - queued;

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
        started_at:
          queued > 0
            ? now
            : null,
        completed_at:
          queued === 0
            ? now
            : null,
        updated_at: now,
      })
      .eq("id", job.id);

    if (updateError) {
      return NextResponse.json(
        {
          error:
            `URLs were queued, but job totals could not be updated: ${updateError.message}`,
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
      submitted: submittedValues.length,
      unique_valid: uniqueUrls.length,
      queued,
      skipped,
      invalid,
      import_method: importMethod,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown catalog import error.";

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