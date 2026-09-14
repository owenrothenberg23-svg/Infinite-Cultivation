// lib/novelImport/discovery/novelCool.ts

const NOVELCOOL_CATEGORY_BASE =
  "https://en.novelcool.com/category";

const DEFAULT_DELAY_MS = 200;

export type NovelCoolCategoryDiscoveryStats = {
  category: string;
  urls_discovered: number;
  pages_scanned: number;
  total_pages: number | null;
  stopped_early: boolean;
};

export type NovelCoolDiscoveryResult = {
  categories: string[];
  urls: string[];
  pages_scanned: number;
  stopped_early: boolean;
  category_stats: NovelCoolCategoryDiscoveryStats[];
};

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

function encodeCategory(category: string) {
  return encodeURIComponent(category.trim())
    .replace(/%20/g, "+");
}

function buildCategoryPageUrl(
  category: string,
  page: number
) {
  const encodedCategory =
    encodeCategory(category);

  if (page <= 1) {
    return `${NOVELCOOL_CATEGORY_BASE}/${encodedCategory}.html`;
  }

  return `${NOVELCOOL_CATEGORY_BASE}/${encodedCategory}_${page}.html`;
}

function normalizeNovelUrl(raw: string) {
  try {
    const url = new URL(
      raw,
      "https://www.novelcool.com"
    );

    const hostname = url.hostname
      .replace(/^www\./, "")
      .toLowerCase();

    if (
      hostname !== "novelcool.com" &&
      !hostname.endsWith(".novelcool.com")
    ) {
      return null;
    }

    if (
      !url.pathname
        .toLowerCase()
        .startsWith("/novel/")
    ) {
      return null;
    }

    if (
      !url.pathname
        .toLowerCase()
        .endsWith(".html")
    ) {
      return null;
    }

    url.protocol = "https:";
    url.hostname = "www.novelcool.com";
    url.hash = "";
    url.search = "";

    return url.toString();
  } catch {
    return null;
  }
}

function extractNovelUrls(html: string) {
  const urls: string[] = [];

  const matches = html.matchAll(
    /href=["']([^"']*\/novel\/[^"']+\.html)["']/gi
  );

  for (const match of matches) {
    const normalized =
      normalizeNovelUrl(match[1] || "");

    if (normalized) {
      urls.push(normalized);
    }
  }

  return Array.from(new Set(urls));
}

function extractTotalPages(html: string) {
  const centerMatch = html.match(
    /page-nav-center-num[^>]*>\s*\d+\s*\/\s*(\d+)/i
  );

  if (centerMatch?.[1]) {
    const parsed = Number(centerMatch[1]);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const allPagesMatch = html.match(
    /all_pages\s*=\s*["'](\d+)["']/i
  );

  if (allPagesMatch?.[1]) {
    const parsed = Number(
      allPagesMatch[1]
    );

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

async function fetchCategoryPage(
  url: string
) {
  const controller =
    new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/125.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":
          "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(
        `NovelCool discovery HTTP ${response.status}`
      );
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      !contentType
        .toLowerCase()
        .includes("text/html")
    ) {
      throw new Error(
        `Unexpected NovelCool content type: ${
          contentType || "unknown"
        }`
      );
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function cleanCategories(
  values: string[]
) {
  return Array.from(
    new Set(
      values
        .map((value) =>
          value.trim()
        )
        .filter(Boolean)
    )
  ).slice(0, 25);
}

async function discoverSingleCategory(
  options: {
    category: string;
    maxNovels: number;
    maxPages: number;
    delayMs: number;
  }
) {
  const discovered =
    new Set<string>();

  let pagesScanned = 0;
  let totalPages: number | null =
    null;

  for (
    let page = 1;
    page <= options.maxPages;
    page += 1
  ) {
    if (
      discovered.size >=
      options.maxNovels
    ) {
      break;
    }

    if (
      totalPages !== null &&
      page > totalPages
    ) {
      break;
    }

    const pageUrl =
      buildCategoryPageUrl(
        options.category,
        page
      );

    const html =
      await fetchCategoryPage(
        pageUrl
      );

    pagesScanned += 1;

    if (page === 1) {
      totalPages =
        extractTotalPages(html);
    }

    const pageUrls =
      extractNovelUrls(html);

    for (const url of pageUrls) {
      discovered.add(url);

      if (
        discovered.size >=
        options.maxNovels
      ) {
        break;
      }
    }

    if (pageUrls.length === 0) {
      break;
    }

    if (
      discovered.size <
        options.maxNovels &&
      options.delayMs > 0
    ) {
      await sleep(
        options.delayMs
      );
    }
  }

  const urls =
    Array.from(discovered).slice(
      0,
      options.maxNovels
    );

  return {
    category: options.category,
    urls,
    pages_scanned:
      pagesScanned,
    total_pages:
      totalPages,
    stopped_early:
      totalPages !== null
        ? pagesScanned <
          totalPages
        : urls.length >=
          options.maxNovels,
  };
}

export async function discoverNovelCoolUrls(
  options: {
    category?: string;
    categories?: string[];

    maxNovels: number;
    maxPages?: number;
    delayMs?: number;
  }
): Promise<NovelCoolDiscoveryResult> {
  const categories =
    cleanCategories(
      options.categories?.length
        ? options.categories
        : [
            options.category ||
              "Xianxia",
          ]
    );

  if (
    categories.length === 0
  ) {
    throw new Error(
      "At least one NovelCool category is required."
    );
  }

  const maxNovels = Math.max(
    1,
    Math.min(
      Math.floor(
        options.maxNovels
      ),
      10_000
    )
  );

  const maxPages = Math.max(
    1,
    Math.min(
      Math.floor(
        options.maxPages ??
          100
      ),
      250
    )
  );

  const delayMs = Math.max(
    0,
    Math.min(
      options.delayMs ??
        DEFAULT_DELAY_MS,
      5_000
    )
  );

  const allUrls =
    new Set<string>();

  const categoryStats:
    NovelCoolCategoryDiscoveryStats[] =
    [];

  let pagesScanned = 0;

  for (const category of categories) {
    if (
      allUrls.size >=
      maxNovels
    ) {
      break;
    }

    const remaining =
      maxNovels -
      allUrls.size;

    const result =
      await discoverSingleCategory({
        category,
        maxNovels:
          remaining,
        maxPages,
        delayMs,
      });

    let added = 0;

    for (const url of result.urls) {
      const before =
        allUrls.size;

      allUrls.add(url);

      if (
        allUrls.size >
        before
      ) {
        added += 1;
      }

      if (
        allUrls.size >=
        maxNovels
      ) {
        break;
      }
    }

    pagesScanned +=
      result.pages_scanned;

    categoryStats.push({
      category,
      urls_discovered:
        added,
      pages_scanned:
        result.pages_scanned,
      total_pages:
        result.total_pages,
      stopped_early:
        result.stopped_early,
    });

    if (
      allUrls.size <
        maxNovels &&
      delayMs > 0
    ) {
      await sleep(delayMs);
    }
  }

  return {
    categories:
      categoryStats.map(
        (stat) =>
          stat.category
      ),

    urls:
      Array.from(allUrls).slice(
        0,
        maxNovels
      ),

    pages_scanned:
      pagesScanned,

    stopped_early:
      allUrls.size >=
        maxNovels ||
      categoryStats.some(
        (stat) =>
          stat.stopped_early
      ),

    category_stats:
      categoryStats,
  };
}