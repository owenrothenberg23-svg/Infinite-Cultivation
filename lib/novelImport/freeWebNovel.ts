// lib/novelImport/freeWebNovel.ts

import type { ImportedNovelMetadata } from "./types";
import { parseGenericMetadata } from "./generic";

function decodeNumericEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (full, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);

      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : full;
    })
    .replace(/&#(\d+);/g, (full, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);

      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : full;
    });
}

function decodeHtml(value: string) {
  return decodeNumericEntities(value)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, `"`)
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeTag(value: string) {
  return decodeHtml(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map(normalizeTag)
        .filter(Boolean)
    )
  );
}

function numberFromText(value: string | null | undefined) {
  if (!value) return null;

  const match = value
    .replace(/,/g, "")
    .match(/\d+(?:\.\d+)?/);

  if (!match) return null;

  const parsed = Number(match[0]);

  return Number.isFinite(parsed) ? parsed : null;
}

function getNovelSlug(url: string) {
  try {
    const parts = new URL(url).pathname
      .split("/")
      .filter(Boolean);

    const novelIndex = parts.indexOf("novel");

    if (novelIndex === -1) return null;

    return parts[novelIndex + 1] || null;
  } catch {
    return null;
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Limits extraction to the top novel-information area.
 *
 * This helps prevent tags, authors and chapter numbers from recommended
 * novels farther down the page from contaminating the current novel.
 */
function getDetailBlock(html: string) {
  const summaryIndex = html.search(
    /(?:<h[1-6][^>]*>\s*)?SUMMARY(?:\s*<\/h[1-6]>)?/i
  );

  if (summaryIndex === -1) {
    return html.slice(0, 60_000);
  }

  const start = Math.max(0, summaryIndex - 25_000);
  const end = Math.min(html.length, summaryIndex + 5_000);

  return html.slice(start, end);
}

function extractJsonLdName(
  html: string,
  property: "author" | "name"
) {
  if (property === "author") {
    const authorObjectMatch = html.match(
      /"author"\s*:\s*\{[\s\S]{0,500}?"name"\s*:\s*"([^"]+)"/i
    );

    if (authorObjectMatch?.[1]) {
      return decodeHtml(authorObjectMatch[1]);
    }

    const authorStringMatch = html.match(
      /"author"\s*:\s*"([^"]+)"/i
    );

    if (authorStringMatch?.[1]) {
      return decodeHtml(authorStringMatch[1]);
    }

    return null;
  }

  const nameMatch = html.match(
    /"name"\s*:\s*"([^"]+)"/i
  );

  return nameMatch?.[1]
    ? decodeHtml(nameMatch[1])
    : null;
}

function extractAuthor(
  html: string,
  detailBlock: string,
  fallback: string | null
) {
  const jsonLdAuthor = extractJsonLdName(
    html,
    "author"
  );

  if (jsonLdAuthor) return jsonLdAuthor;

  const patterns = [
    /<a[^>]+href=["'][^"']*\/(?:author|authors)\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i,

    /<a[^>]+href=["'][^"']*(?:author|writer)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,

    /(?:author|writer)\s*:?\s*<\/?[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i,

    /(?:author|writer)\s*:?\s*<[^>]+>\s*([^<]{2,100})/i,
  ];

  for (const pattern of patterns) {
    const match = detailBlock.match(pattern);

    if (match?.[1]) {
      const value = stripTags(match[1]);

      if (value && value.length <= 120) {
        return value;
      }
    }
  }

  return fallback;
}

function extractGenres(detailBlock: string) {
  const matches = Array.from(
    detailBlock.matchAll(
      /<a[^>]+href=["'][^"']*\/(?:genre|genres)\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi
    )
  );

  const genreValues = matches.map((match) =>
    stripTags(match[1] || "")
  );

  return uniqueStrings(genreValues).slice(0, 30);
}

function extractRating(html: string) {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*\/\s*5\s*\(\s*([\d,]+)\s*(?:votes?|reviews?|ratings?)\s*\)/i,

    /"ratingValue"\s*:\s*"?(\d+(?:\.\d+)?)"?[\s\S]{0,300}?"ratingCount"\s*:\s*"?([\d,]+)"?/i,

    /"ratingCount"\s*:\s*"?([\d,]+)"?[\s\S]{0,300}?"ratingValue"\s*:\s*"?(\d+(?:\.\d+)?)"?/i,
  ];

  const standardMatch = html.match(patterns[0]);

  if (standardMatch) {
    return {
      rating: numberFromText(standardMatch[1]),
      ratingCount: numberFromText(standardMatch[2]),
    };
  }

  const orderedJsonLdMatch = html.match(patterns[1]);

  if (orderedJsonLdMatch) {
    return {
      rating: numberFromText(orderedJsonLdMatch[1]),
      ratingCount: numberFromText(
        orderedJsonLdMatch[2]
      ),
    };
  }

  const reversedJsonLdMatch = html.match(patterns[2]);

  if (reversedJsonLdMatch) {
    return {
      rating: numberFromText(
        reversedJsonLdMatch[2]
      ),
      ratingCount: numberFromText(
        reversedJsonLdMatch[1]
      ),
    };
  }

  return {
    rating: null,
    ratingCount: null,
  };
}

function extractStatus(detailBlock: string) {
  const match = detailBlock.match(
    /\b(ongoing|on\s*going|completed|complete|finished|hiatus|dropped)\b/i
  );

  if (!match?.[1]) return null;

  const normalized = match[1]
    .toLowerCase()
    .replace(/\s+/g, "");

  const map: Record<string, string> = {
    ongoing: "ongoing",
    completed: "completed",
    complete: "completed",
    finished: "completed",
    hiatus: "hiatus",
    dropped: "dropped",
  };

  return map[normalized] || normalized;
}

function extractSynopsis(
  html: string,
  fallback: string | null
) {
  const summaryPatterns = [
    /<h[1-6][^>]*>\s*SUMMARY\s*<\/h[1-6]>([\s\S]*?)(?:See all|Hide|Add to Library|Chapter list)/i,

    /SUMMARY\s*<\/[^>]+>([\s\S]*?)(?:See all|Hide|Add to Library|Chapter list)/i,

    /<div[^>]+class=["'][^"']*(?:summary|desc|description)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of summaryPatterns) {
    const match = html.match(pattern);

    if (!match?.[1]) continue;

    const synopsis = stripTags(match[1])
      .replace(/\bSee all\b.*$/i, "")
      .replace(/\bHide\b.*$/i, "")
      .trim();

    if (synopsis.length >= 20) {
      return synopsis;
    }
  }

  return fallback
    ? decodeHtml(fallback)
    : null;
}

function extractChapterTotal(
  html: string,
  url: string
) {
  const slug = getNovelSlug(url);

  if (!slug) return null;

  const escapedSlug = escapeRegExp(slug);

  const chapterPatterns = [
    new RegExp(
      `href=["'][^"']*\\/novel\\/${escapedSlug}\\/chapter-(\\d+)[^"']*["']`,
      "gi"
    ),

    new RegExp(
      `href=["'][^"']*\\/novel\\/${escapedSlug}\\/chapter[_/-]?(\\d+)[^"']*["']`,
      "gi"
    ),
  ];

  const chapterNumbers: number[] = [];

  for (const pattern of chapterPatterns) {
    for (const match of html.matchAll(pattern)) {
      const chapterNumber = Number(match[1]);

      if (
        Number.isFinite(chapterNumber) &&
        chapterNumber > 0
      ) {
        chapterNumbers.push(chapterNumber);
      }
    }
  }

  if (chapterNumbers.length > 0) {
    return Math.max(...chapterNumbers);
  }

  /**
   * Fallback for pages where chapter URLs are rendered differently.
   * We limit this to the "Latest Chapters" or "Chapter List" section
   * so recommendation cards do not affect the result.
   */
  const chapterSectionMatch = html.match(
    /(?:Latest Chapters|Chapter List)([\s\S]*?)(?:Comments|Same Author|Hot [^<]{0,40} Novels)/i
  );

  if (!chapterSectionMatch?.[1]) {
    return null;
  }

  const textChapterNumbers = Array.from(
    chapterSectionMatch[1].matchAll(
      /\bChapter\s+(\d+)\b/gi
    )
  )
    .map((match) => Number(match[1]))
    .filter(
      (number) =>
        Number.isFinite(number) && number > 0
    );

  return textChapterNumbers.length > 0
    ? Math.max(...textChapterNumbers)
    : null;
}

function inferPrimaryGenre(genres: string[]) {
  const genreSet = new Set(genres);

  const priority = [
    "xianxia",
    "wuxia",
    "xuanhuan",
    "progression_fantasy",
    "litrpg",
    "fantasy",
    "eastern",
    "sci-fi",
    "science_fiction",
    "romance",
    "mystery",
    "horror",
    "historical",
  ];

  for (const genre of priority) {
    if (genreSet.has(genre)) {
      if (genre === "litrpg") {
        return "progression_fantasy";
      }

      if (
        genre === "sci-fi" ||
        genre === "science_fiction"
      ) {
        return "sci_fantasy";
      }

      return genre;
    }
  }

  return genres[0] || null;
}

function extractCover(
  html: string,
  fallback: string | null
) {
  const jsonLdImage =
    html.match(
      /"image"\s*:\s*"([^"]+)"/i
    )?.[1] || null;

  if (jsonLdImage) {
    return decodeHtml(jsonLdImage)
      .replace(/\\\//g, "/")
      .trim();
  }

  const novelImagePatterns = [
    /<img[^>]+(?:class|id)=["'][^"']*(?:cover|book|novel)[^"']*["'][^>]+src=["']([^"']+)["']/i,

    /<img[^>]+src=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*(?:cover|book|novel)[^"']*["']/i,
  ];

  for (const pattern of novelImagePatterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return fallback;
}

export function parseFreeWebNovelMetadata(
  html: string,
  url: string
): ImportedNovelMetadata {
  const base = parseGenericMetadata(html, url);
  const detailBlock = getDetailBlock(html);

  const title =
    base.suggested_title ||
    extractJsonLdName(html, "name");

  const author = extractAuthor(
    html,
    detailBlock,
    base.suggested_author
  );

  const genres = extractGenres(detailBlock);
  const primaryGenre =
    inferPrimaryGenre(genres);

  const synopsis = extractSynopsis(
    html,
    base.suggested_synopsis
  );

  const cover = extractCover(
    html,
    base.suggested_cover_url
  );

  const { rating, ratingCount } =
    extractRating(detailBlock);

  const status = extractStatus(detailBlock);

  const chaptersTotal = extractChapterTotal(
    html,
    url
  );

  return {
    ...base,

    suggested_title: title,
    suggested_author: author,
    suggested_synopsis: synopsis,
    suggested_cover_url: cover,
    suggested_source_site: "freewebnovel.com",
    suggested_primary_genre: primaryGenre,
    suggested_tags: genres,

    external_title: title,
    external_author: author,
    external_synopsis: synopsis,
    external_cover_url: cover,
    external_genres: genres,
    external_tags: genres,
    external_rating: rating,
    external_rating_count: ratingCount,
    external_review_count: null,

    chapters_total: chaptersTotal,
    status,
    extraction_method: "free_web_novel",
  };
}