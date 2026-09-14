// lib/novelImport/approval/eligibility.ts

export type AutoApprovalInput = {
  extractionStatus?: string | null;

  title?: string | null;
  author?: string | null;
  synopsis?: string | null;
  coverUrl?: string | null;

  sourceUrl?: string | null;
  sourceSite?: string | null;

  primaryGenre?: string | null;
  tags?: string[] | null;

  status?: string | null;
  chaptersTotal?: number | null;

  extractionMethod?: string | null;
};

export type AutoApprovalReason =
  | "extraction_not_successful"
  | "missing_title"
  | "missing_author"
  | "missing_synopsis"
  | "synopsis_too_short"
  | "missing_cover"
  | "invalid_cover_url"
  | "missing_source_url"
  | "invalid_source_url"
  | "missing_source_site"
  | "missing_genre"
  | "missing_chapter_count"
  | "invalid_chapter_count"
  | "missing_extraction_method";

export type AutoApprovalResult = {
  eligible: boolean;
  reasons: AutoApprovalReason[];
};

function hasText(
  value: string | null | undefined
) {
  return Boolean(value?.trim());
}

function isHttpUrl(
  value: string | null | undefined
) {
  if (!value) return false;

  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

export function checkAutoApprovalEligibility(
  input: AutoApprovalInput
): AutoApprovalResult {
  const reasons: AutoApprovalReason[] = [];

  if (input.extractionStatus !== "success") {
    reasons.push("extraction_not_successful");
  }

  if (!hasText(input.title)) {
    reasons.push("missing_title");
  }

  if (!hasText(input.author)) {
    reasons.push("missing_author");
  }

  if (!hasText(input.synopsis)) {
    reasons.push("missing_synopsis");
  } else if (input.synopsis!.trim().length < 80) {
    reasons.push("synopsis_too_short");
  }

  if (!hasText(input.coverUrl)) {
    reasons.push("missing_cover");
  } else if (!isHttpUrl(input.coverUrl)) {
    reasons.push("invalid_cover_url");
  }

  if (!hasText(input.sourceUrl)) {
    reasons.push("missing_source_url");
  } else if (!isHttpUrl(input.sourceUrl)) {
    reasons.push("invalid_source_url");
  }

  if (!hasText(input.sourceSite)) {
    reasons.push("missing_source_site");
  }

  if (!hasText(input.primaryGenre)) {
    reasons.push("missing_genre");
  }

  if (input.chaptersTotal === null ||
      input.chaptersTotal === undefined) {
    reasons.push("missing_chapter_count");
  } else if (
    !Number.isFinite(input.chaptersTotal) ||
    input.chaptersTotal <= 0
  ) {
    reasons.push("invalid_chapter_count");
  }

  if (!hasText(input.extractionMethod)) {
    reasons.push("missing_extraction_method");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}