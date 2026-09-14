// app/api/admin/auto-approve-imports/route.ts

import { NextResponse } from "next/server";

import { approveImport } from "@/lib/novelImport/approval/approveImport";
import { checkAutoApprovalEligibility } from "@/lib/novelImport/approval/eligibility";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

const MAX_APPROVAL_BATCH_SIZE = 25;
const SCAN_MULTIPLIER = 5;
const MAX_SCAN_SIZE = 125;

function isAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(email && admins.includes(email.toLowerCase()));
}

function safeJsonParse(raw: string | null) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cleanTags(values: string[] | null | undefined) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) =>
          String(value)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
        )
        .filter(Boolean)
    )
  ).slice(0, 30);
}

type PendingImportRow = {
  id: number;
  source_url: string | null;
  raw_payload: string | null;
  suggested_title: string | null;
  suggested_author: string | null;
  suggested_synopsis: string | null;
  suggested_cover_url: string | null;
  suggested_source_site: string | null;
  suggested_primary_genre: string | null;
  suggested_tags: string[] | null;
  suggested_status: string | null;
  suggested_chapters_total: number | null;
  status: string;
};

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

    const body = (
      await request.json().catch(() => ({}))
    ) as {
      limit?: number;
      after_id?: number | null;
    };

    const requestedLimit = Number(body.limit);

    const approvalLimit = Number.isFinite(requestedLimit)
      ? Math.max(
          1,
          Math.min(
            MAX_APPROVAL_BATCH_SIZE,
            Math.floor(requestedLimit)
          )
        )
      : MAX_APPROVAL_BATCH_SIZE;

    const requestedAfterId = Number(body.after_id);

    const afterId =
      Number.isFinite(requestedAfterId) && requestedAfterId > 0
        ? Math.floor(requestedAfterId)
        : null;

    const scanLimit = Math.min(
      MAX_SCAN_SIZE,
      approvalLimit * SCAN_MULTIPLIER
    );

    const admin = supabaseAdmin();

    let query = admin
      .from("novel_import_queue")
      .select(
        `
          id,
          source_url,
          raw_payload,
          suggested_title,
          suggested_author,
          suggested_synopsis,
          suggested_cover_url,
          suggested_source_site,
          suggested_primary_genre,
          suggested_tags,
          suggested_status,
          suggested_chapters_total,
          status
        `
      )
      .eq("status", "pending")
      .order("id", {
        ascending: true,
      })
      .limit(scanLimit);

    if (afterId !== null) {
      query = query.gt("id", afterId);
    }

    const {
      data,
      error: loadError,
    } = await query;

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

    const rows = (data as PendingImportRow[] | null) ?? [];

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        requested_approvals: approvalLimit,
        scan_limit: scanLimit,
        scanned: 0,
        eligible: 0,
        auto_approved: 0,
        created: 0,
        merged: 0,
        needs_review: 0,
        ineligible: 0,
        failed: 0,
        next_after_id: afterId,
        has_more: false,
        results: [],
        message: "No more pending imports were found in this pass.",
      });
    }

    let eligible = 0;
    let created = 0;
    let merged = 0;
    let needsReview = 0;
    let ineligible = 0;
    let failed = 0;
    let scanned = 0;
    let lastScannedId = afterId;

    const results: Array<{
      import_id: number;
      title: string | null;
      status:
        | "created"
        | "merged"
        | "needs_review"
        | "ineligible"
        | "failed";
      reasons?: string[];
      error?: string;
      novel_id?: number;
      slug?: string;
    }> = [];

    for (const row of rows) {
      if (created + merged >= approvalLimit) {
        break;
      }

      scanned += 1;
      lastScannedId = row.id;

      const payload = safeJsonParse(row.raw_payload);
      const extracted = payload?.extracted ?? null;
      const extractionStatus = payload?.extraction_status ?? null;

      const title =
        row.suggested_title ?? extracted?.suggested_title ?? null;

      const author =
        row.suggested_author ?? extracted?.suggested_author ?? null;

      const synopsis =
        row.suggested_synopsis ?? extracted?.suggested_synopsis ?? null;

      const coverUrl =
        row.suggested_cover_url ?? extracted?.suggested_cover_url ?? null;

      const sourceUrl =
        row.source_url ?? extracted?.source_url ?? null;

      const sourceSite =
        row.suggested_source_site ??
        extracted?.suggested_source_site ??
        null;

      const primaryGenre =
        row.suggested_primary_genre ??
        extracted?.suggested_primary_genre ??
        null;

      const tags = cleanTags(
        row.suggested_tags ?? extracted?.suggested_tags ?? []
      );

      const status =
        row.suggested_status ?? extracted?.status ?? "unknown";

      const chaptersTotal =
        row.suggested_chapters_total ??
        extracted?.chapters_total ??
        null;

      const extractionMethod =
        extracted?.extraction_method ?? null;

      const eligibility = checkAutoApprovalEligibility({
        extractionStatus,
        title,
        author,
        synopsis,
        coverUrl,
        sourceUrl,
        sourceSite,
        primaryGenre,
        tags,
        status,
        chaptersTotal,
        extractionMethod,
      });

      if (!eligibility.eligible) {
        ineligible += 1;

        results.push({
          import_id: row.id,
          title,
          status: "ineligible",
          reasons: eligibility.reasons,
        });

        continue;
      }

      eligible += 1;

      try {
        const approval = await approveImport({
          importId: row.id,
          approvedBy: user.id,
          title: title || "",
          authorName: author,
          sourceUrl,
          sourceSite,
          coverUrl,
          synopsis,
          primaryGenre,
          tags,
          status,
          translationStatus: "unknown",
          chaptersTotal,
          country: null,
        });

        if (
          !approval.success &&
          approval.action === "needs_review"
        ) {
          needsReview += 1;

          results.push({
            import_id: row.id,
            title,
            status: "needs_review",
            reasons: approval.match.reasons,
          });

          continue;
        }

        if (
          approval.success &&
          approval.action === "merged"
        ) {
          merged += 1;

          results.push({
            import_id: row.id,
            title,
            status: "merged",
            novel_id: approval.novelId,
            slug: approval.slug,
          });

          continue;
        }

        if (
          approval.success &&
          approval.action === "created"
        ) {
          created += 1;

          results.push({
            import_id: row.id,
            title,
            status: "created",
            novel_id: approval.novelId,
            slug: approval.slug,
          });

          continue;
        }

        failed += 1;

        results.push({
          import_id: row.id,
          title,
          status: "failed",
          error: "Unknown approval result.",
        });
      } catch (approvalError: unknown) {
        failed += 1;

        results.push({
          import_id: row.id,
          title,
          status: "failed",
          error:
            approvalError instanceof Error
              ? approvalError.message
              : "Unknown auto-approval error.",
        });
      }
    }

    let hasMore = false;

    if (lastScannedId !== null) {
      const {
        count,
        error: countError,
      } = await admin
        .from("novel_import_queue")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("status", "pending")
        .gt("id", lastScannedId);

      if (countError) {
        return NextResponse.json(
          {
            error: countError.message,
          },
          {
            status: 500,
          }
        );
      }

      hasMore = (count ?? 0) > 0;
    }

    return NextResponse.json({
      success: true,
      requested_approvals: approvalLimit,
      scan_limit: scanLimit,
      scanned,
      eligible,
      auto_approved: created + merged,
      created,
      merged,
      needs_review: needsReview,
      ineligible,
      failed,
      next_after_id: lastScannedId,
      has_more: hasMore,
      results,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown auto-approval batch error.";

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