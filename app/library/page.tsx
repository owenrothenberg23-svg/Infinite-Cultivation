// app/library/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type Novel = {
  id: string;
  slug: string;
  title: string;
  synopsis: string | null;
  cover_image_url: string | null;
  created_at: string;
  view_count: number | null;
  avg_rating: number | null;
  rating_count: number | null;
  author_name: string | null;
  primary_genre: string | null;
  tags: string[] | null;
  status: string | null;
  translation_status: string | null;
  chapters_total: number | null;
};

type SearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

type SearchParamsResolved = Record<string, string | string[] | undefined>;

const GENRES = [
  { value: "", label: "All genres" },
  { value: "xianxia", label: "Xianxia" },
  { value: "wuxia", label: "Wuxia" },
  { value: "xuanhuan", label: "Xuanhuan" },
  { value: "urban", label: "Urban Cultivation" },
  { value: "sci_fantasy", label: "Sci-Fantasy" },
];

const TAGS = [
  { value: "", label: "All tags" },
  { value: "ruthless_mc", label: "Ruthless MC" },
  { value: "system", label: "System" },
  { value: "regression", label: "Regression" },
  { value: "transmigration", label: "Transmigration" },
  { value: "sect_politics", label: "Sect Politics" },
  { value: "alchemy", label: "Alchemy" },
  { value: "academy", label: "Academy" },
  { value: "kingdom_building", label: "Kingdom Building" },
  { value: "slow_cultivation", label: "Slow Cultivation" },
  { value: "op_mc", label: "OP MC" },
];

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

function getParam(sp: SearchParamsResolved, key: string, fallback = "") {
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
  const genre = patch.genre ?? getParam(sp, "genre");
  const tag = patch.tag ?? getParam(sp, "tag");
  const sort = patch.sort ?? getParam(sp, "sort", "newest");

  if (q?.trim()) params.set("q", q.trim());
  if (genre?.trim()) params.set("genre", genre.trim());
  if (tag?.trim()) params.set("tag", tag.trim());
  if (sort?.trim()) params.set("sort", sort.trim());

  const qs = params.toString();
  return qs ? `/library?${qs}` : `/library`;
}

function pretty(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  const genre = getParam(sp, "genre");
  const tag = getParam(sp, "tag");
  const sort = getParam(sp, "sort", "newest");

  const sb = supabaseAdmin();

  let query = sb
    .from("novels")
    .select(
      "id, slug, title, synopsis, cover_image_url, created_at, view_count, avg_rating, rating_count, author_name, primary_genre, tags, status, translation_status, chapters_total"
    )
    .limit(50);

  if (q) {
    query = query.or(`title.ilike.%${q}%,synopsis.ilike.%${q}%`);
  }

  if (genre) query = query.eq("primary_genre", genre);
  if (tag) query = query.contains("tags", [tag]);

  if (sort === "trending") {
    query = query
      .order("view_count", { ascending: false })
      .order("created_at", { ascending: false });
  } else if (sort === "top") {
    query = query
      .order("avg_rating", { ascending: false })
      .order("view_count", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  const novels = (data as Novel[] | null) ?? [];
  const activeFilters = q || genre || tag || sort !== "newest";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <header className="mb-6 space-y-4">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold">Novel Database</h1>
            <p className="text-sm text-gray-400">
              Discover cultivation, xianxia, progression fantasy, and webnovel sagas.
            </p>
          </div>

          <div className="inline-flex rounded-full bg-gray-800 p-1 text-sm">
            {[
              ["newest", "Newest"],
              ["trending", "Trending"],
              ["top", "Top Rated"],
            ].map(([value, label]) => (
              <Link
                key={value}
                href={buildLibraryHref(sp, { sort: value })}
                className={`rounded-full px-3 py-1 ${
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

        <form
          method="get"
          className="grid gap-3 rounded-lg border border-white/10 bg-black/40 p-3 text-sm sm:grid-cols-[1fr_180px_180px_auto]"
        >
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-gray-400">
              Search
            </label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search title or synopsis…"
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-gray-400">
              Genre
            </label>
            <select
              name="genre"
              defaultValue={genre}
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100"
            >
              {GENRES.map((g) => (
                <option key={g.value || "all"} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-gray-400">
              Tag
            </label>
            <select
              name="tag"
              defaultValue={tag}
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100"
            >
              {TAGS.map((t) => (
                <option key={t.value || "all"} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <input type="hidden" name="sort" value={sort} />

          <div className="self-end">
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Apply
            </button>
          </div>
        </form>

        {activeFilters && (
          <p className="text-xs text-gray-400">
            Showing filtered database results.{" "}
            <Link href="/library" className="text-indigo-300 hover:underline">
              Clear filters
            </Link>
          </p>
        )}
      </header>

      {error && (
        <p className="mb-4 text-sm text-red-400">
          Failed to load novel database.
        </p>
      )}

      {novels.length === 0 ? (
        <p className="mt-8 text-sm text-gray-400">
          No novels match your current filters.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {novels.map((novel) => {
            const cover = (novel.cover_image_url || "").trim();
            const hasCover = !!cover && isAssetUrl(cover);

            return (
              <li
                key={novel.id}
                className="relative rounded-lg border border-white/5 bg-white/5 p-4 transition hover:border-indigo-500 hover:bg-white/10"
              >
                <Link href={`/novel/${novel.slug}`} className="block">
                  <div className="flex gap-4">
                    <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30">
                      {hasCover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="text-lg font-semibold text-white">
                        {novel.title}
                      </h2>

                      <p className="text-xs text-gray-400">
                        by {novel.author_name || "Unknown author"}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                        {novel.primary_genre && (
                          <span className="rounded-full bg-black/40 px-2 py-0.5 text-indigo-300">
                            {pretty(novel.primary_genre)}
                          </span>
                        )}

                        {novel.status && (
                          <span className="rounded-full bg-black/30 px-2 py-0.5 text-gray-300">
                            {pretty(novel.status)}
                          </span>
                        )}

                        {novel.tags?.slice(0, 4).map((tag) => (
                          <Link
                            key={tag}
                            href={buildLibraryHref(sp, { tag })}
                            className="rounded-full bg-black/30 px-2 py-0.5 text-gray-300 hover:text-white"
                          >
                            #{tag}
                          </Link>
                        ))}
                      </div>

                      {novel.synopsis ? (
                        <p className="line-clamp-2 text-sm text-gray-300">
                          {novel.synopsis}
                        </p>
                      ) : (
                        <p className="text-sm italic text-gray-500">
                          No synopsis yet.
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-400">
                        <span>{novel.view_count ?? 0} views</span>
                        <span>
                          ★{" "}
                          {typeof novel.avg_rating === "number" &&
                          novel.avg_rating > 0
                            ? novel.avg_rating.toFixed(1)
                            : "—"}
                          {novel.rating_count ? ` (${novel.rating_count})` : ""}
                        </span>
                        <span>{novel.chapters_total ?? "?"} chapters</span>
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