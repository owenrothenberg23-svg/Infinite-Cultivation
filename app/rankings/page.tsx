// app/rankings/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type Novel = {
  id: string;
  slug: string;
  title: string;
  synopsis: string | null;
  cover_image_url: string | null;
  view_count: number | null;
  avg_rating: number | null;
  rating_count: number | null;
  author_name: string | null;
  primary_genre: string | null;
  tags: string[] | null;
  status: string | null;
  chapters_total: number | null;
};

type SearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

function getParam(sp: Record<string, any>, key: string, fallback = "") {
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

function pretty(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp =
    searchParams && typeof (searchParams as any)?.then === "function"
      ? ((await searchParams) ?? {})
      : ((searchParams as any) ?? {});

  const list = getParam(sp, "list", "top");

  const sb = supabaseAdmin();

  let query = sb
    .from("novels")
    .select(
      "id, slug, title, synopsis, cover_image_url, view_count, avg_rating, rating_count, author_name, primary_genre, tags, status, chapters_total"
    )
    .limit(50);

  if (list === "trending") {
    query = query
      .order("view_count", { ascending: false })
      .order("created_at", { ascending: false });
  } else if (list === "new") {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query
      .order("avg_rating", { ascending: false })
      .order("view_count", { ascending: false });
  }

  const { data, error } = await query;
  const novels = (data as Novel[] | null) ?? [];

  const tabs = [
    ["top", "Top Rated"],
    ["trending", "Trending"],
    ["new", "Newest"],
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <header className="mb-6 space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Rankings</h1>
          <p className="text-sm text-gray-400">
            The highest-ranked cultivation novels, sagas, and webnovels.
          </p>
        </div>

        <div className="inline-flex rounded-full bg-gray-800 p-1 text-sm">
          {tabs.map(([value, label]) => (
            <Link
              key={value}
              href={`/rankings?list=${value}`}
              className={`rounded-full px-3 py-1 ${
                list === value
                  ? "bg-indigo-600 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </header>

      {error && (
        <p className="mb-4 text-sm text-red-400">Failed to load rankings.</p>
      )}

      {novels.length === 0 ? (
        <p className="text-sm text-gray-400">
          No ranked novels yet. Add novels to start building rankings.
        </p>
      ) : (
        <ol className="space-y-4">
          {novels.map((novel, index) => {
            const cover = (novel.cover_image_url || "").trim();
            const hasCover = !!cover && isAssetUrl(cover);

            return (
              <li
                key={novel.id}
                className="rounded-lg border border-white/5 bg-white/5 p-4 transition hover:border-indigo-500 hover:bg-white/10"
              >
                <Link href={`/novel/${novel.slug}`} className="block">
                  <div className="flex gap-4">
                    <div className="flex w-10 shrink-0 items-center justify-center text-2xl font-bold text-indigo-300">
                      #{index + 1}
                    </div>

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

                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-white">
                        {novel.title}
                      </h2>
                      <p className="text-xs text-gray-400">
                        by {novel.author_name || "Unknown author"}
                      </p>

                      {novel.synopsis ? (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-300">
                          {novel.synopsis}
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                        <span>{novel.view_count ?? 0} views</span>
                        <span>
                          ★{" "}
                          {typeof novel.avg_rating === "number" &&
                          novel.avg_rating > 0
                            ? novel.avg_rating.toFixed(1)
                            : "—"}
                          {novel.rating_count ? ` (${novel.rating_count})` : ""}
                        </span>
                        {novel.primary_genre && (
                          <span>{pretty(novel.primary_genre)}</span>
                        )}
                        {novel.status && <span>{pretty(novel.status)}</span>}
                        <span>{novel.chapters_total ?? "?"} chapters</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}