// lib/novelImport/dedupe/matchNovel.ts

import { supabaseAdmin } from "@/lib/supabaseServer";

import {
  normalizeAuthor,
  normalizeSourceUrl,
  normalizeTitle,
  stringSimilarity,
} from "./normalize";

export type NovelMatchType =
  | "exact_source"
  | "exact_title_author"
  | "possible_title"
  | "fuzzy"
  | "none";

export type NovelMatchResult = {
  matchType: NovelMatchType;
  confidence: number;
  novelId: number | null;
  matchedTitle: string | null;
  matchedAuthor: string | null;
  reasons: string[];
};

type CandidateNovel = {
  id: number;
  title: string;
  author_name: string | null;
  source_url: string | null;
};

type FindNovelMatchInput = {
  title: string;
  author?: string | null;
  sourceUrl?: string | null;
};

function noMatch(): NovelMatchResult {
  return {
    matchType: "none",
    confidence: 0,
    novelId: null,
    matchedTitle: null,
    matchedAuthor: null,
    reasons: [],
  };
}

function createResult(
  candidate: CandidateNovel,
  options: {
    matchType: NovelMatchType;
    confidence: number;
    reasons: string[];
  }
): NovelMatchResult {
  return {
    matchType: options.matchType,
    confidence: options.confidence,
    novelId: candidate.id,
    matchedTitle: candidate.title,
    matchedAuthor:
      candidate.author_name,
    reasons: options.reasons,
  };
}

export async function findNovelMatch(
  input: FindNovelMatchInput
): Promise<NovelMatchResult> {
  const admin = supabaseAdmin();

  const normalizedTitle =
    normalizeTitle(input.title);

  const normalizedAuthor =
    normalizeAuthor(input.author);

  const normalizedSourceUrl =
    normalizeSourceUrl(input.sourceUrl);

  if (!normalizedTitle) {
    return noMatch();
  }

  /*
   * 1. Exact source URL is the strongest
   * possible match.
   */
  if (normalizedSourceUrl) {
    const {
      data: sourceMatch,
      error: sourceError,
    } = await admin
      .from("novels")
      .select(
        "id, title, author_name, source_url"
      )
      .eq(
        "source_url",
        input.sourceUrl
      )
      .maybeSingle();

    if (sourceError) {
      throw sourceError;
    }

    if (sourceMatch) {
      return createResult(
        sourceMatch as CandidateNovel,
        {
          matchType: "exact_source",
          confidence: 1,
          reasons: [
            "Exact source URL match",
          ],
        }
      );
    }

    const {
      data: novelSourceMatch,
      error: novelSourceError,
    } = await admin
      .from("novel_sources")
      .select(
        `
          novel_id,
          novels (
            id,
            title,
            author_name,
            source_url
          )
        `
      )
      .eq(
        "source_url",
        input.sourceUrl
      )
      .maybeSingle();

    if (novelSourceError) {
      throw novelSourceError;
    }

    const linkedNovel =
      Array.isArray(
        novelSourceMatch?.novels
      )
        ? novelSourceMatch?.novels?.[0]
        : novelSourceMatch?.novels;

    if (linkedNovel) {
      return createResult(
        linkedNovel as CandidateNovel,
        {
          matchType: "exact_source",
          confidence: 1,
          reasons: [
            "Exact source URL already linked through novel_sources",
          ],
        }
      );
    }
  }

  /*
   * 2. Load plausible title candidates.
   *
   * ilike is intentionally broad here.
   * We do the actual normalization and
   * scoring in TypeScript.
   */
  const titleWords =
    normalizedTitle
      .split(" ")
      .filter(Boolean);

  const searchTerm =
    titleWords.length > 0
      ? titleWords[0]
      : normalizedTitle;

  const {
    data: candidatesData,
    error: candidatesError,
  } = await admin
    .from("novels")
    .select(
      "id, title, author_name, source_url"
    )
    .ilike(
      "title",
      `%${searchTerm}%`
    )
    .limit(100);

  if (candidatesError) {
    throw candidatesError;
  }

  const candidates =
    (
      candidatesData as
        | CandidateNovel[]
        | null
    ) ?? [];

  if (candidates.length === 0) {
    return noMatch();
  }

  let bestResult:
    | NovelMatchResult
    | null = null;

  for (const candidate of candidates) {
    const candidateTitle =
      normalizeTitle(
        candidate.title
      );

    const candidateAuthor =
      normalizeAuthor(
        candidate.author_name
      );

    const titleExact =
      candidateTitle ===
      normalizedTitle;

    const authorExact =
      Boolean(
        normalizedAuthor &&
          candidateAuthor &&
          normalizedAuthor ===
            candidateAuthor
      );

    /*
     * Exact normalized title + author
     * is strong enough to auto-match.
     */
    if (
      titleExact &&
      authorExact
    ) {
      return createResult(
        candidate,
        {
          matchType:
            "exact_title_author",
          confidence: 0.99,
          reasons: [
            "Exact normalized title match",
            "Exact normalized author match",
          ],
        }
      );
    }

    /*
     * Same title but author missing on
     * one side should be reviewed rather
     * than automatically merged.
     */
    if (
      titleExact &&
      (
        !normalizedAuthor ||
        !candidateAuthor
      )
    ) {
      const result =
        createResult(
          candidate,
          {
            matchType:
              "possible_title",
            confidence: 0.88,
            reasons: [
              "Exact normalized title match",
              "Author missing on one side",
            ],
          }
        );

      if (
        !bestResult ||
        result.confidence >
          bestResult.confidence
      ) {
        bestResult = result;
      }

      continue;
    }

    const titleSimilarity =
      stringSimilarity(
        normalizedTitle,
        candidateTitle
      );

    const authorSimilarity =
      normalizedAuthor &&
      candidateAuthor
        ? stringSimilarity(
            normalizedAuthor,
            candidateAuthor
          )
        : 0;

    let confidence =
      titleSimilarity;

    const reasons: string[] = [
      `Title similarity ${titleSimilarity.toFixed(3)}`,
    ];

    if (
      normalizedAuthor &&
      candidateAuthor
    ) {
      confidence =
        titleSimilarity * 0.8 +
        authorSimilarity * 0.2;

      reasons.push(
        `Author similarity ${authorSimilarity.toFixed(3)}`
      );
    }

    /*
     * Conservative fuzzy threshold.
     * These should be REVIEWED, not
     * automatically merged yet.
     */
    if (
      titleSimilarity >= 0.92 &&
      (
        !normalizedAuthor ||
        !candidateAuthor ||
        authorSimilarity >= 0.75
      )
    ) {
      const result =
        createResult(
          candidate,
          {
            matchType: "fuzzy",
            confidence,
            reasons,
          }
        );

      if (
        !bestResult ||
        result.confidence >
          bestResult.confidence
      ) {
        bestResult = result;
      }
    }
  }

  return bestResult ?? noMatch();
}

export function canAutoMerge(
  match: NovelMatchResult
) {
  return (
    match.matchType ===
      "exact_source" ||
    match.matchType ===
      "exact_title_author"
  );
}

export function requiresDuplicateReview(
  match: NovelMatchResult
) {
  return (
    match.matchType ===
      "possible_title" ||
    match.matchType ===
      "fuzzy"
  );
}