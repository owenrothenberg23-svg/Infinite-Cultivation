// lib/novelImport/adapters/novelBuddy.ts

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
  let decoded = value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, `"`)
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");

  decoded = decodeNumericEntities(decoded);
  decoded = decodeNumericEntities(decoded);

  return decoded.replace(/\s+/g, " ").trim();
}

function cleanExtractedText(value: string) {
  return decodeHtml(value)
    // Sentence punctuation followed immediately by a new sentence.
    .replace(/([.!?…][”’"'”]?)([A-Z“"'])/g, "$1 $2")

    // NovelBuddy occasionally joins adjacent rendered text nodes:
    // "RealmsMonsters", "creatureSuddenly", etc.
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")

    // Keep quote boundaries readable.
    .replace(/([a-z0-9])([“"])/g, "$1 $2")
    .replace(/([”"'])([A-Z])/g, "$1 $2")

    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return cleanExtractedText(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<\/div>/gi, " ")
      .replace(/<\/li>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  );
}

function normalizeTag(value: string) {
  return decodeHtml(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/\//g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isUsefulTag(tag: string) {
  if (!tag || tag.length > 50) return false;

  const blocked = new Set([
    "novelbuddy",
    "novel",
    "light_novel",
    "chinese_novel",
    "korean_novel",
    "reader",
    "novel_reader",
    "novel_viewer",
    "read_novel_android",
    "read_novel_ipad",
    "read_novel_iphone",
    "read_novel_mobile",
    "best_novel_website",
    "lists",
    "ranking",
    "browse",
    "mtl_novels",
    "home",
    "popular",
  ]);

  return !blocked.has(tag);
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map(normalizeTag)
        .filter(isUsefulTag)
    )
  ).slice(0, 40);
}

function numberFromText(
  value: string | null | undefined
) {
  if (!value) return null;

  const match = value
    .replace(/,/g, "")
    .match(/\d+(?:\.\d+)?/);

  if (!match) return null;

  const parsed = Number(match[0]);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function makeAbsoluteUrl(
  raw: string | null,
  baseUrl: string
) {
  if (!raw) return null;

  try {
    return new URL(
      decodeHtml(raw),
      baseUrl
    ).toString();
  } catch {
    return raw;
  }
}

function extractMeta(
  html: string,
  key: string
) {
  const escaped = key.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["'][^>]*>`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return null;
}

function extractJsonLdObjects(html: string) {
  const objects: Record<string, unknown>[] = [];

  const matches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of matches) {
    const raw = match[1]?.trim();

    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") {
            objects.push(item as Record<string, unknown>);
          }
        }
      } else if (parsed && typeof parsed === "object") {
        const object = parsed as Record<string, unknown>;
        const graph = object["@graph"];

        if (Array.isArray(graph)) {
          for (const item of graph) {
            if (item && typeof item === "object") {
              objects.push(item as Record<string, unknown>);
            }
          }
        }

        objects.push(object);
      }
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  return objects;
}

function findJsonLdNovel(html: string) {
  const objects = extractJsonLdObjects(html);

  for (const object of objects) {
    const rawType = object["@type"];

    const types = Array.isArray(rawType)
      ? rawType.map(String)
      : rawType
        ? [String(rawType)]
        : [];

    if (
      types.some((type) =>
        /book|creativework|novel/i.test(type)
      )
    ) {
      return object;
    }
  }

  return objects[0] || null;
}

function stringValue(value: unknown) {
  return typeof value === "string"
    ? decodeHtml(value)
    : null;
}

function extractTitle(
  html: string,
  fallback: string | null
) {
  const jsonLd = findJsonLdNovel(html);

  const structuredTitle =
    stringValue(jsonLd?.name) ||
    stringValue(jsonLd?.headline);

  if (structuredTitle) {
    return structuredTitle;
  }

  const h1Match = html.match(
    /<h1[^>]*>([\s\S]*?)<\/h1>/i
  );

  if (h1Match?.[1]) {
    const title = stripTags(h1Match[1]);

    if (title) return title;
  }

  const value =
    extractMeta(html, "og:title") ||
    fallback;

  if (!value) return null;

  return value
    .replace(/\s*[-|]\s*NovelBuddy.*$/i, "")
    .trim();
}

function extractAuthorFromJsonLd(
  html: string
) {
  const jsonLd = findJsonLdNovel(html);
  const author = jsonLd?.author;

  if (typeof author === "string") {
    return decodeHtml(author);
  }

  if (
    author &&
    typeof author === "object" &&
    !Array.isArray(author)
  ) {
    const name = (
      author as Record<string, unknown>
    ).name;

    if (typeof name === "string") {
      return decodeHtml(name);
    }
  }

  if (Array.isArray(author)) {
    for (const item of author) {
      if (typeof item === "string") {
        return decodeHtml(item);
      }

      if (item && typeof item === "object") {
        const name = (
          item as Record<string, unknown>
        ).name;

        if (typeof name === "string") {
          return decodeHtml(name);
        }
      }
    }
  }

  return null;
}

function extractAuthor(html: string) {
  const structured = extractAuthorFromJsonLd(html);

  if (structured) return structured;

  const authorLink = html.match(
    /<a[^>]+href=["'][^"']*\/authors\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i
  );

  if (authorLink?.[1]) {
    const author = stripTags(authorLink[1]);

    if (author) return author;
  }

  const fallback = html.match(
    /Author\s*:?\s*[\s\S]{0,250}?<a[^>]*>([\s\S]*?)<\/a>/i
  );

  return fallback?.[1]
    ? stripTags(fallback[1])
    : null;
}

function extractGenres(html: string) {
  const values: string[] = [];

  const matches = html.matchAll(
    /<a[^>]+href=["'][^"']*\/genres\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi
  );

  for (const match of matches) {
    if (match?.[1]) {
      values.push(stripTags(match[1]));
    }
  }

  return uniqueStrings(values);
}

function extractTags(html: string) {
  const values: string[] = [];

  const matches = html.matchAll(
    /<a[^>]+href=["'][^"']*\/tags\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi
  );

  for (const match of matches) {
    if (match?.[1]) {
      values.push(stripTags(match[1]));
    }
  }

  return uniqueStrings(values);
}

function extractSynopsis(
  html: string,
  fallback: string | null
) {
  const jsonLd = findJsonLdNovel(html);

  const structured =
    stringValue(jsonLd?.description);

  if (structured) {
    return stripTags(structured);
  }

  const meta =
    extractMeta(html, "og:description") ||
    extractMeta(html, "description");

  const value = meta || fallback;

  return value
    ? cleanExtractedText(
        decodeHtml(value)
          .replace(/\s*[-|]\s*NovelBuddy.*$/i, "")
      )
    : null;
}

function extractCover(
  html: string,
  url: string,
  fallback: string | null
) {
  const jsonLd = findJsonLdNovel(html);
  const image = jsonLd?.image;

  let structuredImage: string | null = null;

  if (typeof image === "string") {
    structuredImage = image;
  } else if (
    image &&
    typeof image === "object" &&
    !Array.isArray(image)
  ) {
    const imageUrl = (
      image as Record<string, unknown>
    ).url;

    if (typeof imageUrl === "string") {
      structuredImage = imageUrl;
    }
  }

  const raw =
    structuredImage ||
    extractMeta(html, "og:image") ||
    extractMeta(html, "twitter:image") ||
    fallback;

  return makeAbsoluteUrl(raw, url);
}

function extractRating(html: string) {
  const jsonLd = findJsonLdNovel(html);
  const aggregate = jsonLd?.aggregateRating;

  if (
    aggregate &&
    typeof aggregate === "object" &&
    !Array.isArray(aggregate)
  ) {
    const ratingValue = (
      aggregate as Record<string, unknown>
    ).ratingValue;

    const parsed = numberFromText(
      String(ratingValue ?? "")
    );

    if (
      parsed !== null &&
      parsed >= 0 &&
      parsed <= 5
    ) {
      return parsed;
    }
  }

  const visibleText = stripTags(html);

  const visibleMatch = visibleText.match(
    /\b(\d(?:\.\d{1,2}))\s+[\d,]+\s+Updated\b/i
  );

  if (visibleMatch?.[1]) {
    return numberFromText(visibleMatch[1]);
  }

  const structuredMatch = html.match(
    /"ratingValue"\s*:\s*"?(\d+(?:\.\d+)?)"?/i
  );

  return numberFromText(structuredMatch?.[1]);
}

function extractRatingCount(html: string) {
  const jsonLd = findJsonLdNovel(html);
  const aggregate = jsonLd?.aggregateRating;

  if (
    aggregate &&
    typeof aggregate === "object" &&
    !Array.isArray(aggregate)
  ) {
    const ratingCount = (
      aggregate as Record<string, unknown>
    ).ratingCount;

    const parsed = numberFromText(
      String(ratingCount ?? "")
    );

    if (parsed !== null) {
      return parsed;
    }
  }

  const visibleText = stripTags(html);

  // NovelBuddy's hero metadata is rendered like:
  // "Korean RELEASING 4.70 1,828 Updated 6 days ago"
  const heroMatch = visibleText.match(
    /\b\d(?:\.\d{1,2})\s+([\d,]+)\s+Updated\b/i
  );

  if (heroMatch?.[1]) {
    return numberFromText(heroMatch[1]);
  }

  const structuredMatch = html.match(
    /"ratingCount"\s*:\s*"?([\d,]+)"?/i
  );

  return numberFromText(structuredMatch?.[1]);
}

function extractReviewCount(html: string) {
  const visibleText = stripTags(html);

  // NovelBuddy renders:
  // "Chapters 999+ Reviews 26"
  const visibleMatch = visibleText.match(
    /\bReviews?\s+([\d,]+)/i
  );

  if (visibleMatch?.[1]) {
    return numberFromText(visibleMatch[1]);
  }

  const jsonLd = findJsonLdNovel(html);
  const aggregate = jsonLd?.aggregateRating;

  if (
    aggregate &&
    typeof aggregate === "object" &&
    !Array.isArray(aggregate)
  ) {
    const reviewCount = (
      aggregate as Record<string, unknown>
    ).reviewCount;

    return numberFromText(
      String(reviewCount ?? "")
    );
  }

  return null;
}

function extractChapterTotal(html: string) {
  const candidates: number[] = [];

  const visibleText = stripTags(html);

  const displayed = visibleText.match(
    /\bChapters?\s+([\d,]+)/i
  );

  if (displayed?.[1]) {
    const parsed = numberFromText(displayed[1]);

    if (parsed !== null && parsed > 0) {
      candidates.push(parsed);
    }
  }

  const chapterMatches = html.matchAll(
    /\/chapter-(\d+)(?:[-"'/?#]|$)/gi
  );

  for (const match of chapterMatches) {
    const parsed = Number(match[1]);

    if (
      Number.isFinite(parsed) &&
      parsed > 0
    ) {
      candidates.push(parsed);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return Math.max(...candidates);
}

function extractStatus(html: string) {
  const visibleText = stripTags(html);

  const match = visibleText.match(
    /\b(RELEASING|ONGOING|COMPLETED|COMPLETE|FINISHED|DROPPED|HIATUS|HIATUSED)\b/i
  );

  if (!match?.[1]) return null;

  const normalized = match[1]
    .toLowerCase()
    .replace(/\s+/g, "_");

  const map: Record<string, string> = {
    releasing: "ongoing",
    ongoing: "ongoing",
    completed: "completed",
    complete: "completed",
    finished: "completed",
    dropped: "dropped",
    hiatus: "hiatus",
    hiatused: "hiatus",
  };

  return map[normalized] || normalized;
}

function inferPrimaryGenre(
  genres: string[],
  tags: string[]
) {
  const values = new Set([
    ...genres,
    ...tags,
  ]);

  if (values.has("xianxia")) {
    return "xianxia";
  }

  if (values.has("wuxia")) {
    return "wuxia";
  }

  if (values.has("xuanhuan")) {
    return "xuanhuan";
  }

  if (
    values.has("cultivation") ||
    values.has("eastern_fantasy")
  ) {
    return "xianxia";
  }

  if (
    values.has("progression_fantasy") ||
    values.has("progression") ||
    values.has("litrpg")
  ) {
    return "progression_fantasy";
  }

  if (
    values.has("science_fiction") ||
    values.has("sci_fi") ||
    values.has("sci-fi")
  ) {
    return "sci_fantasy";
  }

  if (values.has("fantasy")) {
    return "fantasy";
  }

  if (values.has("urban")) {
    return "urban";
  }

  if (values.has("romance")) {
    return "romance";
  }

  if (values.has("horror")) {
    return "horror";
  }

  if (values.has("action")) {
    return "action";
  }

  return genres[0] || null;
}

export function parseNovelBuddyMetadata(
  html: string,
  url: string
): ImportedNovelMetadata {
  const base = parseGenericMetadata(html, url);

  const title =
    extractTitle(html, base.suggested_title);

  const author =
    extractAuthor(html) ||
    base.suggested_author;

  const genres = extractGenres(html);

  const sourceTags = extractTags(html);

  const tags = uniqueStrings([
    ...genres,
    ...sourceTags,
  ]);

  const primaryGenre =
    inferPrimaryGenre(genres, tags);

  const synopsis =
    extractSynopsis(
      html,
      base.suggested_synopsis
    );

  const cover =
    extractCover(
      html,
      url,
      base.suggested_cover_url
    );

  const rating =
    extractRating(html);

  const ratingCount =
    extractRatingCount(html);

  const reviewCount =
    extractReviewCount(html);

  const chaptersTotal =
    extractChapterTotal(html);

  const status =
    extractStatus(html);

  return {
    ...base,

    suggested_title: title,
    suggested_author: author,
    suggested_synopsis: synopsis,
    suggested_cover_url: cover,
    suggested_source_site: "novelbuddy.me",
    suggested_primary_genre: primaryGenre,
    suggested_tags: tags,

    external_title: title,
    external_author: author,
    external_synopsis: synopsis,
    external_cover_url: cover,
    external_genres: genres,
    external_tags: tags,
    external_rating: rating,
    external_rating_count: ratingCount,
    external_review_count: reviewCount,

    chapters_total: chaptersTotal,
    status,
    extraction_method: "novel_buddy",
  };
}

export const novelBuddyAdapter: NovelSourceAdapter = {
  id: "novel_buddy",

  hostnames: [
    "novelbuddy.me",
  ],

  supports(url) {
    const hostname = url.hostname
      .replace(/^www\./, "")
      .toLowerCase();

    return (
      hostname === "novelbuddy.me" ||
      hostname.endsWith(".novelbuddy.me")
    );
  },

  parse(html, url) {
    return parseNovelBuddyMetadata(
      html,
      url
    );
  },
};