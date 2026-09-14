// app/rankings/page.tsx

import Link from "next/link";

import {
  rankNovels,
  type RankingNovel,
} from "@/lib/novelRanking/rankNovels";

import {
  DISCOVERY_CATEGORIES,
  getDiscoveryCategory,
  novelMatchesDiscoveryCategory,
} from "@/lib/novelDiscovery/taxonomy";

import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type SearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

type SourceRow = {
  novel_id: string | null;
  source_site: string;
  external_rating: number | string | null;
  external_rating_count: number | string | null;
  external_review_count: number | string | null;
};

function getParam(
  sp: Record<string, any>,
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

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

function pretty(
  value: string | null | undefined
) {
  if (!value) return "";

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettySource(
  value: string | null | undefined
) {
  if (!value) return "Unknown";

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
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}

function formatCount(
  value: number | null | undefined
) {
  const number =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : 0;

  return new Intl.NumberFormat("en-US", {
    notation: number >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(number);
}

function splitIntoBatches<T>(
  items: T[],
  size: number
) {
  const batches: T[][] = [];

  for (
    let index = 0;
    index < items.length;
    index += size
  ) {
    batches.push(
      items.slice(index, index + size)
    );
  }

  return batches;
}

function numberOrNull(
  value: number | string | null | undefined
) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp =
    searchParams &&
    typeof (searchParams as any)?.then === "function"
      ? ((await searchParams) ?? {})
      : ((searchParams as any) ?? {});

  const list = getParam(
    sp,
    "list",
    "top"
  );

  /*
   * `category` is our canonical discovery filter.
   *
   * Keep reading the old `genre` parameter as a compatibility
   * fallback so older ranking URLs continue to work.
   */
  const requestedCategory =
    getParam(
      sp,
      "category",
      getParam(sp, "genre", "")
    )
      .trim()
      .toLowerCase();

  const selectedCategory =
    getDiscoveryCategory(
      requestedCategory
    );

  const categorySlug =
    selectedCategory?.slug ?? "";

  const rankingMode:
    | "top"
    | "popular"
    | "new" =
    list === "popular"
      ? "popular"
      : list === "new"
        ? "new"
        : "top";

  const sb = supabaseAdmin();

  /*
   * Load the catalog first.
   *
   * We intentionally do NOT filter primary_genre in Supabase.
   * Discovery categories can match either primary_genre or tags.
   */
  const {
    data: novelData,
    error: novelError,
  } = await sb
    .from("novels")
    .select(
      `
        id,
        slug,
        title,
        synopsis,
        cover_image_url,
        author_name,
        primary_genre,
        tags,
        status,
        chapters_total,
        created_at,
        avg_rating,
        rating_count,
        view_count
      `
    )
    .limit(5000);

  const allNovels =
    (
      novelData as
        | Omit<
            RankingNovel,
            "sources"
          >[]
        | null
    ) ?? [];

  /*
   * Apply the shared discovery taxonomy.
   * Database metadata remains untouched.
   */
  const novels =
    selectedCategory
      ? allNovels.filter(
          (novel) =>
            novelMatchesDiscoveryCategory(
              novel,
              selectedCategory
            )
        )
      : allNovels;

  const novelIds =
    novels.map(
      (novel) => novel.id
    );

  const sourceMap = new Map<
    string,
    NonNullable<
      RankingNovel["sources"]
    >
  >();

  let sourceError:
    | string
    | null = null;

  if (novelIds.length > 0) {
    const idBatches =
      splitIntoBatches(
        novelIds,
        175
      );

    for (
      const batch of idBatches
    ) {
      const {
        data: sourceData,
        error,
      } = await sb
        .from("novel_sources")
        .select(
          `
            novel_id,
            source_site,
            external_rating,
            external_rating_count,
            external_review_count
          `
        )
        .in(
          "novel_id",
          batch
        );

      if (error) {
        sourceError =
          error.message;
        break;
      }

      for (
        const row of
          (sourceData as
            | SourceRow[]
            | null) ?? []
      ) {
        if (!row.novel_id) {
          continue;
        }

        const novelId =
          String(
            row.novel_id
          );

        const existing =
          sourceMap.get(
            novelId
          ) ?? [];

        existing.push({
          source_site:
            String(
              row.source_site
            ),

          external_rating:
            numberOrNull(
              row.external_rating
            ),

          external_rating_count:
            numberOrNull(
              row.external_rating_count
            ),

          external_review_count:
            numberOrNull(
              row.external_review_count
            ),
        });

        sourceMap.set(
          novelId,
          existing
        );
      }
    }
  }

  const rankingInput:
    RankingNovel[] =
    novels.map(
      (novel) => ({
        ...novel,

        avg_rating:
          numberOrNull(
            novel.avg_rating
          ),

        rating_count:
          numberOrNull(
            novel.rating_count
          ) ?? 0,

        view_count:
          numberOrNull(
            novel.view_count
          ) ?? 0,

        sources:
          sourceMap.get(
            novel.id
          ) ?? [],
      })
    );

  /*
   * Top Rated / Most Popular should not rank completely
   * signal-less novels.
   *
   * Recently Added can include everything.
   */
  const rankableInput =
    rankingMode === "new"
      ? rankingInput
      : rankingInput.filter(
          (novel) =>
            (novel.sources?.length ?? 0) > 0 ||
            (novel.rating_count ?? 0) > 0 ||
            (novel.view_count ?? 0) > 0
        );

  const ranked =
    rankNovels(
      rankableInput,
      rankingMode
    ).slice(0, 100);

  const tabs = [
    ["top", "Top Rated"],
    ["popular", "Most Popular"],
    ["new", "Recently Added"],
  ];

  function rankingHref(
    nextList: string,
    nextCategory =
      categorySlug
  ) {
    const params =
      new URLSearchParams();

    params.set(
      "list",
      nextList
    );

    if (nextCategory) {
      params.set(
        "category",
        nextCategory
      );
    }

    return `/rankings?${params.toString()}`;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-gray-100">
      <header className="mb-7 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">
            Cross-Platform Webnovel Rankings
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Rankings
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">
            Compare top webnovels across platforms using ratings,
            popularity, reader activity, and source data.
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

        <div className="flex flex-wrap gap-2">
          {tabs.map(
            ([value, label]) => (
              <Link
                key={value}
                href={rankingHref(
                  value
                )}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  rankingMode === value
                    ? "bg-indigo-600 text-white"
                    : "border border-white/10 bg-white/5 text-gray-300 hover:border-white/20 hover:text-white"
                }`}
              >
                {label}
              </Link>
            )
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link
            href={rankingHref(
              rankingMode,
              ""
            )}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
              !selectedCategory
                ? "bg-white text-gray-950"
                : "border border-white/10 bg-white/5 text-gray-300 hover:text-white"
            }`}
          >
            All
          </Link>

          {DISCOVERY_CATEGORIES.map(
            (category) => (
              <Link
                key={category.slug}
                href={rankingHref(
                  rankingMode,
                  category.slug
                )}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                  selectedCategory?.slug === category.slug
                    ? "bg-white text-gray-950"
                    : "border border-white/10 bg-white/5 text-gray-300 hover:text-white"
                }`}
              >
                {category.label}
              </Link>
            )
          )}
        </div>
      </header>

      {novelError && (
        <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load novels:{" "}
          {novelError.message}
        </div>
      )}

      {sourceError && (
        <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load source ranking data:{" "}
          {sourceError}
        </div>
      )}

      {ranked.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-8 text-center">
          <h2 className="font-semibold text-white">
            No ranked novels found
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            Try another ranking or category.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {ranked.map(
            (
              novel,
              index
            ) => {
              const cover =
                (
                  novel.cover_image_url ||
                  ""
                ).trim();

              const hasCover =
                !!cover &&
                isAssetUrl(
                  cover
                );

              const rank =
                index + 1;

              const sources =
                novel.sources ?? [];

              const sourceNames =
                Array.from(
                  new Set(
                    sources
                      .map(
                        (source) =>
                          prettySource(
                            source.source_site
                          )
                      )
                      .filter(Boolean)
                  )
                );

              return (
                <li
                  key={novel.id}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition hover:border-indigo-400/40 hover:bg-white/[0.06]"
                >
                  <Link
                    href={`/novel/${novel.slug}`}
                    className="block p-4"
                  >
                    <div className="flex gap-4">
                      <div className="flex w-12 shrink-0 items-start justify-center pt-7">
                        <span
                          className={`text-2xl font-black ${
                            rank <= 3
                              ? "text-indigo-300"
                              : "text-gray-500"
                          }`}
                        >
                          #{rank}
                        </span>
                      </div>

                      <div className="h-32 w-[88px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30 shadow-lg">
                        {hasCover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover}
                            alt=""
                            className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="truncate text-lg font-semibold text-white transition group-hover:text-indigo-200">
                              {novel.title}
                            </h2>

                            <p className="mt-0.5 text-xs text-gray-400">
                              by{" "}
                              {novel.author_name ||
                                "Unknown author"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-indigo-400/15 bg-indigo-500/10 px-3 py-1.5 text-right">
                            <p className="text-[10px] uppercase tracking-wide text-indigo-300">
                              {rankingMode === "popular"
                                ? "Popularity"
                                : rankingMode === "new"
                                  ? "Added"
                                  : "Rank Score"}
                            </p>

                            <p className="text-sm font-bold text-white">
                              {rankingMode === "popular"
                                ? `${Math.round(
                                    novel.ranking.popularity_score *
                                      100
                                  )}`
                                : rankingMode === "new"
                                  ? formatDate(
                                      novel.created_at
                                    )
                                  : `${Math.round(
                                      novel.ranking.overall_score *
                                        100
                                    )}`}
                            </p>
                          </div>
                        </div>

                        {novel.synopsis ? (
                          <p className="mt-2 line-clamp-2 text-sm leading-5 text-gray-300">
                            {novel.synopsis}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-400">
                          {novel.primary_genre && (
                            <span className="font-medium text-indigo-200">
                              {pretty(
                                novel.primary_genre
                              )}
                            </span>
                          )}

                          {sourceNames.length > 0 && (
                            <span className="rounded-full border border-sky-400/15 bg-sky-400/10 px-2 py-0.5 font-medium text-sky-200">
                              {sourceNames
                                .slice(0, 2)
                                .join(" + ")}
                              {sourceNames.length > 2
                                ? ` +${sourceNames.length - 2}`
                                : ""}
                            </span>
                          )}

                          <span>
                            ★{" "}
                            {novel.ranking.external_rating !==
                            null
                              ? novel.ranking.external_rating.toFixed(
                                  2
                                )
                              : "—"}
                          </span>

                          <span>
                            {formatCount(
                              novel.ranking
                                .external_rating_count
                            )}{" "}
                            ratings
                          </span>

                          {novel.ranking
                            .external_review_count >
                            0 && (
                            <span>
                              {formatCount(
                                novel.ranking
                                  .external_review_count
                              )}{" "}
                              reviews
                            </span>
                          )}

                          <span>
                            {novel.ranking.source_count}{" "}
                            {novel.ranking.source_count === 1
                              ? "source"
                              : "sources"}
                          </span>

                          {novel.status && (
                            <span>
                              {pretty(
                                novel.status
                              )}
                            </span>
                          )}

                          <span>
                            {novel.chapters_total ?? "?"}{" "}
                            chapters
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            }
          )}
        </ol>
      )}
    </main>
  );
}