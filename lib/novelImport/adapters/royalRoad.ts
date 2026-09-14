// lib/novelImport/adapters/royalRoad.ts

import type { ImportedNovelMetadata } from "../types";
import type { NovelSourceAdapter } from "../registry/types";
import { parseGenericMetadata } from "../generic";

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
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, `"`)
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " "));
}

function numberFromText(value: string | null | undefined) {
  if (!value) return null;

  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);

  if (!match) return null;

  const parsed = Number(match[0]);

  return Number.isFinite(parsed) ? parsed : null;
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

function isUsefulTag(tag: string) {
  if (!tag || tag.length > 40) return false;

  const blocked = new Set([
    "free",
    "free_book",
    "free_books",
    "free_novel",
    "free_novels",
    "online",
    "web_fiction",
    "web_novel",
    "royal_road",
    "royalroad",
    "royalroadl",
    "rrl",
    "legends",
    "fiction",
    "novel",
    "book",
  ]);

  return !blocked.has(tag);
}

function uniqueUsefulTags(values: string[]) {
  return Array.from(
    new Set(
      values
        .map(normalizeTag)
        .filter(isUsefulTag)
    )
  ).slice(0, 30);
}

function inferPrimaryGenre(tags: string[]) {
  const tagSet = new Set(tags);

  if (
    tagSet.has("xianxia") ||
    tagSet.has("cultivation") ||
    tagSet.has("wuxia")
  ) {
    return "xianxia";
  }

  if (
    tagSet.has("litrpg") ||
    tagSet.has("gamelit") ||
    tagSet.has("progression") ||
    tagSet.has("progression_fantasy")
  ) {
    return "progression_fantasy";
  }

  if (
    tagSet.has("science_fiction") ||
    tagSet.has("sci_fi") ||
    tagSet.has("sci-fi")
  ) {
    return "sci_fantasy";
  }

  if (tagSet.has("fantasy")) {
    return "fantasy";
  }

  if (tagSet.has("horror")) {
    return "horror";
  }

  if (tagSet.has("romance")) {
    return "romance";
  }

  return null;
}

function extractStatus(html: string) {
  const explicitStatusPatterns = [
    /<span[^>]*class=["'][^"']*(?:label|status)[^"']*["'][^>]*>\s*(ongoing|completed|hiatus|dropped|stub)\s*<\/span>/i,
    /<div[^>]*class=["'][^"']*(?:label|status)[^"']*["'][^>]*>\s*(ongoing|completed|hiatus|dropped|stub)\s*<\/div>/i,
    /"status"\s*:\s*"(ongoing|completed|hiatus|dropped|stub)"/i,
  ];

  for (const pattern of explicitStatusPatterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  const fallback = html.match(
    /\b(ongoing|completed|hiatus|dropped|stub)\b/i
  );

  return fallback?.[1]?.toLowerCase() ?? null;
}

export function parseRoyalRoadMetadata(
  html: string,
  url: string
): ImportedNovelMetadata {
  const base = parseGenericMetadata(html, url);

  const authorMatch =
    html.match(
      /<a[^>]+href=["'][^"']*\/profile\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i
    ) ||
    html.match(
      /<span[^>]*class=["'][^"']*author[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    );

  const author = authorMatch?.[1]
    ? stripTags(authorMatch[1])
    : base.suggested_author;

  const structuredRatingMatch = html.match(
    /"ratingValue"\s*:\s*"?(\d+(?:\.\d+)?)"?/i
  );

  const fallbackRatingMatch = html.match(
    /rating[^0-9]{0,30}(\d+(?:\.\d+)?)/i
  );

  const structuredRatingCountMatch = html.match(
    /"ratingCount"\s*:\s*"?([\d,]+)"?/i
  );

  const fallbackRatingCountMatch = html.match(
    /ratings?[^0-9]{0,30}([\d,]+)/i
  );

  const reviewCountMatch =
    html.match(/"reviewCount"\s*:\s*"?([\d,]+)"?/i) ||
    html.match(/reviews?[^0-9]{0,30}([\d,]+)/i);

  const chapterCountMatch =
    html.match(/(\d[\d,]*)\s+chapters?/i) ||
    html.match(/chapters?[^0-9]{0,30}(\d[\d,]*)/i);

  const tagMatches = Array.from(
    html.matchAll(
      /<a[^>]+href=["'][^"']*(?:tag|tags|fiction-tag)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi
    )
  );

  const extractedTags = tagMatches.map((match) =>
    stripTags(match[1] || "")
  );

  const tags = uniqueUsefulTags([
    ...base.external_tags,
    ...extractedTags,
  ]);

  const rating =
    numberFromText(structuredRatingMatch?.[1]) ??
    numberFromText(fallbackRatingMatch?.[1]);

  const ratingCount =
    numberFromText(structuredRatingCountMatch?.[1]) ??
    numberFromText(fallbackRatingCountMatch?.[1]);

  const reviewCount = numberFromText(reviewCountMatch?.[1]);

  const chaptersTotal = numberFromText(chapterCountMatch?.[1]);
  const status = extractStatus(html);
  const primaryGenre = inferPrimaryGenre(tags);

  return {
    ...base,

    suggested_author: author,
    suggested_synopsis: base.suggested_synopsis
      ? decodeHtml(base.suggested_synopsis)
      : null,
    suggested_primary_genre: primaryGenre,
    suggested_tags: tags,

    external_author: author,
    external_synopsis: base.external_synopsis
      ? decodeHtml(base.external_synopsis)
      : null,
    external_genres: primaryGenre ? [primaryGenre] : [],
    external_tags: tags,
    external_rating: rating,
    external_rating_count: ratingCount,
    external_review_count: reviewCount,

    chapters_total: chaptersTotal,
    status,
    extraction_method: "royal_road",
  };
}

export const royalRoadAdapter: NovelSourceAdapter = {
  id: "royal_road",

  hostnames: ["royalroad.com"],

  supports(url) {
    const hostname = url.hostname
      .replace(/^www\./, "")
      .toLowerCase();

    return (
      hostname === "royalroad.com" ||
      hostname.endsWith(".royalroad.com")
    );
  },

  parse(html, url) {
    return parseRoyalRoadMetadata(html, url);
  },
};