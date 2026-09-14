// lib/novelImport/fetchSource.ts

export type FetchedNovelSource = {
  html: string;
  auxiliary: Record<string, string>;
};

function normalizeHostname(url: URL) {
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

async function fetchHtmlPage(
  url: string,
  controller: AbortController
) {
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
        "text/html,application/xhtml+xml,application/xml;q=0.9," +
        "image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (
    !contentType
      .toLowerCase()
      .includes("text/html")
  ) {
    throw new Error(
      `Unsupported content type: ${
        contentType || "unknown"
      }`
    );
  }

  return await response.text();
}

async function fetchMtlNovelAuxiliary(
  parsedUrl: URL,
  controller: AbortController
) {
  const auxiliary: Record<string, string> = {};

  const match = parsedUrl.pathname.match(
    /^\/info\/([^/]+)\/?$/i
  );

  const slug = match?.[1];

  if (!slug) {
    return auxiliary;
  }

  const chapterUrl =
    `https://mtlnovel.me/ajax/chapters/?slug=` +
    encodeURIComponent(slug);

  try {
    const response = await fetch(chapterUrl, {
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/125.0 Safari/537.36",
        Accept: "text/html,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: parsedUrl.toString(),
      },
    });

    if (response.ok) {
      auxiliary.chapters =
        await response.text();
    }
  } catch (error) {
    console.warn(
      "Optional MTLNovel auxiliary fetch failed:",
      error
    );
  }

  return auxiliary;
}

export async function fetchNovelSource(
  url: string
): Promise<FetchedNovelSource> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15_000);

  try {
    const parsedUrl = new URL(url);
    const hostname =
      normalizeHostname(parsedUrl);

    const html = await fetchHtmlPage(
      url,
      controller
    );

    let auxiliary: Record<string, string> = {};

    if (
      hostname === "mtlnovel.me" ||
      hostname.endsWith(".mtlnovel.me")
    ) {
      auxiliary =
        await fetchMtlNovelAuxiliary(
          parsedUrl,
          controller
        );
    }

    return {
      html,
      auxiliary,
    };
  } finally {
    clearTimeout(timeout);
  }
}