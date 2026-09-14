// app/library/page.tsx

import Link from "next/link";

import {
  DISCOVERY_CATEGORIES,
  getDiscoveryCategory,
  novelMatchesDiscoveryCategory,
} from "@/lib/novelDiscovery/taxonomy";

import { searchNovels } from "@/lib/novelDiscovery/searchNovels";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const MAX_LIBRARY_SCAN = 5000;
const RESULTS_LIMIT = 100;

type Novel = {
  id: string;
  slug: string;
  title: string;
  synopsis: string | null;
  cover_image_url: string | null;
  created_at: string;
  view_count: number | null;
  avg_rating: number | string | null;
  rating_count: number | null;
  author_name: string | null;
  primary_genre: string | null;
  tags: string[] | null;
  status: string | null;
  translation_status: string | null;
  chapters_total: number | null;
  source_site: string | null;
};

type SearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

type SearchParamsResolved =
  Record<string, string | string[] | undefined>;

const TAGS = [
  { value: "", label: "All tags" },
  { value: "system", label: "System" },
  { value: "cultivation", label: "Cultivation" },
  { value: "martial_arts", label: "Martial Arts" },
  { value: "transmigration", label: "Transmigration" },
  { value: "weak_to_strong", label: "Weak to Strong" },
  { value: "male_protagonist", label: "Male Protagonist" },
  { value: "female_protagonist", label: "Female Protagonist" },
  { value: "clever_protagonist", label: "Clever Protagonist" },
  { value: "ruthless_protagonist", label: "Ruthless Protagonist" },
  { value: "antihero_protagonist", label: "Antihero Protagonist" },
  { value: "alchemy", label: "Alchemy" },
  { value: "academy", label: "Academy" },
  { value: "harem", label: "Harem" },
  { value: "comedy", label: "Comedy" },
  { value: "romance", label: "Romance" },
  { value: "apocalypse", label: "Apocalypse" },
  { value: "magic", label: "Magic" },
  { value: "beast_companions", label: "Beast Companions" },
];

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

function getParam(
  sp: SearchParamsResolved,
  key: string,
  fallback = ""
) {
  const raw = sp[key];

  return typeof raw === "string"
    ? raw
    : Array.isArray(raw)
      ? raw[0] ?? fallback
      : fallback;
}

function buildLibraryHref(
  sp: SearchParamsResolved,
  patch: Record<string, string | null>
) {
  const params = new URLSearchParams();

  const q = patch.q ?? getParam(sp, "q");

  const category =
    patch.category ??
    getParam(
      sp,
      "category",
      getParam(sp, "genre")
    );

  const tag = patch.tag ?? getParam(sp, "tag");

  const sort =
    patch.sort ??
    getParam(sp, "sort", "newest");

  if (q?.trim()) params.set("q", q.trim());
  if (category?.trim()) params.set("category", category.trim());
  if (tag?.trim()) params.set("tag", tag.trim());
  if (sort?.trim()) params.set("sort", sort.trim());

  const qs = params.toString();

  return qs ? `/library?${qs}` : "/library";
}

function pretty(
  value: string | null | undefined
) {
  if (!value) return "";

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function prettySource(
  value: string | null | undefined
) {
  if (!value) return "Unknown source";

  const normalized = value.trim().toLowerCase();

  if (normalized === "novelbuddy.me") return "NovelBuddy";
  if (normalized === "novelcool.com") return "NovelCool";
  if (normalized === "royalroad.com") return "Royal Road";
  if (normalized === "mtlnovel.me") return "MTLNovel";
  if (normalized === "infinite_cultivation") {
    return "Infinite Cultivation";
  }

  if (normalized === "external") return "External";

  return value
    .replace(/^www\./i, "")
    .replace(/\.com$/i, "")
    .replace(/\.me$/i, "")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function numericValue(
  value: number | string | null | undefined
) {
  if (value === null || value === undefined) return 0;

  const parsed =
    typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function timestamp(
  value: string | null | undefined
) {
  if (!value) return 0;

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadCatalogNovels() {
  const sb = supabaseAdmin();
  const novels: Novel[] = [];

  let from = 0;

  while (novels.length < MAX_LIBRARY_SCAN) {
    const remaining = MAX_LIBRARY_SCAN - novels.length;
    const pageSize = Math.min(PAGE_SIZE, remaining);
    const to = from + pageSize - 1;

    const { data, error } = await sb
      .from("novels")
      .select(
        "id, slug, title, synopsis, cover_image_url, created_at, view_count, avg_rating, rating_count, author_name, primary_genre, tags, status, translation_status, chapters_total, source_site"
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return { novels, error };
    }

    const page = (data as Novel[] | null) ?? [];

    novels.push(...page);

    if (page.length < pageSize) break;

    from += page.length;
  }

  return {
    novels,
    error: null,
  };
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  let sp: SearchParamsResolved = {};

  if (searchParams) {
    const maybePromise = searchParams as any;

    sp =
      typeof maybePromise?.then === "function"
        ? ((await maybePromise) ?? {})
        : ((searchParams as SearchParamsResolved) ?? {});
  }

  const q = getParam(sp, "q").trim();

  const requestedCategory =
    getParam(
      sp,
      "category",
      getParam(sp, "genre", "")
    )
      .trim()
      .toLowerCase();

  const selectedCategory =
    getDiscoveryCategory(requestedCategory);

  const categorySlug = selectedCategory?.slug ?? "";

  const tag = getParam(sp, "tag").trim().toLowerCase();
  const sort = getParam(sp, "sort", "newest");

  const {
    novels: catalog,
    error,
  } = await loadCatalogNovels();

  const queryText = q.trim();

  let filtered = catalog.filter((novel) => {
    if (
      selectedCategory &&
      !novelMatchesDiscoveryCategory(
        novel,
        selectedCategory
      )
    ) {
      return false;
    }

    if (
      tag &&
      !(novel.tags || [])
        .map((value) => value.trim().toLowerCase())
        .includes(tag)
    ) {
      return false;
    }

    return true;
  });

  // Preserve relevance ordering from the shared search helper whenever
  // a search query is active.
  if (queryText) {
    filtered = searchNovels(filtered, queryText, {
      limit: MAX_LIBRARY_SCAN,
    }).map((result) => result.novel);
  } else if (sort === "trending") {
    filtered = [...filtered].sort(
      (a, b) =>
        numericValue(b.view_count) -
          numericValue(a.view_count) ||
        timestamp(b.created_at) -
          timestamp(a.created_at)
    );
  } else if (sort === "top") {
    filtered = [...filtered].sort(
      (a, b) =>
        numericValue(b.avg_rating) -
          numericValue(a.avg_rating) ||
        numericValue(b.rating_count) -
          numericValue(a.rating_count) ||
        numericValue(b.view_count) -
          numericValue(a.view_count)
    );
  } else {
    filtered = [...filtered].sort(
      (a, b) =>
        timestamp(b.created_at) -
        timestamp(a.created_at)
    );
  }

  const totalMatches = filtered.length;
  const novels = filtered.slice(0, RESULTS_LIMIT);

  const activeFilters = Boolean(
    q ||
      selectedCategory ||
      tag ||
      sort !== "newest"
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-gray-100">
      <header className="mb-8 space-y-5">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">
              Webnovel Database
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Explore Webnovels
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
              Search and discover webnovels from across platforms, genres,
              and communities.
            </p>

            {selectedCategory && (
              <p className="mt-2 text-sm text-indigo-200">
                Browsing{" "}
                <span className="font-semibold">
                  {selectedCategory.label}
                </span>{" "}
                novels
              </p>
            )}
          </div>

          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-sm">
            {[
              ["newest", "Newest"],
              ["trending", "Trending"],
              ["top", "Top Rated"],
            ].map(([value, label]) => (
              <Link
                key={value}
                href={buildLibraryHref(sp, { sort: value })}
                className={`rounded-full px-3 py-1.5 transition ${
                  sort === value
                    ? "bg-indigo-600 text-white"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link
            href={buildLibraryHref(sp, { category: "" })}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
              !selectedCategory
                ? "bg-white text-gray-950"
                : "border border-white/10 bg-white/5 text-gray-300 hover:text-white"
            }`}
          >
            All
          </Link>

          {DISCOVERY_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={buildLibraryHref(sp, {
                category: category.slug,
              })}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                categorySlug === category.slug
                  ? "bg-white text-gray-950"
                  : "border border-white/10 bg-white/5 text-gray-300 hover:text-white"
              }`}
            >
              {category.label}
            </Link>
          ))}
        </div>

        <form
          method="get"
          className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 shadow-lg shadow-black/10"
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                Search the database
              </label>

              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search novels, authors, genres, tags, or descriptions…"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#090d1a] px-3.5 py-2.5 text-sm text-gray-100 outline-none transition placeholder:text-gray-600 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                Tag
              </label>

              <select
                name="tag"
                defaultValue={tag}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#090d1a] px-3.5 py-2.5 text-sm text-gray-100 outline-none focus:border-indigo-500"
              >
                {TAGS.map((option) => (
                  <option
                    key={option.value || "all"}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="hidden"
              name="category"
              value={categorySlug}
            />

            <input
              type="hidden"
              name="sort"
              value={sort}
            />

            <div className="self-end">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:w-auto"
              >
                Search
              </button>
            </div>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
          <p>
            <span className="font-medium text-gray-300">
              {totalMatches.toLocaleString("en-US")}
            </span>{" "}
            {totalMatches === 1 ? "novel" : "novels"} found
            {totalMatches > RESULTS_LIMIT
              ? ` · showing first ${RESULTS_LIMIT}`
              : ""}
          </p>

          {activeFilters && (
            <Link
              href="/library"
              className="font-medium text-indigo-300 hover:text-indigo-200"
            >
              Clear filters
            </Link>
          )}
        </div>
      </header>

      {error && (
        <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load the complete novel library:{" "}
          {error.message}
        </div>
      )}

      {novels.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.025] p-8 text-center">
          <h2 className="font-semibold text-white">
            No novels found
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            Try another title, author, genre, or tag.
          </p>

          <Link
            href="/library"
            className="mt-4 inline-block text-sm font-semibold text-indigo-300 hover:text-indigo-200"
          >
            Clear search →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {novels.map((novel) => {
            const cover = (novel.cover_image_url || "").trim();
            const hasCover = !!cover && isAssetUrl(cover);
            const rating = numericValue(novel.avg_rating);

            return (
              <li
                key={novel.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition hover:border-indigo-400/40 hover:bg-white/[0.06]"
              >
                <Link
                  href={`/novel/${novel.slug}`}
                  className="block h-full p-4"
                >
                  <div className="flex h-full gap-4">
                    <div className="h-36 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30 shadow-lg">
                      {hasCover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt=""
                          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.025]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-white transition group-hover:text-indigo-200">
                            {novel.title}
                          </h2>

                          <p className="mt-1 truncate text-xs text-gray-400">
                            by {novel.author_name || "Unknown author"}
                          </p>
                        </div>

                        {rating > 0 && (
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-amber-300">
                              ★ {rating.toFixed(1)}
                            </p>

                            {novel.rating_count ? (
                              <p className="text-[10px] text-gray-500">
                                {novel.rating_count.toLocaleString("en-US")}{" "}
                                ratings
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded-full border border-sky-400/15 bg-sky-400/10 px-2 py-0.5 font-medium text-sky-200">
                          {prettySource(novel.source_site)}
                        </span>

                        {novel.primary_genre && (
                          <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 font-medium text-indigo-200">
                            {pretty(novel.primary_genre)}
                          </span>
                        )}

                        {novel.tags?.slice(0, 2).map((novelTag) => (
                          <span
                            key={novelTag}
                            className="rounded-full bg-white/5 px-2 py-0.5 text-gray-400"
                          >
                            {pretty(novelTag)}
                          </span>
                        ))}
                      </div>

                      {novel.synopsis ? (
                        <p className="mt-2 line-clamp-3 text-sm leading-5 text-gray-300">
                          {novel.synopsis}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm italic text-gray-500">
                          No synopsis yet.
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                        {novel.status && (
                          <span>{pretty(novel.status)}</span>
                        )}

                        {novel.status && (
                          <span className="text-gray-700">•</span>
                        )}

                        <span>
                          {novel.chapters_total ?? "?"} chapters
                        </span>

                        {novel.translation_status && (
                          <>
                            <span className="text-gray-700">•</span>
                            <span>
                              {pretty(novel.translation_status)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}