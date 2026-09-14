// app/api/admin/import-eligibility/route.ts

import { NextResponse } from "next/server";

import { checkAutoApprovalEligibility } from "@/lib/novelImport/approval/eligibility";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

function isAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(
    email &&
      admins.includes(email.toLowerCase())
  );
}

function safeJsonParse(raw: string | null) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

    const body = (
      await request.json().catch(() => ({}))
    ) as {
      limit?: number;
    };

    const requestedLimit = Number(body.limit);

    const limit = Number.isFinite(requestedLimit)
      ? Math.max(
          1,
          Math.min(
            100,
            Math.floor(requestedLimit)
          )
        )
      : 25;

    const admin = supabaseAdmin();

    const { data, error } = await admin
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
          suggested_chapters_total
        `
      )
      .eq("status", "pending")
      .order("created_at", {
        ascending: true,
      })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    const rows = data ?? [];

    const results = rows.map((row) => {
      const payload = safeJsonParse(
        row.raw_payload
      );

      const extracted =
        payload?.extracted ?? null;

      const extractionStatus =
        payload?.extraction_status ?? null;

      const extractionMethod =
        extracted?.extraction_method ?? null;

      const eligibility =
        checkAutoApprovalEligibility({
          extractionStatus,

          title:
            row.suggested_title ??
            extracted?.suggested_title ??
            null,

          author:
            row.suggested_author ??
            extracted?.suggested_author ??
            null,

          synopsis:
            row.suggested_synopsis ??
            extracted?.suggested_synopsis ??
            null,

          coverUrl:
            row.suggested_cover_url ??
            extracted?.suggested_cover_url ??
            null,

          sourceUrl:
            row.source_url ??
            extracted?.source_url ??
            null,

          sourceSite:
            row.suggested_source_site ??
            extracted?.suggested_source_site ??
            null,

          primaryGenre:
            row.suggested_primary_genre ??
            extracted?.suggested_primary_genre ??
            null,

          tags:
            row.suggested_tags ??
            extracted?.suggested_tags ??
            [],

          status:
            row.suggested_status ??
            extracted?.status ??
            null,

          chaptersTotal:
            row.suggested_chapters_total ??
            extracted?.chapters_total ??
            null,

          extractionMethod,
        });

      return {
        import_id: row.id,
        title:
          row.suggested_title ??
          extracted?.suggested_title ??
          null,
        source_url:
          row.source_url ??
          extracted?.source_url ??
          null,
        eligible: eligibility.eligible,
        reasons: eligibility.reasons,
      };
    });

    const eligibleCount =
      results.filter(
        (result) => result.eligible
      ).length;

    const reviewCount =
      results.length - eligibleCount;

    return NextResponse.json({
      success: true,
      scanned: results.length,
      eligible: eligibleCount,
      needs_review: reviewCount,
      results,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown eligibility error.";

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