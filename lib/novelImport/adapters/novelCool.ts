// lib/novelImport/adapters/novelCool.ts

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

  return decoded
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  );
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

function extractBookName(html: string) {
  const scriptMatch = html.match(
    /var\s+BOOK_NAME\s*=\s*["']([^"']+)["']/i
  );

  if (scriptMatch?.[1]) {
    return decodeHtml(scriptMatch[1]);
  }

  const titleMatch = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  if (!titleMatch?.[1]) return null;

  return decodeHtml(titleMatch[1])
    .replace(/\s+Novel,.*$/i, "")
    .replace(/\s+-\s+Novel Cool.*$/i, "")
    .trim();
}

function extractCover(html: string) {
  const scriptMatch = html.match(
    /var\s+BOOK_COVER\s*=\s*["']([^"']+)["']/i
  );

  if (scriptMatch?.[1]) {
    return decodeHtml(scriptMatch[1]);
  }

  const imageMatch = html.match(
    /<img[^>]+class=["'][^"']*bookinfo-pic-img[^"']*["'][^>]+src=["']([^"']+)["']/i
  );

  return imageMatch?.[1]
    ? decodeHtml(imageMatch[1])
    : null;
}

function extractAuthor(html: string) {
  const creatorMatch = html.match(
    /<span[^>]+itemprop=["']creator["'][^>]*>([\s\S]*?)<\/span>/i
  );

  if (creatorMatch?.[1]) {
    return stripTags(creatorMatch[1]);
  }

  const authorMatch = html.match(
    /Author:\s*&nbsp;\s*<\/span>\s*<a[^>]*>([\s\S]*?)<\/a>/i
  );

  return authorMatch?.[1]
    ? stripTags(authorMatch[1])
    : null;
}

function extractGenres(html: string) {
  const block = html.match(
    /Genres:\s*&nbsp;\s*<\/span>\s*<span[^>]+itemprop=["']keywords["'][^>]*>([\s\S]*?)<\/span>/i
  );

  if (!block?.[1]) {
    const directMatches = Array.from(
      html.matchAll(
        /<span[^>]+itemprop=["']keywords["'][^>]*>([\s\S]*?)<\/span>/gi
      )
    );

    return uniqueStrings(
      directMatches.map((match) =>
        stripTags(match[1] || "")
      )
    );
  }

  const linkMatches = Array.from(
    block[1].matchAll(
      /<a[^>]*>([\s\S]*?)<\/a>/gi
    )
  );

  return uniqueStrings(
    linkMatches.map((match) =>
      stripTags(match[1] || "")
    )
  );
}

function extractStatus(html: string) {
  const match = html.match(
    /Status:\s*&nbsp;\s*<\/span>\s*<a[^>]*>([\s\S]*?)<\/a>/i
  );

  if (!match?.[1]) return null;

  const normalized = stripTags(match[1])
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  const map: Record<string, string> = {
    ongoing: "ongoing",
    updated: "ongoing",
    completed: "completed",
    complete: "completed",
    finished: "completed",
    hiatus: "hiatus",
    dropped: "dropped",
  };

  return map[normalized] || normalized;
}

function extractSynopsis(html: string) {
  const itemPropMatch = html.match(
    /<span[^>]+itemprop=["']description["'][^>]*>([\s\S]*?)<\/span>/i
  );

  if (itemPropMatch?.[1]) {
    return stripTags(itemPropMatch[1]);
  }

  const summaryMatch = html.match(
    /<div[^>]+class=["'][^"']*bk-summary[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  );

  return summaryMatch?.[1]
    ? stripTags(summaryMatch[1])
    : null;
}

function extractChapterTotal(html: string) {
  const match = html.match(
    />\s*Chapters\s+([\d,]+)\s*</i
  );

  if (match?.[1]) {
    return numberFromText(match[1]);
  }

  const chapterNumbers = Array.from(
    html.matchAll(
      /Chapter[-\s]+(\d+)/gi
    )
  )
    .map((match) => Number(match[1]))
    .filter(
      (value) =>
        Number.isFinite(value) &&
        value > 0
    );

  if (chapterNumbers.length === 0) {
    return null;
  }

  return Math.max(...chapterNumbers);
}

function extractCommentCount(html: string) {
  const match = html.match(
    />\s*Comments\s+([\d,]+)\s*</i
  );

  return numberFromText(match?.[1]);
}

function extractRating(html: string) {
  // Primary NovelCool rating.
  // Example:
  // <span class="bookinfo-rate-val">5.0</span>
  const primaryMatch = html.match(
    /<span[^>]*class=["'][^"']*bookinfo-rate-val[^"']*["'][^>]*>\s*(\d+(?:\.\d+)?)\s*<\/span>/i
  );

  if (primaryMatch?.[1]) {
    const rating = numberFromText(
      primaryMatch[1]
    );

    if (
      rating !== null &&
      rating >= 0 &&
      rating <= 5
    ) {
      return rating;
    }
  }

  const fallbackPatterns = [
    /(\d+(?:\.\d+)?)\s*\/\s*5/i,
    /(?:rating|score)[^0-9]{0,40}(\d+(?:\.\d+)?)/i,
  ];

  for (const pattern of fallbackPatterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      const rating = numberFromText(
        match[1]
      );

      if (
        rating !== null &&
        rating >= 0 &&
        rating <= 5
      ) {
        return rating;
      }
    }
  }

  return null;
}

function extractRatingCount(html: string) {
  // Primary NovelCool vote count.
  // Example:
  // <span class="bookinfo-vote-num">
  //   ...<span>5041</span>&nbsp;Votes...
  // </span>
  const primaryMatch = html.match(
    /<span[^>]*class=["'][^"']*bookinfo-vote-num[^"']*["'][^>]*>[\s\S]*?<span[^>]*>\s*([\d,]+)\s*<\/span>[\s\S]*?Votes?/i
  );

  if (primaryMatch?.[1]) {
    return numberFromText(
      primaryMatch[1]
    );
  }

  const fallbackPatterns = [
    /([\d,]+)\s+Votes?\b/i,
    /([\d,]+)\s+(?:ratings?|votes?)\b/i,
    /(?:ratings?|votes?)\s*:?\s*([\d,]+)/i,
  ];

  for (const pattern of fallbackPatterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return numberFromText(
        match[1]
      );
    }
  }

  return null;
}

function inferPrimaryGenre(genres: string[]) {
  const values = new Set(genres);

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
    values.has("progression") ||
    values.has("progression_fantasy") ||
    values.has("litrpg")
  ) {
    return "progression_fantasy";
  }

  if (values.has("fantasy")) {
    return "fantasy";
  }

  if (
    values.has("science_fiction") ||
    values.has("sci_fi") ||
    values.has("sci-fi")
  ) {
    return "sci_fantasy";
  }

  if (values.has("urban")) {
    return "urban";
  }

  if (values.has("romance")) {
    return "romance";
  }

  return genres[0] || null;
}

export function parseNovelCoolMetadata(
  html: string,
  url: string
): ImportedNovelMetadata {
  const base =
    parseGenericMetadata(html, url);

  const title =
    extractBookName(html) ||
    base.suggested_title;

  const author =
    extractAuthor(html) ||
    base.suggested_author;

  const genres =
    extractGenres(html);

  const primaryGenre =
    inferPrimaryGenre(genres);

  const synopsis =
    extractSynopsis(html) ||
    base.suggested_synopsis;

  const cover =
    extractCover(html) ||
    base.suggested_cover_url;

  const status =
    extractStatus(html);

  const chaptersTotal =
    extractChapterTotal(html);

  const rating =
    extractRating(html);

  const ratingCount =
    extractRatingCount(html);

  const commentCount =
    extractCommentCount(html);

  const tags = uniqueStrings([
    ...genres,
    ...base.external_tags,
  ]);

  return {
    ...base,

    suggested_title: title,
    suggested_author: author,
    suggested_synopsis: synopsis,
    suggested_cover_url: cover,
    suggested_source_site:
      "novelcool.com",
    suggested_primary_genre:
      primaryGenre,
    suggested_tags: tags,

    external_title: title,
    external_author: author,
    external_synopsis: synopsis,
    external_cover_url: cover,
    external_genres: genres,
    external_tags: tags,
    external_rating: rating,
    external_rating_count:
      ratingCount,
    external_review_count:
      commentCount,

    chapters_total: chaptersTotal,
    status,
    extraction_method:
      "novel_cool",
  };
}

export const novelCoolAdapter: NovelSourceAdapter = {
  id: "novel_cool",

  hostnames: [
    "novelcool.com",
  ],

  supports(url) {
    const hostname = url.hostname
      .replace(/^www\./, "")
      .toLowerCase();

    return (
      hostname === "novelcool.com" ||
      hostname.endsWith(
        ".novelcool.com"
      )
    );
  },

  parse(html, url) {
    return parseNovelCoolMetadata(
      html,
      url
    );
  },
};