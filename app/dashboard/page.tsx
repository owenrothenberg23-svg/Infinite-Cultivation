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
  author_username: string | null;
  cover_image_url?: string | null;
};

type BookmarkedStory = {
  // shape of the join result: story_bookmarks(stories(*))
  stories: {
    id: string;
    title: string;
    public_summary: string | null;
    cover_image_url: string | null;
    author_username: string | null;
    last_chapter_number: number | null;
    is_public: boolean | null;
    created_at: string;
  } | null;
  created_at: string; // bookmark created_at
};

type SearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sb = await supabaseServerClient();

  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;

  // Resolve tab from search params (Next 15/16 safe)
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
      : "creator";

  const activeTab = tab === "reader" ? "reader" : "creator";

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-400">
          You’re not logged in on this session. Log in to view your dashboard.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Log in
          </Link>
        </div>
      </main>
    );
  }

  // ---------------------------
  // CREATOR TAB: my stories
  // ---------------------------
  let creatorStories: CreatorStory[] = [];
  let creatorErrMsg: string | null = null;

  if (activeTab === "creator") {
    const { data, error } = await sb
      .from("stories")
      .select(
        "id, title, created_at, last_chapter_number, is_public, author_username, cover_image_url"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) creatorErrMsg = error.message || "Failed to load your stories.";
    creatorStories = (data as CreatorStory[] | null) ?? [];
  }

  // ---------------------------
  // READER TAB: bookmarked stories
  // ---------------------------
  let bookmarked: BookmarkedStory[] = [];
  let bookmarksErrMsg: string | null = null;

  if (activeTab === "reader") {
    const { data, error } = await sb
      .from("story_bookmarks")
      .select(
        `
          created_at,
          stories (
            id,
            title,
            public_summary,
            cover_image_url,
            author_username,
            last_chapter_number,
            is_public,
            created_at
          )
        `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) bookmarksErrMsg = error.message || "Failed to load bookmarks.";
    bookmarked = (data as BookmarkedStory[] | null) ?? [];
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-400">
            Creator tools and reader saves in one place.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/analytics"
            className="rounded-md border border-white/10 bg-black/40 px-4 py-2 text-sm font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Analytics
          </Link>

          <Link
            href="/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Start new story
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-full bg-gray-900/60 p-1 text-sm border border-white/10">
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
      </div>

      {/* CREATOR TAB UI */}
      {activeTab === "creator" && (
        <>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">My Stories</h2>
            <p className="text-sm text-gray-400">
              Drafts and published stories you’re writing.
            </p>
          </div>

          {creatorErrMsg && (
            <p className="mb-4 text-sm text-red-400">{creatorErrMsg}</p>
          )}

          {creatorStories.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
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
            <ul className="mt-4 space-y-4">
              {creatorStories.map((story) => {
                const chapterCount = story.last_chapter_number ?? 0;
                const latestChapter = chapterCount > 0 ? chapterCount : 1;
                const cover = (story.cover_image_url ?? "").trim();

                return (
                  <li
                    key={story.id}
                    className="overflow-hidden transition rounded-lg border border-white/5 bg-white/5 hover:border-indigo-500 hover:bg-white/10"
                  >
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt=""
                        className="h-32 w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}

                    <div className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-white">
                            {story.title}
                          </h3>
                          <p className="text-xs text-gray-400">
                            {chapterCount}{" "}
                            {chapterCount === 1 ? "chapter" : "chapters"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {story.is_public
                              ? "Public (in Library)"
                              : "Private draft"}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:w-56">
                          <Link
                            href={`/read/${story.id}`}
                            className="w-full rounded-md bg-gray-800 px-3 py-2 text-xs font-medium text-gray-100 text-center hover:bg-gray-700"
                          >
                            Manage story (chapters + cover)
                          </Link>

                          <Link
                            href={`/dashboard/analytics/${story.id}`}
                            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs font-medium text-gray-200 text-center hover:border-indigo-500 hover:text-white"
                          >
                            View analytics
                          </Link>

                          <Link
                            href={`/read/${story.id}/chapter/${latestChapter}`}
                            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white text-center hover:bg-indigo-500"
                          >
                            Continue writing
                          </Link>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* READER TAB UI */}
      {activeTab === "reader" && (
        <>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Saved Stories</h2>
            <p className="text-sm text-gray-400">
              Stories you bookmarked so you can come back later.
            </p>
          </div>

          {bookmarksErrMsg && (
            <p className="mb-4 text-sm text-red-400">{bookmarksErrMsg}</p>
          )}

          {bookmarked.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-300">
                You haven’t saved any stories yet.
              </p>
              <Link
                href="/library"
                className="mt-3 inline-flex rounded-md border border-white/10 bg-black/40 px-4 py-2 text-sm font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
              >
                Browse the Library
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
              {bookmarked.map((row, idx) => {
                const s = row.stories;
                if (!s) return null;

                const cover = (s.cover_image_url ?? "").trim();
                const author = s.author_username || "Unknown cultivator";
                const chapterCount = s.last_chapter_number ?? 0;

                return (
                  <li
                    key={`${s.id}-${idx}`}
                    className="transition rounded-lg border border-white/5 bg-white/5 p-4 hover:border-indigo-500 hover:bg-white/10"
                  >
                    <Link href={`/read/${s.id}`} className="block">
                      <div className="flex gap-4">
                        <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30">
                          {cover ? (
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
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-lg font-semibold text-white truncate">
                              {s.title}
                            </h3>
                            <span className="shrink-0 text-[11px] text-gray-500">
                              Saved
                            </span>
                          </div>

                          <p className="text-xs text-gray-400">by {author}</p>

                          <p className="text-xs text-gray-400">
                            {chapterCount}{" "}
                            {chapterCount === 1 ? "chapter" : "chapters"}
                            {s.is_public ? " · Public" : " · Private"}
                          </p>

                          {s.public_summary ? (
                            <p className="text-sm text-gray-300 line-clamp-2">
                              {s.public_summary}
                            </p>
                          ) : (
                            <p className="text-sm italic text-gray-500">
                              No summary yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}