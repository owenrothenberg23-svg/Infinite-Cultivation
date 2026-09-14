"use client";

import Link from "next/link";
import { useState } from "react";

type SitemapDiscoveryResult = {
  success: boolean;
  job_id: number;
  sitemap_files_scanned: number;
  discovered: number;
  queued: number;
  skipped: number;
  limit_reached: boolean;
};

type NovelCoolCategoryStat = {
  category: string;
  urls_discovered: number;
  pages_scanned: number;
  total_pages: number | null;
  stopped_early: boolean;
};

type NovelCoolDiscoveryResult = {
  success: boolean;
  job_id: number;
  categories: string[];
  category_count: number;
  discovered: number;
  pages_scanned: number;
  stopped_early: boolean;
  category_stats: NovelCoolCategoryStat[];
  queued: number;
  skipped: number;
};

export default function CatalogDiscoveryPage() {
  const [name, setName] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [includePattern, setIncludePattern] = useState("");
  const [excludePattern, setExcludePattern] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SitemapDiscoveryResult | null>(null);
  const [error, setError] = useState("");

  const [novelCoolName, setNovelCoolName] = useState(
    "NovelCool Multi-Category Discovery"
  );
  const [novelCoolCategories, setNovelCoolCategories] = useState(
    "Xianxia, Xuanhuan, Wuxia, Fantasy"
  );
  const [novelCoolLimit, setNovelCoolLimit] = useState(750);
  const [novelCoolMaxPages, setNovelCoolMaxPages] = useState(25);
  const [novelCoolDelayMs, setNovelCoolDelayMs] = useState(200);

  const [novelCoolLoading, setNovelCoolLoading] = useState(false);
  const [novelCoolResult, setNovelCoolResult] =
    useState<NovelCoolDiscoveryResult | null>(null);
  const [novelCoolError, setNovelCoolError] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setResult(null);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/catalog-discovery",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            sitemap_url: sitemapUrl,
            include_pattern: includePattern,
            exclude_pattern: excludePattern,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Sitemap discovery failed."
        );
      }

      setResult(data as SitemapDiscoveryResult);
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Sitemap discovery failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleNovelCoolSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setNovelCoolLoading(true);
    setNovelCoolResult(null);
    setNovelCoolError("");

    try {
      const response = await fetch(
        "/api/admin/catalog-discovery/novelcool",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: novelCoolName,
            categories: novelCoolCategories,
            limit: novelCoolLimit,
            max_pages: novelCoolMaxPages,
            delay_ms: novelCoolDelayMs,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "NovelCool discovery failed."
        );
      }

      setNovelCoolResult(data as NovelCoolDiscoveryResult);
    } catch (caughtError: unknown) {
      setNovelCoolError(
        caughtError instanceof Error
          ? caughtError.message
          : "NovelCool discovery failed."
      );
    } finally {
      setNovelCoolLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
            Admin Tool
          </p>

          <h1 className="mt-1 text-3xl font-bold text-white">
            Catalog Discovery
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
            Discover novel URLs from supported catalog sources or
            authorized sitemaps and place them into the existing crawl
            queue.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/catalog-jobs"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Catalog Jobs
          </Link>

          <Link
            href="/admin/catalog-import"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            File Import
          </Link>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">
            Supported Source
          </p>

          <h2 className="mt-1 text-2xl font-bold text-white">
            NovelCool Category Discovery
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Scan NovelCool category pages, discover novel listing URLs,
            deduplicate them, and queue them for the existing catalog
            worker.
          </p>
        </div>

        <form onSubmit={handleNovelCoolSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-200">
              Catalog job name
            </span>
            <input
              value={novelCoolName}
              onChange={(event) => setNovelCoolName(event.target.value)}
              required
              maxLength={120}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
            />
          </label>

          <label className="mt-5 block text-sm">
            <span className="mb-1 block text-gray-200">
              Categories
            </span>
            <textarea
              value={novelCoolCategories}
              onChange={(event) =>
                setNovelCoolCategories(event.target.value)
              }
              required
              rows={3}
              placeholder="Xianxia, Xuanhuan, Wuxia, Fantasy"
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
            />
            <span className="mt-1 block text-xs text-gray-500">
              Comma-separated NovelCool categories. Duplicate novels found
              across categories are deduplicated before queueing.
            </span>
          </label>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-gray-200">
                Target novel count
              </span>
              <input
                type="number"
                min={1}
                max={10000}
                value={novelCoolLimit}
                onChange={(event) =>
                  setNovelCoolLimit(Number(event.target.value))
                }
                required
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Unique novels to discover across all selected categories.
              </span>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-gray-200">
                Max pages per category
              </span>
              <input
                type="number"
                min={1}
                max={250}
                value={novelCoolMaxPages}
                onChange={(event) =>
                  setNovelCoolMaxPages(Number(event.target.value))
                }
                required
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Caps how deeply each category is scanned.
              </span>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-gray-200">
                Delay between pages (ms)
              </span>
              <input
                type="number"
                min={0}
                max={5000}
                step={50}
                value={novelCoolDelayMs}
                onChange={(event) =>
                  setNovelCoolDelayMs(Number(event.target.value))
                }
                required
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Keep a small delay to avoid hammering the source.
              </span>
            </label>
          </div>

          <div className="mt-5 rounded-lg border border-indigo-500/20 bg-black/20 p-4">
            <p className="text-sm font-medium text-gray-200">
              Recommended first large run
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Xianxia, Xuanhuan, Wuxia, Fantasy · 750 novels · 25 pages
              per category · 200 ms delay.
            </p>
          </div>

          <button
            type="submit"
            disabled={novelCoolLoading}
            className="mt-5 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {novelCoolLoading
              ? "Discovering NovelCool..."
              : "Discover & Queue NovelCool"}
          </button>

          {novelCoolError && (
            <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-200">
                {novelCoolError}
              </p>
            </div>
          )}

          {novelCoolResult && (
            <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="font-semibold text-emerald-200">
                Catalog job #{novelCoolResult.job_id} created
              </p>

              <p className="mt-1 text-xs text-emerald-100/70">
                Categories: {novelCoolResult.categories.join(", ")}
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Stat label="Discovered" value={novelCoolResult.discovered} />
                <Stat label="Queued" value={novelCoolResult.queued} />
                <Stat label="Skipped" value={novelCoolResult.skipped} />
                <Stat label="Pages scanned" value={novelCoolResult.pages_scanned} />
                <Stat label="Categories scanned" value={novelCoolResult.category_count} />
              </div>

              {novelCoolResult.category_stats.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-lg border border-emerald-400/20">
                  <div className="grid grid-cols-4 gap-2 bg-black/20 px-3 py-2 text-xs font-semibold text-emerald-100">
                    <span>Category</span>
                    <span>Unique URLs</span>
                    <span>Pages</span>
                    <span>Total pages</span>
                  </div>

                  {novelCoolResult.category_stats.map((stat) => (
                    <div
                      key={stat.category}
                      className="grid grid-cols-4 gap-2 border-t border-emerald-400/10 px-3 py-2 text-xs text-emerald-100/80"
                    >
                      <span>{stat.category}</span>
                      <span>{stat.urls_discovered}</span>
                      <span>{stat.pages_scanned}</span>
                      <span>{stat.total_pages ?? "Unknown"}</span>
                    </div>
                  ))}
                </div>
              )}

              {novelCoolResult.stopped_early && (
                <p className="mt-3 text-xs text-yellow-200">
                  Discovery stopped after reaching the target novel count or
                  a configured page limit. More novels may still be available.
                </p>
              )}

              <Link
                href="/admin/catalog-jobs"
                className="mt-4 inline-flex rounded-md border border-emerald-400/30 px-4 py-2 text-sm font-semibold text-emerald-100 hover:border-emerald-300"
              >
                Open Catalog Jobs
              </Link>
            </div>
          )}
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
            Sitemap Import
          </p>

          <h2 className="mt-1 text-2xl font-bold text-white">
            Sitemap Discovery
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Discover listing URLs from an authorized sitemap and place
            matching pages into the existing catalog queue.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-200">
              Catalog job name
            </span>

            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              required
              placeholder="Authorized sitemap import"
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
            />
          </label>

          <label className="mt-5 block text-sm">
            <span className="mb-1 block text-gray-200">
              Sitemap URL
            </span>

            <input
              value={sitemapUrl}
              onChange={(event) =>
                setSitemapUrl(event.target.value)
              }
              required
              type="url"
              placeholder="https://example.com/sitemap.xml"
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
            />
          </label>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-gray-200">
                Include pattern
              </span>

              <input
                value={includePattern}
                onChange={(event) =>
                  setIncludePattern(event.target.value)
                }
                placeholder="/fiction/"
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
              />

              <span className="mt-1 block text-xs text-gray-500">
                Only URLs matching this text or regular expression will
                be queued.
              </span>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-gray-200">
                Exclude pattern
              </span>

              <input
                value={excludePattern}
                onChange={(event) =>
                  setExcludePattern(event.target.value)
                }
                placeholder="/chapter/"
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
              />

              <span className="mt-1 block text-xs text-gray-500">
                Matching URLs will be discarded.
              </span>
            </label>
          </div>

          <div className="mt-5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
            <p className="text-sm text-yellow-100">
              Use this only with sitemaps or feeds you are authorized
              to access and index.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-5 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Discovering URLs..."
              : "Create Job from Sitemap"}
          </button>

          {error && (
            <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-200">
                {error}
              </p>
            </div>
          )}

          {result && (
            <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="font-semibold text-emerald-200">
                Catalog job #{result.job_id} created
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <Stat
                  label="Sitemaps scanned"
                  value={result.sitemap_files_scanned}
                />

                <Stat
                  label="Discovered"
                  value={result.discovered}
                />

                <Stat
                  label="Queued"
                  value={result.queued}
                />

                <Stat
                  label="Skipped"
                  value={result.skipped}
                />
              </div>

              {result.limit_reached && (
                <p className="mt-3 text-xs text-yellow-200">
                  The 25,000 URL job limit was reached.
                </p>
              )}

              <Link
                href="/admin/catalog-jobs"
                className="mt-4 inline-flex rounded-md border border-emerald-400/30 px-4 py-2 text-sm font-semibold text-emerald-100 hover:border-emerald-300"
              >
                Open Catalog Jobs
              </Link>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold text-white">
        {value.toLocaleString()}
      </p>
    </div>
  );
}