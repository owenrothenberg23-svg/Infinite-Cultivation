// app/dashboard/page.tsx
import Link from "next/link";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const dynamic = "force-dynamic";

type CreatorStory = {
  id: string;
  title: string;
  created_at: string;
  last_chapter_number: number | null;
  is_public: boolean | null;
  cover_image_url?: string | null;
};

type SavedNovel = {
  novel_id: string;
  created_at: string;
  novels: {
    id: string;
    slug: string;
    title: string;
    author_name: string | null;
    cover_image_url: string | null;
    synopsis: string | null;
    primary_genre: string | null;
    chapters_total: number | null;
    avg_rating: number | null;
    view_count: number | null;
    hosted_story_id: string | null;
    source_url: string | null;
  } | null;
};

type UserList = {
  id: number;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
};

type UserReview = {
  id: number;
  title: string | null;
  review_text: string;
  contains_spoilers: boolean;
  updated_at: string;
  novels: {
    slug: string;
    title: string;
  } | null;
};

type SearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

function pretty(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sb = await supabaseServerClient();

  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;

  let sp: Record<string, string | string[] | undefined> = {};
  if (searchParams) {
    const maybePromise = searchParams as any;
    sp =
      typeof maybePromise?.then === "function"
        ? ((await maybePromise) ?? {})
        : ((searchParams as any) ?? {});
  }

  const tabRaw = sp["tab"];
  const tab =
    typeof tabRaw === "string"
      ? tabRaw
      : Array.isArray(tabRaw)
        ? tabRaw[0]
        : "reader";

  const activeTab = tab === "creator" ? "creator" : "reader";

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-400">
          Log in to view your reading activity, lists, reviews, and author tools.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Log in
        </Link>
      </main>
    );
  }

  const [
    { data: creatorRows, error: creatorError },
    { data: savedRows, error: savedError },
    { data: listRows, error: listsError },
    { data: reviewRows, error: reviewsError },
  ] = await Promise.all([
    sb
      .from("stories")
      .select("id, title, created_at, last_chapter_number, is_public, cover_image_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    sb
      .from("novel_bookmarks")
      .select(
        `
          novel_id,
          created_at,
          novels (
            id,
            slug,
            title,
            author_name,
            cover_image_url,
            synopsis,
            primary_genre,
            chapters_total,
            avg_rating,
            view_count,
            hosted_story_id,
            source_url
          )
        `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    sb
      .from("novel_lists")
      .select("id, title, description, is_public, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
    sb
      .from("novel_reviews")
      .select(
        `
          id,
          title,
          review_text,
          contains_spoilers,
          updated_at,
          novels (
            slug,
            title
          )
        `
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  const creatorStories = (creatorRows as CreatorStory[] | null) ?? [];
  const savedNovels = (savedRows as SavedNovel[] | null) ?? [];
  const userLists = (listRows as UserList[] | null) ?? [];
  const reviews = (reviewRows as UserReview[] | null) ?? [];

  const savedCount = savedNovels.filter((row) => row.novels).length;
  const publicLists = userLists.filter((list) => list.is_public).length;
  const publicStories = creatorStories.filter((story) => story.is_public).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-gray-100">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
            Your Hub
          </p>
          <h1 className="mt-1 text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Keep track of what you’re reading, what you’ve saved, what you’ve
            shared, and what you’re writing.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/library"
            className="rounded-md border border-white/10 bg-black/30 px-4 py-2 text-sm font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Browse Library
          </Link>

          <Link
            href="/create-list"
            className="rounded-md border border-white/10 bg-black/30 px-4 py-2 text-sm font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Create List
          </Link>

          <Link
            href="/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Start a Story
          </Link>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-500">Saved Novels</p>
          <p className="mt-1 text-2xl font-bold text-white">{savedCount}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-500">Your Lists</p>
          <p className="mt-1 text-2xl font-bold text-white">{userLists.length}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-500">Reviews</p>
          <p className="mt-1 text-2xl font-bold text-white">{reviews.length}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-500">Published Stories</p>
          <p className="mt-1 text-2xl font-bold text-white">{publicStories}</p>
        </div>
      </section>

      <div className="mb-6 inline-flex rounded-full border border-white/10 bg-gray-900/60 p-1 text-sm">
        <Link
          href="/dashboard?tab=reader"
          className={`rounded-full px-4 py-1.5 ${
            activeTab === "reader"
              ? "bg-indigo-600 text-white"
              : "text-gray-300 hover:text-white"
          }`}
        >
          Reader
        </Link>

        <Link
          href="/dashboard?tab=creator"
          className={`rounded-full px-4 py-1.5 ${
            activeTab === "creator"
              ? "bg-indigo-600 text-white"
              : "text-gray-300 hover:text-white"
          }`}
        >
          Creator
        </Link>
      </div>

      {activeTab === "reader" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Saved Novels</h2>
                <p className="text-sm text-gray-400">
                  Your reading shortlist across the whole catalog.
                </p>
              </div>

              <Link href="/library" className="text-xs text-indigo-300 hover:underline">
                Find more novels
              </Link>
            </div>

            {savedError && (
              <p className="mb-4 text-sm text-red-400">
                {savedError.message || "Failed to load saved novels."}
              </p>
            )}

            {savedCount === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
                <p className="text-sm text-gray-300">
                  You haven’t saved any novels yet.
                </p>
                <Link
                  href="/library"
                  className="mt-3 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Browse the Library
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {savedNovels.map((row) => {
                  const novel = row.novels;
                  if (!novel) return null;

                  const cover = (novel.cover_image_url || "").trim();
                  const hasCover = !!cover && isAssetUrl(cover);

                  return (
                    <Link
                      key={row.novel_id}
                      href={`/novel/${novel.slug}`}
                      className="group flex gap-4 rounded-xl border border-white/10 bg-black/25 p-4 transition hover:border-indigo-500/70 hover:bg-white/[0.07]"
                    >
                      <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30">
                        {hasCover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 font-semibold text-white group-hover:text-indigo-200">
                          {novel.title}
                        </h3>

                        <p className="mt-1 text-xs text-gray-400">
                          by {novel.author_name || "Unknown author"}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                          {novel.primary_genre && (
                            <span>{pretty(novel.primary_genre)}</span>
                          )}
                          <span>{novel.chapters_total ?? "?"} chapters</span>
                          <span>
                            ★{" "}
                            {typeof novel.avg_rating === "number" &&
                            novel.avg_rating > 0
                              ? novel.avg_rating.toFixed(1)
                              : "—"}
                          </span>
                        </div>

                        <p className="mt-2 line-clamp-2 text-sm text-gray-300">
                          {novel.synopsis || "No synopsis available."}
                        </p>

                        <p className="mt-2 text-[11px] text-gray-600">
                          Saved {formatDate(row.created_at)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Your Lists</h2>
                  <p className="text-sm text-gray-400">
                    Collections you’ve built for yourself or the community.
                  </p>
                </div>

                <Link
                  href="/create-list"
                  className="text-xs text-indigo-300 hover:underline"
                >
                  New list
                </Link>
              </div>

              {listsError && (
                <p className="mb-4 text-sm text-red-400">
                  {listsError.message || "Failed to load lists."}
                </p>
              )}

              {userLists.length === 0 ? (
                <p className="text-sm text-gray-400">No lists yet.</p>
              ) : (
                <ul className="space-y-3">
                  {userLists.map((list) => (
                    <li
                      key={list.id}
                      className="rounded-xl border border-white/10 bg-black/25 transition hover:border-indigo-500/70"
                    >
                      <Link href={`/list/${list.id}`} className="block p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-white">{list.title}</h3>
                            <p className="mt-1 line-clamp-2 text-sm text-gray-300">
                              {list.description || "No description."}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${
                              list.is_public
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "bg-white/10 text-gray-400"
                            }`}
                          >
                            {list.is_public ? "Public" : "Private"}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-gray-500">
                          Created {formatDate(list.created_at)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {publicLists > 0 && (
                <p className="mt-4 text-xs text-gray-500">
                  {publicLists} of your {userLists.length} lists are public.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-xl font-semibold text-white">Recent Reviews</h2>
              <p className="text-sm text-gray-400">
                Your latest contributions to novel pages.
              </p>

              {reviewsError && (
                <p className="mt-4 text-sm text-red-400">
                  {reviewsError.message || "Failed to load reviews."}
                </p>
              )}

              {reviews.length === 0 ? (
                <p className="mt-4 text-sm text-gray-400">No reviews yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {reviews.map((review) => (
                    <li
                      key={review.id}
                      className="rounded-xl border border-white/10 bg-black/25 p-4"
                    >
                      {review.novels ? (
                        <Link
                          href={`/novel/${review.novels.slug}`}
                          className="text-sm font-semibold text-indigo-300 hover:underline"
                        >
                          {review.novels.title}
                        </Link>
                      ) : (
                        <p className="text-sm text-gray-500">Unknown novel</p>
                      )}

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">
                          {review.title || "Untitled Review"}
                        </h3>

                        {review.contains_spoilers && (
                          <span className="rounded-full bg-red-500/15 px-2 py-1 text-[11px] text-red-300">
                            Spoilers
                          </span>
                        )}
                      </div>

                      <p className="mt-2 line-clamp-3 text-sm text-gray-300">
                        {review.review_text}
                      </p>

                      <p className="mt-2 text-xs text-gray-500">
                        Updated {formatDate(review.updated_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "creator" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Your Stories</h2>
                <p className="text-sm text-gray-400">
                  Draft, publish, manage, and continue writing from one place.
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href="/dashboard/analytics"
                  className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 hover:border-indigo-500 hover:text-white"
                >
                  Analytics
                </Link>

                <Link
                  href="/new"
                  className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  New Story
                </Link>
              </div>
            </div>

            {creatorError && (
              <p className="mb-4 text-sm text-red-400">
                {creatorError.message || "Failed to load your stories."}
              </p>
            )}

            {creatorStories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
                <p className="text-sm text-gray-300">
                  You haven’t started any stories yet.
                </p>
                <Link
                  href="/new"
                  className="mt-3 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Create your first story
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {creatorStories.map((story) => {
                  const chapterCount = story.last_chapter_number ?? 0;
                  const latestChapter = chapterCount > 0 ? chapterCount : 1;
                  const cover = (story.cover_image_url || "").trim();
                  const hasCover = !!cover && isAssetUrl(cover);

                  return (
                    <article
                      key={story.id}
                      className="overflow-hidden rounded-xl border border-white/10 bg-black/25 transition hover:border-indigo-500/70 hover:bg-white/[0.07]"
                    >
                      <div className="flex gap-4 p-4">
                        <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30">
                          {hasCover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cover}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="line-clamp-2 font-semibold text-white">
                              {story.title}
                            </h3>

                            <span
                              className={`rounded-full px-2 py-1 text-[11px] ${
                                story.is_public
                                  ? "bg-emerald-500/10 text-emerald-300"
                                  : "bg-white/10 text-gray-400"
                              }`}
                            >
                              {story.is_public ? "Published" : "Draft"}
                            </span>
                          </div>

                          <p className="mt-2 text-xs text-gray-400">
                            {chapterCount} {chapterCount === 1 ? "chapter" : "chapters"}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Started {formatDate(story.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 border-t border-white/10 text-xs">
                        <Link
                          href={`/read/${story.id}`}
                          className="px-3 py-3 text-center text-gray-300 hover:bg-white/5 hover:text-white"
                        >
                          Manage
                        </Link>

                        <Link
                          href={`/dashboard/analytics/${story.id}`}
                          className="border-x border-white/10 px-3 py-3 text-center text-gray-300 hover:bg-white/5 hover:text-white"
                        >
                          Analytics
                        </Link>

                        <Link
                          href={`/read/${story.id}/chapter/${latestChapter}`}
                          className="px-3 py-3 text-center font-medium text-indigo-300 hover:bg-white/5 hover:text-indigo-200"
                        >
                          Write
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}