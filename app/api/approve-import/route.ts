// app/api/approve-import/route.ts

import { NextResponse } from "next/server";

import { approveImport } from "@/lib/novelImport/approval/approveImport";
import { supabaseAdmin } from "@/lib/supabase";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

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

function intOrNull(
  value: FormDataEntryValue | null
) {
  const number = Number(value);

  return Number.isFinite(number) &&
    number > 0
    ? number
    : null;
}

function tagsFromForm(
  value: FormDataEntryValue | null
) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function POST(
  req: Request
) {
  try {
    /*
     * 1. Authenticate administrator.
     */
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
          error: "Not authorized",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * 2. Read submitted form.
     */
    const fd =
      await req.formData();

    const action =
      String(
        fd.get("action") || ""
      ).trim();

    const importId =
      Number(fd.get("import_id"));

    if (
      !Number.isFinite(importId)
    ) {
      return NextResponse.json(
        {
          error:
            "Missing import_id",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 3. Reject / manually mark duplicate.
     *
     * These actions do not use the
     * canonical approval service.
     */
    if (
      action === "reject" ||
      action === "duplicate"
    ) {
      const admin =
        supabaseAdmin();

      const {
        data: importRow,
        error: importLoadError,
      } = await admin
        .from("novel_import_queue")
        .select("id")
        .eq("id", importId)
        .maybeSingle();

      if (importLoadError) {
        return NextResponse.json(
          {
            error:
              importLoadError.message,
          },
          {
            status: 500,
          }
        );
      }

      if (!importRow) {
        return NextResponse.json(
          {
            error:
              "Import row not found",
          },
          {
            status: 404,
          }
        );
      }

      const {
        error: updateError,
      } = await admin
        .from("novel_import_queue")
        .update({
          status:
            action === "duplicate"
              ? "duplicate"
              : "rejected",

          approved_by:
            user.id,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", importId);

      if (updateError) {
        return NextResponse.json(
          {
            error:
              updateError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.redirect(
        new URL(
          "/admin/imports",
          req.url
        ),
        {
          status: 303,
        }
      );
    }

    /*
     * 4. Only approve remains.
     */
    if (action !== "approve") {
      return NextResponse.json(
        {
          error: "Invalid action",
        },
        {
          status: 400,
        }
      );
    }

    const field = (
      key: string
    ) =>
      String(
        fd.get(key) || ""
      ).trim();

    const title =
      field("title");

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Title is required",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 5. Send approval through the
     * shared canonical approval service.
     */
    const result =
      await approveImport({
        importId,
        approvedBy: user.id,

        title,

        authorName:
          field("author_name") ||
          null,

        sourceUrl:
          field("source_url") ||
          null,

        sourceSite:
          field("source_site") ||
          null,

        coverUrl:
          field(
            "cover_image_url"
          ) || null,

        synopsis:
          field("synopsis") ||
          null,

        primaryGenre:
          field(
            "primary_genre"
          ) || null,

        tags:
          tagsFromForm(
            fd.get("tags")
          ),

        status:
          field("status") ||
          "unknown",

        translationStatus:
          field(
            "translation_status"
          ) || "unknown",

        chaptersTotal:
          intOrNull(
            fd.get(
              "chapters_total"
            )
          ),

        country:
          field("country") ||
          null,
      });

    /*
     * 6. Uncertain duplicate.
     *
     * Keep the import pending so it
     * remains in manual review.
     */
    if (
      !result.success &&
      result.action ===
        "needs_review"
    ) {
      return NextResponse.json(
        {
          error:
            `Possible duplicate needs review: ${
              result.match.title ||
              "existing novel"
            }`,

          duplicate_review_required:
            true,

          match: {
            novel_id:
              result.match.novelId,

            title:
              result.match.title,

            author:
              result.match.author,

            match_type:
              result.match.matchType,

            confidence:
              result.match.confidence,

            reasons:
              result.match.reasons,
          },
        },
        {
          status: 409,
        }
      );
    }

    /*
     * 7. Created or merged successfully.
     */
    if (result.success) {
      return NextResponse.redirect(
        new URL(
          `/novel/${result.slug}`,
          req.url
        ),
        {
          status: 303,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Approval did not complete.",
      },
      {
        status: 500,
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

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