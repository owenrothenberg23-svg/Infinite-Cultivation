// app/api/publish-story/route.ts

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

const OWNER_EMAIL = (process.env.BETA_OWNER_EMAIL || "")
  .trim()
  .toLowerCase();

function getBearer(req: Request) {
  const authHeader =
    req.headers.get("authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return "";
  }

  return authHeader
    .slice("Bearer ".length)
    .trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function cleanStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 50);
}

async function countPublishedChapters(
  sb: ReturnType<typeof getSupabaseServer>,
  storyId: string
) {
  const { count, error } = await sb
    .from("chapters")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("story_id", storyId)
    .eq("is_deleted", false)
    .not("final_content", "is", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function createUniqueNovelSlug(
  sb: ReturnType<typeof getSupabaseServer>,
  title: string,
  storyId: string
) {
  const base =
    slugify(title) || "story";

  const { data: existingBase } =
    await sb
      .from("novels")
      .select("id")
      .eq("slug", base)
      .maybeSingle();

  if (!existingBase) {
    return base;
  }

  const shortId = storyId
    .replace(/-/g, "")
    .slice(0, 8);

  const candidate =
    `${base}-${shortId}`;

  const { data: existingCandidate } =
    await sb
      .from("novels")
      .select("id, hosted_story_id")
      .eq("slug", candidate)
      .maybeSingle();

  if (
    !existingCandidate ||
    existingCandidate.hosted_story_id ===
      storyId
  ) {
    return candidate;
  }

  return `${base}-${storyId
    .replace(/-/g, "")
    .slice(0, 16)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req
      .json()
      .catch(() => ({}));

    const storyId =
      typeof body.storyId === "string"
        ? body.storyId.trim()
        : "";

    const summary =
      typeof body.summary === "string"
        ? body.summary.trim() || null
        : null;

    const coverImageUrl =
      typeof body.coverImageUrl === "string"
        ? body.coverImageUrl.trim() ||
          null
        : null;

    if (!storyId) {
      return NextResponse.json(
        { error: "Missing storyId" },
        { status: 400 }
      );
    }

    const sb =
      getSupabaseServer();

    const token =
      getBearer(req);

    if (!token) {
      return NextResponse.json(
        {
          error:
            "Please log in to continue",
        },
        { status: 401 }
      );
    }

    const {
      data: userData,
      error: userErr,
    } = await sb.auth.getUser(token);

    if (
      userErr ||
      !userData?.user?.id
    ) {
      return NextResponse.json(
        {
          error:
            "Please log in to continue",
        },
        { status: 401 }
      );
    }

    const email = (
      userData.user.email || ""
    )
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json(
        {
          error:
            "Account email missing.",
        },
        { status: 401 }
      );
    }

    /*
     * Keep beta authorization consistent
     * with proxy.ts.
     *
     * The configured owner bypasses the
     * beta_allowlist check.
     */
    const isBetaOwner =
      !!OWNER_EMAIL &&
      email === OWNER_EMAIL;

    if (!isBetaOwner) {
      const {
        data: allow,
        error: allowError,
      } = await sb
        .from("beta_allowlist")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (allowError) {
        console.error(
          "publish-story beta allowlist error:",
          allowError
        );

        return NextResponse.json(
          {
            error:
              "Could not verify beta access.",
          },
          { status: 500 }
        );
      }

      if (!allow?.email) {
        return NextResponse.json(
          {
            error:
              "This is a closed beta. Please request an invite to continue.",
          },
          { status: 403 }
        );
      }
    }

    const userId =
      userData.user.id;

    const {
      data: story,
      error: storyErr,
    } = await sb
      .from("stories")
      .select(
        `
        id,
        user_id,
        author_id,
        title,
        story_pitch,
        primary_genre,
        genres,
        tags_json,
        is_public,
        public_summary,
        cover_image_url
        `
      )
      .eq("id", storyId)
      .single();

    if (
      storyErr ||
      !story
    ) {
      return NextResponse.json(
        {
          error:
            "Story not found",
        },
        { status: 404 }
      );
    }

    const ownsStory =
      story.user_id === userId ||
      story.author_id === userId;

    if (!ownsStory) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to publish this story",
        },
        { status: 403 }
      );
    }

    const title = String(
      story.title || ""
    ).trim();

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Story title is required before publishing",
        },
        { status: 400 }
      );
    }

    const finalSummary =
      summary ??
      (typeof story.public_summary ===
      "string"
        ? story.public_summary.trim() ||
          null
        : null) ??
      (typeof story.story_pitch ===
      "string"
        ? story.story_pitch.trim() ||
          null
        : null);

    const finalCoverImageUrl =
      coverImageUrl ??
      (typeof story.cover_image_url ===
      "string"
        ? story.cover_image_url.trim() ||
          null
        : null);

    let chaptersTotal: number;

    try {
      chaptersTotal =
        await countPublishedChapters(
          sb,
          storyId
        );
    } catch (countErr) {
      console.error(
        "publish-story chapter count error:",
        countErr
      );

      return NextResponse.json(
        {
          error:
            "Could not verify the story's published chapters.",
        },
        { status: 500 }
      );
    }

    const { error: updateErr } =
      await sb
        .from("stories")
        .update({
          is_public: true,
          public_summary:
            finalSummary,
          cover_image_url:
            finalCoverImageUrl,
        })
        .eq("id", storyId);

    if (updateErr) {
      console.error(
        "publish-story update error:",
        updateErr
      );

      return NextResponse.json(
        {
          error:
            updateErr.message ??
            "Failed to publish story",
        },
        { status: 500 }
      );
    }

    const {
      data: existingNovel,
      error: existingNovelErr,
    } = await sb
      .from("novels")
      .select("id, slug")
      .eq(
        "hosted_story_id",
        storyId
      )
      .maybeSingle();

    if (existingNovelErr) {
      console.error(
        "publish-story novel lookup error:",
        existingNovelErr
      );

      return NextResponse.json(
        {
          error:
            "Story was published, but its catalog entry could not be checked.",
        },
        { status: 500 }
      );
    }

    const tags =
      cleanStringArray(
        story.tags_json
      );

    const genres =
      cleanStringArray(
        story.genres
      );

    const primaryGenre =
      typeof story.primary_genre ===
        "string" &&
      story.primary_genre.trim()
        ? story.primary_genre.trim()
        : genres[0] || null;

    let novelId: string;
    let novelSlug: string;

    if (existingNovel) {
      const {
        data: updatedNovel,
        error: novelUpdateErr,
      } = await sb
        .from("novels")
        .update({
          title,
          cover_image_url:
            finalCoverImageUrl,
          synopsis:
            finalSummary,
          primary_genre:
            primaryGenre,
          tags,
          status: "ongoing",
          translation_status:
            "original",
          chapters_total:
            chaptersTotal,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          existingNovel.id
        )
        .select("id, slug")
        .single();

      if (
        novelUpdateErr ||
        !updatedNovel
      ) {
        console.error(
          "publish-story novel update error:",
          novelUpdateErr
        );

        return NextResponse.json(
          {
            error:
              "Story was published, but its catalog entry could not be updated.",
          },
          { status: 500 }
        );
      }

      novelId =
        updatedNovel.id;

      novelSlug =
        updatedNovel.slug;
    } else {
      const slug =
        await createUniqueNovelSlug(
          sb,
          title,
          storyId
        );

      const {
        data: createdNovel,
        error: novelInsertErr,
      } = await sb
        .from("novels")
        .insert({
          slug,
          title,

          author_name:
            userData.user
              .user_metadata
              ?.display_name ||
            userData.user
              .user_metadata
              ?.username ||
            email.split("@")[0] ||
            "Unknown author",

          source_url: null,

          source_site:
            "infinite_cultivation",

          cover_image_url:
            finalCoverImageUrl,

          synopsis:
            finalSummary,

          primary_genre:
            primaryGenre,

          tags,

          status: "ongoing",

          translation_status:
            "original",

          chapters_total:
            chaptersTotal,

          hosted_story_id:
            storyId,
        })
        .select("id, slug")
        .single();

      if (
        novelInsertErr ||
        !createdNovel
      ) {
        console.error(
          "publish-story novel insert error:",
          novelInsertErr
        );

        return NextResponse.json(
          {
            error:
              "Story was published, but its catalog entry could not be created.",
          },
          { status: 500 }
        );
      }

      novelId =
        createdNovel.id;

      novelSlug =
        createdNovel.slug;
    }

    return NextResponse.json(
      {
        ok: true,

        story: {
          id: storyId,
        },

        novel: {
          id: novelId,
          slug: novelSlug,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error(
      "publish-story fatal:",
      err
    );

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unexpected error while publishing story",
      },
      { status: 500 }
    );
  }
}