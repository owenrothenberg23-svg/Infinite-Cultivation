// app/rankings/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type Story = {
  id: string;
  title: string;
  public_summary: string | null;
  cover_image_url: string | null;
  view_count: number | null;
  avg_rating: number | null;
  author_username: string | null;
  primary_genre: string | null;
  tags: string[] | null;
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
    .from("stories")
    .select(
      "id, title, public_summary, cover_image_url, view_count, avg_rating, author_username, primary_genre, tags"
    )
    .eq("is_public", true)
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
  const stories = (data as Story[] | null) ?? [];

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
            The highest-ranked cultivation novels, sagas, and webnovels on Infinite Cultivation.
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

      {stories.length === 0 ? (
        <p className="text-sm text-gray-400">
          No ranked novels yet. Publish or add public novels to start building rankings.
        </p>
      ) : (
        <ol className="space-y-4">
          {stories.map((story, index) => {
            const cover = (story.cover_image_url || "").trim();
            const hasCover = !!cover && isAssetUrl(cover);

            return (
              <li
                key={story.id}
                className="rounded-lg border border-white/5 bg-white/5 p-4 transition hover:border-indigo-500 hover:bg-white/10"
              >
                <Link href={`/read/${story.id}`} className="block">
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
                        {story.title}
                      </h2>
                      <p className="text-xs text-gray-400">
                        by {story.author_username || "Unknown cultivator"}
                      </p>

                      {story.public_summary ? (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-300">
                          {story.public_summary}
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                        <span>{story.view_count ?? 0} views</span>
                        <span>
                          ★{" "}
                          {typeof story.avg_rating === "number" &&
                          story.avg_rating > 0
                            ? story.avg_rating.toFixed(1)
                            : "—"}
                        </span>
                        {story.primary_genre && <span>{story.primary_genre}</span>}
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