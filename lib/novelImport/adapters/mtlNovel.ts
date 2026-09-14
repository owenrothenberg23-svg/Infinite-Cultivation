// lib/novelImport/adapters/mtlNovel.ts

import type { ImportedNovelMetadata } from "../types";
import type {
  NovelParserContext,
  NovelSourceAdapter,
} from "../registry/types";
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
    new Set(values.map(normalizeTag).filter(Boolean))
  ).slice(0, 40);
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

function makeAbsoluteUrl(
  raw: string | null,
  baseUrl: string
) {
  if (!raw) return null;

  try {
    return new URL(decodeHtml(raw), baseUrl).toString();
  } catch {
    return raw;
  }
}

function extractInfoValue(
  html: string,
  label: string
) {
  const escaped = label.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const pattern = new RegExp(
    `<span[^>]*class=["'][^"']*text-bold[^"']*["'][^>]*>\\s*${escaped}\\s*:?\\s*<\\/span>\\s*<span[^>]*class=["'][^"']*pull-right[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`,
    "i"
  );

  const match = html.match(pattern);

  return match?.[1]
    ? stripTags(match[1])
    : null;
}

function extractTitle(
  html: string,
  fallback: string | null
) {
  const headingPatterns = [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<h2[^>]*>([\s\S]*?)<\/h2>/i,
  ];

  for (const pattern of headingPatterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      const value = stripTags(match[1]);

      if (value && !/^read\s+/i.test(value)) {
        return value;
      }
    }
  }

  if (fallback) {
    return fallback
      .replace(/^Read\s+/i, "")
      .replace(/\s+RAW English Translation.*$/i, "")
      .replace(/\s+-\s+MTL Novel.*$/i, "")
      .trim();
  }

  return null;
}

function extractAuthor(html: string) {
  const authorBlock = html.match(
    /<span[^>]*class=["'][^"']*text-bold[^"']*["'][^>]*>\s*Author:\s*<\/span>\s*<span[^>]*class=["'][^"']*pull-right[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
  );

  if (!authorBlock?.[1]) return null;

  const authorLink = authorBlock[1].match(
    /<a[^>]*>([\s\S]*?)<\/a>/i
  );

  return stripTags(
    authorLink?.[1] || authorBlock[1]
  );
}

function extractGenres(html: string) {
  const block = html.match(
    /<span[^>]*class=["'][^"']*text-bold[^"']*["'][^>]*>\s*Genres:\s*<\/span>\s*<span[^>]*class=["'][^"']*pull-right[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
  );

  if (!block?.[1]) return [];

  const links = Array.from(
    block[1].matchAll(
      /<a[^>]*>([\s\S]*?)<\/a>/gi
    )
  );

  return uniqueStrings(
    links.map((match) => stripTags(match[1] || ""))
  );
}

function extractStatus(html: string) {
  const value = extractInfoValue(
    html,
    "Status"
  );

  if (!value) return null;

  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  const map: Record<string, string> = {
    ongoing: "ongoing",
    on_going: "ongoing",
    completed: "completed",
    complete: "completed",
    finished: "completed",
    dropped: "dropped",
    hiatus: "hiatus",
    hiatused: "hiatus",
  };

  return map[normalized] || normalized;
}

function extractAlternativeTitle(html: string) {
  return extractInfoValue(
    html,
    "Alternative"
  );
}

function extractRating(html: string) {
  const patterns = [
    /class=["'][^"']*score[^"']*["'][^>]*title=["']Average rating\s+(\d+(?:\.\d+)?)/i,

    /<span[^>]*class=["'][^"']*rating[^"']*["'][^>]*>[\s\S]*?<span>\s*(\d+(?:\.\d+)?)\s*<\/span>/i,

    /Average rating\s+(\d+(?:\.\d+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return numberFromText(match[1]);
    }
  }

  return null;
}

function extractRatingCount(html: string) {
  const patterns = [
    /([\d,]+)\s+(?:votes?|ratings?)/i,
    /(?:votes?|ratings?)\s*:?\s*([\d,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return numberFromText(match[1]);
    }
  }

  return null;
}

function extractKeywords(html: string) {
  const match = html.match(
    /<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']*)["'][^>]*>/i
  );

  if (!match?.[1]) return [];

  return uniqueStrings(
    decodeHtml(match[1])
      .split(",")
      .map((tag) => tag.trim())
  );
}

function extractDescription(html: string) {
  const meta =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i
    )?.[1] ||
    html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i
    )?.[1];

  if (!meta) return null;

  let description = decodeHtml(meta);

  description = description
    .replace(
      /^Read\s+.+?\s+RAW in English\.\s*/i,
      ""
    )
    .trim();

  return description || null;
}

function extractCover(
  html: string,
  url: string
) {
  const raw =
    html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    )?.[1] || null;

  return makeAbsoluteUrl(raw, url);
}

function extractChapterTotal(
  chapterHtml: string | undefined
) {
  if (!chapterHtml) return null;

  const chapterNumbers = Array.from(
    chapterHtml.matchAll(
      /(?:chapter-|<strong>\s*Chapter\s+)(\d+)/gi
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

  if (values.has("fantasy")) {
    return "fantasy";
  }

  if (
    values.has("science_fiction") ||
    values.has("sci-fi")
  ) {
    return "sci_fantasy";
  }

  if (values.has("urban")) {
    return "urban";
  }

  return genres[0] || null;
}

export function parseMtlNovelMetadata(
  html: string,
  url: string,
  context?: NovelParserContext
): ImportedNovelMetadata {
  const base =
    parseGenericMetadata(html, url);

  const title = extractTitle(
    html,
    base.suggested_title
  );

  const alternativeTitle =
    extractAlternativeTitle(html);

  const author =
    extractAuthor(html) ||
    base.suggested_author;

  const genres = extractGenres(html);
  const keywordTags =
    extractKeywords(html);

  const tags = uniqueStrings([
    ...genres,
    ...keywordTags,
  ]);

  const status = extractStatus(html);
  const rating = extractRating(html);
  const ratingCount =
    extractRatingCount(html);

  const synopsis =
    extractDescription(html) ||
    base.suggested_synopsis;

  const cover =
    extractCover(html, url) ||
    base.suggested_cover_url;

  const chaptersTotal =
    extractChapterTotal(
      context?.auxiliary?.chapters
    );

  const primaryGenre =
    inferPrimaryGenre(genres);

  return {
    ...base,

    suggested_title: title,
    suggested_author: author,
    suggested_synopsis: synopsis,
    suggested_cover_url: cover,
    suggested_source_site: "mtlnovel.me",
    suggested_primary_genre: primaryGenre,
    suggested_tags: tags,

    external_title:
      alternativeTitle
        ? `${title || ""} / ${alternativeTitle}`.trim()
        : title,
    external_author: author,
    external_synopsis: synopsis,
    external_cover_url: cover,
    external_genres: genres,
    external_tags: tags,
    external_rating: rating,
    external_rating_count: ratingCount,
    external_review_count: null,

    chapters_total: chaptersTotal,
    status,
    extraction_method: "mtl_novel",
  };
}

export const mtlNovelAdapter: NovelSourceAdapter = {
  id: "mtl_novel",

  hostnames: ["mtlnovel.me"],

  supports(url) {
    const hostname = url.hostname
      .replace(/^www\./, "")
      .toLowerCase();

    return (
      hostname === "mtlnovel.me" ||
      hostname.endsWith(".mtlnovel.me")
    );
  },

  parse(html, url, context) {
    return parseMtlNovelMetadata(
      html,
      url,
      context
    );
  },
};