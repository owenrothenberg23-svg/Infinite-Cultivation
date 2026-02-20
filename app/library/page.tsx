// app/library/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";
import StoryBookmarkButton from "@/components/StoryBookmarkButton";

export const dynamic = "force-dynamic";

type PublicStory = {
  id: string;
  title: string;
  public_summary: string | null;
  cover_image_url: string | null;
  created_at: string;
  view_count: number | null;
  avg_rating: number | null;
  author_username: string | null;
  primary_genre: string | null;
  tags: string[] | null;
};

type SearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

type SearchParamsResolved = Record<string, string | string[] | undefined>;

const GENRES: { value: string; label: string }[] = [
  { value: "", label: "All genres" },
  { value: "xianxia", label: "Xianxia" },
  { value: "wuxia", label: "Wuxia" },
  { value: "xuanhuan", label: "Xuanhuan" },
  { value: "urban", label: "Urban Cultivation" },
  { value: "sci_fantasy", label: "Sci-Fantasy" },
];

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  // Safely handle both: plain object or Promise-like (Next 15/16 patterns)
  let sp: SearchParamsResolved = {};

  if (searchParams) {
    const maybePromise = searchParams as any;
    if (typeof maybePromise?.then === "function") {
      sp = ((await maybePromise) ?? {}) as SearchParamsResolved;
    } else {
      sp = (searchParams as SearchParamsResolved) ?? {};
    }
  }

  const qRaw = sp["q"];
  const genreRaw = sp["genre"];

  const q =
    typeof qRaw === "string"
      ? qRaw.trim()
      : Array.isArray(qRaw)
      ? qRaw[0]?.trim() ?? ""
      : "";

  const genre =
    typeof genreRaw === "string"
      ? genreRaw
      : Array.isArray(genreRaw)
      ? genreRaw[0] ?? ""
      : "";

  // ✅ Public stories list (kept as admin read for stability)
  const sbAdmin = supabaseAdmin();

  let query = sbAdmin
    .from("stories")
    .select(
      "id, title, public_summary, cover_image_url, created_at, view_count, avg_rating, author_username, primary_genre, tags"
    )
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(30);

  if (q) {
    query = query.or(`title.ilike.%${q}%,public_summary.ilike.%${q}%`);
  }

  if (genre) {
    query = query.eq("primary_genre", genre);
  }

  const { data, error } = await query;
  const stories = (data as PublicStory[] | null) ?? [];
  const activeFilters = q || genre;

  // ✅ Determine logged-in user (cookie auth) and load their bookmarks
  const ssr = await supabaseServerClient();
  const { data: userData } = await ssr.auth.getUser();
  const user = userData?.user ?? null;

  let savedIds = new Set<string>();

  if (user && stories.length > 0) {
    const storyIds = stories.map((s) => s.id);

    const { data: bmRows } = await ssr
      .from("story_bookmarks")
      .select("story_id")
      .eq("user_id", user.id)
      .in("story_id", storyIds);

    if (bmRows && Array.isArray(bmRows)) {
      for (const r of bmRows as any[]) {
        if (r?.story_id) savedIds.add(String(r.story_id));
      }
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <header className="mb-6 space-y-4">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold">Public Stories</h1>
            <p className="text-sm text-gray-400">
              Browse sagas other cultivators have released into the world.
            </p>
          </div>

          <div className="inline-flex rounded-full bg-gray-800 p-1 text-sm">
            <button className="rounded-full bg-indigo-600 px-3 py-1 font-medium">
              Newest
            </button>
            <button className="rounded-full px-3 py-1 text-gray-300 hover:text-white">
              Trending
            </button>
            <button className="rounded-full px-3 py-1 text-gray-300 hover:text-white">
              Top Rated
            </button>
          </div>
        </div>

        <form
          method="get"
          className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/40 p-3 text-sm sm:flex-row sm:items-center"
        >
          <div className="flex-1">
            <label className="block text-xs uppercase tracking-[0.2em] text-gray-400">
              Search
            </label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search by title or summary…"
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-500"
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

          <div className="self-end">
            <button
              type="submit"
              className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 sm:mt-5"
            >
              Apply
            </button>
          </div>
        </form>

        {activeFilters && (
          <p className="text-xs text-gray-400">
            Showing results
            {q && (
              <>
                {" "}
                matching <span className="text-gray-200">“{q}”</span>
              </>
            )}
            {genre && (
              <>
                {" "}
                in{" "}
                <span className="text-gray-200">
                  {GENRES.find((g) => g.value === genre)?.label ?? genre}
                </span>
              </>
            )}
            .
          </p>
        )}
      </header>

      {error && (
        <p className="mb-4 text-sm text-red-400">Failed to load public stories.</p>
      )}

      {stories.length === 0 ? (
        <p className="mt-8 text-sm text-gray-400">
          {activeFilters
            ? "No stories match your current search/filters. Try clearing them or broadening your query."
            : "Gathering stories from the heavens… No public sagas yet. Once you publish a story, it will appear here."}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {stories.map((story) => {
            const author = story.author_username || "Unknown cultivator";
            const genreLabel =
              story.primary_genre &&
              (GENRES.find((g) => g.value === story.primary_genre)?.label ??
                story.primary_genre);

            const cover = (story.cover_image_url || "").trim();
            const hasCover = !!cover && isAssetUrl(cover);

            const isSaved = savedIds.has(story.id);

            return (
              <li
                key={story.id}
                className="relative transition rounded-lg border border-white/5 bg-white/5 p-4 hover:border-indigo-500 hover:bg-white/10"
              >
                {/* ✅ Save button (does not navigate) */}
                <div className="absolute right-4 top-4 z-10">
                  <StoryBookmarkButton
                    storyId={story.id}
                    initialSaved={isSaved}
                    isAuthed={!!user}
                  />
                </div>

                <Link href={`/read/${story.id}`} className="block">
                  <div className="flex gap-4">
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30">
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
                        {story.title}
                      </h2>
                      <p className="text-xs text-gray-400">by {author}</p>

                      {(genreLabel || (story.tags && story.tags.length > 0)) && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                          {genreLabel && (
                            <span className="rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-indigo-300">
                              {genreLabel}
                            </span>
                          )}
                          {story.tags?.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-black/30 px-2 py-0.5 text-[11px] text-gray-300"
                            >
                              #{tag}
                            </span>
                          ))}
                          {story.tags && story.tags.length > 3 && (
                            <span className="text-[11px] text-gray-500">
                              +{story.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {story.public_summary ? (
                        <p className="text-sm text-gray-300 line-clamp-2">
                          {story.public_summary}
                        </p>
                      ) : (
                        <p className="text-sm italic text-gray-500">
                          No summary yet.
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                        <span>
                          {story.view_count ?? 0}{" "}
                          {story.view_count === 1 ? "view" : "views"}
                        </span>

                        {typeof story.avg_rating === "number" &&
                        story.avg_rating > 0 ? (
                          <span>★ {story.avg_rating.toFixed(1)}</span>
                        ) : (
                          <span className="italic text-gray-500">
                            Not rated yet
                          </span>
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