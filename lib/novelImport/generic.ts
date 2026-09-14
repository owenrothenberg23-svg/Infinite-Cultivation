// lib/novelImport/generic.ts

import type { ImportedNovelMetadata } from "./types";

function sourceSiteFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

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

function getMeta(html: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapedKey}["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapedKey}["'][^>]*>`,
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

function getTitle(html: string) {
  const socialTitle =
    getMeta(html, "og:title") || getMeta(html, "twitter:title");

  if (socialTitle) {
    return socialTitle.split("|")[0].split(" - ")[0].trim();
  }

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);

  if (titleMatch?.[1]) {
    return decodeHtml(titleMatch[1])
      .split("|")[0]
      .split(" - ")[0]
      .trim();
  }

  return null;
}

function cleanTag(raw: string) {
  return decodeHtml(raw)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isUsefulTag(tag: string) {
  if (!tag) return false;

  // This removes giant SEO keyword strings like:
  // mother_of_learning_nobody103_free_books_online_web_fiction...
  if (tag.length > 40) return false;

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

function cleanTags(values: string[]) {
  return Array.from(
    new Set(
      values
        .map(cleanTag)
        .filter(isUsefulTag)
    )
  ).slice(0, 30);
}

export function parseGenericMetadata(
  html: string,
  url: string
): ImportedNovelMetadata {
  const sourceSite = sourceSiteFromUrl(url);
  const title = getTitle(html);

  const synopsis =
    getMeta(html, "og:description") ||
    getMeta(html, "twitter:description") ||
    getMeta(html, "description");

  const cover =
    getMeta(html, "og:image") ||
    getMeta(html, "twitter:image") ||
    getMeta(html, "twitter:image:src");

  const author = getMeta(html, "author");
  const keywords = getMeta(html, "keywords");

  const tags = keywords
    ? cleanTags(keywords.split(","))
    : [];

  return {
    source_url: url,
    source_site: sourceSite,

    suggested_title: title,
    suggested_author: author,
    suggested_synopsis: synopsis,
    suggested_cover_url: cover,
    suggested_source_site: sourceSite,
    suggested_primary_genre: null,
    suggested_tags: tags,

    external_title: title,
    external_author: author,
    external_synopsis: synopsis,
    external_cover_url: cover,
    external_genres: [],
    external_tags: tags,
    external_rating: null,
    external_rating_count: null,
    external_review_count: null,

    chapters_total: null,
    status: null,
    extraction_method: "generic_metadata",
  };
}