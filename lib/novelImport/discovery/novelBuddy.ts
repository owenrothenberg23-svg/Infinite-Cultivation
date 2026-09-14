const NOVELBUDDY_BASE = "https://novelbuddy.me";
const DEFAULT_DELAY_MS = 200;

export type NovelBuddyDiscoveryMode = "popular" | "genres";

export type NovelBuddyGenreStats = {
  genre: string;
  urls_discovered: number;
  pages_scanned: number;
  stopped_early: boolean;
};

export type NovelBuddyDiscoveryResult = {
  mode: NovelBuddyDiscoveryMode;
  urls: string[];
  pages_scanned: number;
  stopped_early: boolean;
  genres?: string[];
  genre_stats?: NovelBuddyGenreStats[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPopularPageUrl(page: number) {
  return page <= 1
    ? `${NOVELBUDDY_BASE}/popular`
    : `${NOVELBUDDY_BASE}/popular?page=${page}`;
}

function buildGenrePageUrl(
  genre: string,
  page: number,
  sort: string
) {
  const encodedGenre = encodeURIComponent(
    genre.trim().toLowerCase()
  );

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("sort", sort);
  params.set("status", "all");

  return `${NOVELBUDDY_BASE}/genres/${encodedGenre}?${params.toString()}`;
}

const RESERVED_ROOT_PATHS = new Set([
  "",
  "home",
  "popular",
  "latest",
  "ranking",
  "rankings",
  "browse",
  "search",
  "lists",
  "login",
  "register",
  "signup",
  "signin",
  "auth",
  "genres",
  "genre",
  "tags",
  "tag",
  "authors",
  "author",
  "users",
  "user",
  "comments",
  "comment",
  "bookmarks",
  "bookmark",
  "history",
  "settings",
  "profile",
  "contact",
  "dmca",
  "privacy-policy",
  "terms-of-service",
  "about",
  "api",
  "static",
  "_next",
  "mtl-novels",
]);

function normalizeNovelUrl(raw: string) {
  try {
    const url = new URL(raw, NOVELBUDDY_BASE);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();

    if (
      hostname !== "novelbuddy.me" &&
      !hostname.endsWith(".novelbuddy.me")
    ) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);

    if (segments.length !== 1) return null;

    const slug = segments[0].trim().toLowerCase();

    if (!slug || RESERVED_ROOT_PATHS.has(slug)) return null;

    if (
      slug.includes(".") ||
      slug.startsWith("_") ||
      slug.length < 2
    ) {
      return null;
    }

    url.protocol = "https:";
    url.hostname = "novelbuddy.me";
    url.pathname = `/${segments[0]}`;
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

function extractNovelUrls(html: string) {
  const urls: string[] = [];

  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const normalized = normalizeNovelUrl(match[1] || "");

    if (normalized) {
      urls.push(normalized);
    }
  }

  return Array.from(new Set(urls));
}

async function fetchListingPage(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

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
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(
        `NovelBuddy discovery HTTP ${response.status}`
      );
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (
      !contentType.toLowerCase().includes("text/html")
    ) {
      throw new Error(
        `Unexpected NovelBuddy content type: ${
          contentType || "unknown"
        }`
      );
    }

    const html = await response.text();

    if (
      /just a moment|cf-chl|challenge-platform/i.test(html)
    ) {
      throw new Error(
        "NovelBuddy returned a browser challenge instead of a catalog page."
      );
    }

    return html;
  } finally {
    clearTimeout(timeout);
  }
}

function cleanGenres(genres: string[]) {
  return Array.from(
    new Set(
      genres
        .map((genre) => genre.trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 25);
}

export async function discoverNovelBuddyPopularUrls(options: {
  maxNovels: number;
  maxPages?: number;
  delayMs?: number;
}): Promise<NovelBuddyDiscoveryResult> {
  const maxNovels = Math.max(
    1,
    Math.min(Math.floor(options.maxNovels), 10_000)
  );

  const maxPages = Math.max(
    1,
    Math.min(
      Math.floor(options.maxPages ?? 25),
      250
    )
  );

  const delayMs = Math.max(
    0,
    Math.min(
      options.delayMs ?? DEFAULT_DELAY_MS,
      5_000
    )
  );

  const discovered = new Set<string>();
  let pagesScanned = 0;

  for (
    let page = 1;
    page <= maxPages;
    page += 1
  ) {
    if (discovered.size >= maxNovels) {
      break;
    }

    const html = await fetchListingPage(
      buildPopularPageUrl(page)
    );

    pagesScanned += 1;

    const pageUrls = extractNovelUrls(html);

    if (pageUrls.length === 0) {
      break;
    }

    const before = discovered.size;

    for (const url of pageUrls) {
      discovered.add(url);

      if (discovered.size >= maxNovels) {
        break;
      }
    }

    if (
      page > 1 &&
      discovered.size === before
    ) {
      break;
    }

    if (
      discovered.size < maxNovels &&
      delayMs > 0
    ) {
      await sleep(delayMs);
    }
  }

  return {
    mode: "popular",
    urls: Array.from(discovered).slice(
      0,
      maxNovels
    ),
    pages_scanned: pagesScanned,
    stopped_early:
      discovered.size >= maxNovels ||
      pagesScanned >= maxPages,
  };
}

export async function discoverNovelBuddyGenreUrls(options: {
  genres: string[];
  maxNovels: number;
  maxPagesPerGenre?: number;
  startPage?: number;
  delayMs?: number;
  sort?: string;
}): Promise<NovelBuddyDiscoveryResult> {
  const genres = cleanGenres(options.genres);

  if (genres.length === 0) {
    throw new Error(
      "At least one NovelBuddy genre is required."
    );
  }

  const maxNovels = Math.max(
    1,
    Math.min(Math.floor(options.maxNovels), 10_000)
  );

  const maxPagesPerGenre = Math.max(
    1,
    Math.min(
      Math.floor(options.maxPagesPerGenre ?? 25),
      250
    )
  );

  const startPage = Math.max(
    1,
    Math.floor(options.startPage ?? 1)
  );

  const delayMs = Math.max(
    0,
    Math.min(
      options.delayMs ?? DEFAULT_DELAY_MS,
      5_000
    )
  );

  const sort = (
    options.sort || "views"
  )
    .trim()
    .toLowerCase();

  const discovered = new Set<string>();
  const genreStats: NovelBuddyGenreStats[] = [];

  let pagesScanned = 0;

  for (const genre of genres) {
    if (discovered.size >= maxNovels) {
      break;
    }

    const beforeGenre = discovered.size;

    let genrePagesScanned = 0;
    let genreStoppedEarly = false;

    const finalPage =
      startPage + maxPagesPerGenre - 1;

    for (
      let page = startPage;
      page <= finalPage;
      page += 1
    ) {
      if (discovered.size >= maxNovels) {
        genreStoppedEarly = true;
        break;
      }

      const html = await fetchListingPage(
        buildGenrePageUrl(
          genre,
          page,
          sort
        )
      );

      pagesScanned += 1;
      genrePagesScanned += 1;

      const pageUrls =
        extractNovelUrls(html);

      if (pageUrls.length === 0) {
        break;
      }

      const beforePage = discovered.size;

      for (const url of pageUrls) {
        discovered.add(url);

        if (
          discovered.size >= maxNovels
        ) {
          break;
        }
      }

      if (
        page > startPage &&
        discovered.size === beforePage
      ) {
        break;
      }

      if (
        discovered.size < maxNovels &&
        delayMs > 0
      ) {
        await sleep(delayMs);
      }
    }

    genreStats.push({
      genre,
      urls_discovered:
        discovered.size - beforeGenre,
      pages_scanned: genrePagesScanned,
      stopped_early:
        genreStoppedEarly ||
        genrePagesScanned >=
          maxPagesPerGenre,
    });

    if (
      discovered.size < maxNovels &&
      delayMs > 0
    ) {
      await sleep(delayMs);
    }
  }

  return {
    mode: "genres",
    genres: genreStats.map(
      (stat) => stat.genre
    ),
    urls: Array.from(discovered).slice(
      0,
      maxNovels
    ),
    pages_scanned: pagesScanned,
    stopped_early:
      discovered.size >= maxNovels ||
      genreStats.some(
        (stat) => stat.stopped_early
      ),
    genre_stats: genreStats,
  };
}