// lib/novelImport/approval/approveImport.ts

import { supabaseAdmin } from "@/lib/supabase";
import {
  canAutoMerge,
  findNovelMatch,
  requiresDuplicateReview,
} from "@/lib/novelImport/dedupe/matchNovel";
import { mergeCanonicalNovel } from "@/lib/novelImport/merge/mergeNovel";

export type ApproveImportInput = {
  importId: number;
  approvedBy: string;

  title: string;
  authorName?: string | null;

  sourceUrl?: string | null;
  sourceSite?: string | null;

  coverUrl?: string | null;
  synopsis?: string | null;

  primaryGenre?: string | null;
  tags?: string[];

  status?: string | null;
  translationStatus?: string | null;

  chaptersTotal?: number | null;
  country?: string | null;
};

export type ApproveImportResult =
  | {
      success: true;
      action: "created";
      novelId: number;
      slug: string;
    }
  | {
      success: true;
      action: "merged";
      novelId: number;
      slug: string;
    }
  | {
      success: false;
      action: "needs_review";
      match: {
        novelId: number;
        title: string | null;
        author: string | null;
        matchType: string;
        confidence: number;
        reasons: string[];
      };
    };

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTag(tag: string) {
  const cleaned = tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  const map: Record<string, string> = {
    cultivation_novel: "cultivation",
    cultivator: "cultivation",
    xianxia_novel: "xianxia",
    wuxia_novel: "wuxia",

    ruthless: "ruthless_mc",
    ruthless_protagonist: "ruthless_mc",

    villain_mc: "antihero",
    anti_hero: "antihero",

    overpowered: "op_mc",
    overpowered_mc: "op_mc",

    system_cheat: "system",
    game_system: "system",

    reincarnation: "transmigration",
    transmigrated: "transmigration",

    time_regression: "regression",

    kingdom: "kingdom_building",

    sect: "sect_politics",
    sect_building: "sect_politics",
  };

  return map[cleaned] || cleaned;
}

function normalizeGenre(
  raw: string | null | undefined
) {
  const g = normalizeTag(raw || "");

  const map: Record<string, string> = {
    cultivation: "xianxia",
    chinese_fantasy: "xianxia",

    progression: "progression_fantasy",
    progression_fantasy:
      "progression_fantasy",

    fantasy: "fantasy",

    xianxia: "xianxia",
    wuxia: "wuxia",
    xuanhuan: "xuanhuan",

    urban_cultivation: "urban",
    urban: "urban",

    sci_fantasy: "sci_fantasy",
    scifi: "sci_fantasy",
    sci_fi: "sci_fantasy",
  };

  return map[g] || g || null;
}

function cleanTags(
  tags: string[] | null | undefined
) {
  return Array.from(
    new Set(
      (tags || [])
        .map(normalizeTag)
        .filter(Boolean)
    )
  ).slice(0, 30);
}

function safeJsonParse(
  raw: string | null
) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function uniqueSlug(
  admin: ReturnType<typeof supabaseAdmin>,
  title: string
) {
  const baseSlug = slugify(title);

  if (!baseSlug) {
    throw new Error(
      "Could not create slug."
    );
  }

  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const {
      data: existing,
      error,
    } = await admin
      .from("novels")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function loadImport(
  admin: ReturnType<typeof supabaseAdmin>,
  importId: number
) {
  const {
    data,
    error,
  } = await admin
    .from("novel_import_queue")
    .select("*")
    .eq("id", importId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      `Import ${importId} was not found.`
    );
  }

  return data;
}

async function upsertNovelSource({
  admin,
  novelId,
  sourceUrl,
  sourceSite,
  title,
  authorName,
  coverUrl,
  synopsis,
  tags,
  sourceData,
  rawPayload,
}: {
  admin: ReturnType<typeof supabaseAdmin>;

  novelId: number;

  sourceUrl: string | null;
  sourceSite: string | null;

  title: string;
  authorName: string | null;

  coverUrl: string | null;
  synopsis: string | null;

  tags: string[];

  sourceData: any;
  rawPayload: any;
}) {
  if (
    !sourceUrl ||
    !sourceSite
  ) {
    return;
  }

  const now =
    new Date().toISOString();

  const {
    error,
  } = await admin
    .from("novel_sources")
    .upsert(
      {
        novel_id: novelId,

        source_site:
          sourceData?.source_site ||
          sourceSite,

        source_url:
          sourceData?.source_url ||
          sourceUrl,

        external_title:
          sourceData?.external_title ||
          title,

        external_author:
          sourceData?.external_author ||
          authorName ||
          null,

        external_rating:
          sourceData?.external_rating ??
          null,

        external_rating_count:
          sourceData?.external_rating_count ??
          null,

        external_review_count:
          sourceData?.external_review_count ??
          null,

        external_cover_url:
          sourceData?.external_cover_url ||
          coverUrl,

        external_synopsis:
          sourceData?.external_synopsis ||
          synopsis,

        external_genres:
          sourceData?.external_genres ||
          [],

        external_tags:
          sourceData?.external_tags ||
          tags,

        raw_payload: rawPayload,

        scraped_at: now,
        updated_at: now,
      },
      {
        onConflict: "source_url",
      }
    );

  if (error) {
    throw new Error(
      `Source insert failed: ${error.message}`
    );
  }
}

async function markApproved({
  admin,
  importId,
  approvedBy,
}: {
  admin: ReturnType<typeof supabaseAdmin>;
  importId: number;
  approvedBy: string;
}) {
  const now =
    new Date().toISOString();

  const {
    error,
  } = await admin
    .from("novel_import_queue")
    .update({
      status: "approved",
      approved_by: approvedBy,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", importId);

  if (error) {
    throw error;
  }
}

export async function approveImport(
  input: ApproveImportInput
): Promise<ApproveImportResult> {
  const admin =
    supabaseAdmin();

  const title =
    input.title.trim();

  if (!title) {
    throw new Error(
      "Title is required."
    );
  }

  const importRow =
    await loadImport(
      admin,
      input.importId
    );

  const authorName =
    input.authorName?.trim() ||
    null;

  const sourceUrl =
    input.sourceUrl?.trim() ||
    null;

  const sourceSite =
    input.sourceSite?.trim() ||
    null;

  const coverUrl =
    input.coverUrl?.trim() ||
    null;

  const synopsis =
    input.synopsis?.trim() ||
    null;

  const tags =
    cleanTags(input.tags);

  const primaryGenre =
    normalizeGenre(
      input.primaryGenre
    );

  const status =
    normalizeTag(
      input.status || "unknown"
    );

  const translationStatus =
    normalizeTag(
      input.translationStatus ||
      "unknown"
    );

  const chaptersTotal =
    typeof input.chaptersTotal ===
      "number" &&
    Number.isFinite(
      input.chaptersTotal
    ) &&
    input.chaptersTotal > 0
      ? input.chaptersTotal
      : null;

  const country =
    input.country?.trim() ||
    null;

  const rawPayload =
    safeJsonParse(
      importRow.raw_payload
    );

  const sourceData =
    rawPayload
      ?.source_data_for_novel_sources ||
    null;

  /*
   * 1. Check whether this should
   * attach to an existing canonical novel.
   */
  const match =
    await findNovelMatch({
      title,
      author: authorName,
      sourceUrl,
    });

  /*
   * 2. Uncertain match:
   * keep it in manual review.
   */
  if (
    requiresDuplicateReview(match) &&
    match.novelId !== null
  ) {
    return {
      success: false,
      action: "needs_review",

      match: {
        novelId:
          match.novelId,

        title:
          match.matchedTitle,

        author:
          match.matchedAuthor,

        matchType:
          match.matchType,

        confidence:
          match.confidence,

        reasons:
          match.reasons,
      },
    };
  }

  /*
   * 3. Strong duplicate:
   * attach source + merge metadata.
   */
  if (
    canAutoMerge(match) &&
    match.novelId !== null
  ) {
    const {
      data: novel,
      error,
    } = await admin
      .from("novels")
      .select(
        "id, slug, title"
      )
      .eq(
        "id",
        match.novelId
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (
      !novel?.id ||
      !novel.slug
    ) {
      throw new Error(
        "Matched canonical novel could not be loaded."
      );
    }

    await upsertNovelSource({
      admin,

      novelId: novel.id,

      sourceUrl,
      sourceSite,

      title,
      authorName,

      coverUrl,
      synopsis,

      tags,

      sourceData,
      rawPayload,
    });

    await mergeCanonicalNovel({
      novelId: novel.id,

      title,
      authorName,

      coverImageUrl:
        coverUrl,

      synopsis,

      primaryGenre,

      tags,

      status,

      chaptersTotal,

      country,
    });

    await markApproved({
      admin,
      importId:
        input.importId,
      approvedBy:
        input.approvedBy,
    });

    return {
      success: true,
      action: "merged",
      novelId: novel.id,
      slug: novel.slug,
    };
  }

  /*
   * 4. No matching canonical novel:
   * create one.
   */
  const slug =
    await uniqueSlug(
      admin,
      title
    );

  const {
    data: novel,
    error: novelError,
  } = await admin
    .from("novels")
    .insert({
      slug,
      title,

      author_name:
        authorName,

      source_site:
        sourceSite,

      source_url:
        sourceUrl,

      cover_image_url:
        coverUrl,

      synopsis,

      primary_genre:
        primaryGenre,

      tags,

      status,

      translation_status:
        translationStatus,

      chapters_total:
        chaptersTotal,

      country,
    })
    .select("id, slug")
    .single();

  if (
    novelError ||
    !novel?.id ||
    !novel.slug
  ) {
    throw new Error(
      novelError?.message ||
        "Failed to create novel."
    );
  }

  /*
   * 5. Attach source metadata.
   */
  await upsertNovelSource({
    admin,

    novelId:
      novel.id,

    sourceUrl,
    sourceSite,

    title,
    authorName,

    coverUrl,
    synopsis,

    tags,

    sourceData,
    rawPayload,
  });

  /*
   * 6. Mark import complete.
   */
  await markApproved({
    admin,

    importId:
      input.importId,

    approvedBy:
      input.approvedBy,
  });

  return {
    success: true,
    action: "created",
    novelId: novel.id,
    slug: novel.slug,
  };
}