// app/dashboard/page.tsx
import Link from "next/link";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

type MyStory = {
  id: string;
  title: string;
  created_at: string;
  last_chapter_number: number | null;
  is_public: boolean | null;
  author_username: string | null;
  cover_image_url?: string | null;
};

type SavedStory = {
  id: string;
  title: string;
  public_summary: string | null;
  cover_image_url: string | null;
  author_username: string | null;
  last_chapter_number: number | null;
  created_at: string;
};

export const dynamic = "force-dynamic";

function tabHref(tab: "author" | "reader") {
  return `/dashboard?tab=${tab}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const sp =
    searchParams && typeof (searchParams as any)?.then === "function"
      ? (((await searchParams) ?? {}) as Record<string, any>)
      : ((searchParams ?? {}) as Record<string, any>);

  const tabRaw = sp.tab;
  const tab = (Array.isArray(tabRaw) ? tabRaw[0] : tabRaw) as
    | "author"
    | "reader"
    | undefined;

  const activeTab: "author" | "reader" = tab === "reader" ? "reader" : "author";

  // ✅ IMPORTANT: use SSR client that reads cookies
  const sb = await supabaseServerClient();

  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-400">
          You’re not logged in on this session. Log in to view your dashboard.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Go sign in
          </Link>
        </div>
      </main>
    );
  }

  // -------------------------
  // AUTHOR TAB: my stories
  // -------------------------
  let myStories: MyStory[] = [];
  let myStoriesError: string | null = null;

  if (activeTab === "author") {
    const { data, error } = await sb
      .from("stories")
      .select(
        "id, title, created_at, last_chapter_number, is_public, author_username, cover_image_url"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) myStoriesError = error.message;
    myStories = (data as MyStory[] | null) ?? [];
  }

  // -------------------------
  // READER TAB: saved stories
  // Assumes table: story_bookmarks(user_id, story_id)
  // -------------------------
  let savedStories: SavedStory[] = [];
  let savedError: string | null = null;

  if (activeTab === "reader") {
    const { data: saved, error: savedErr } = await sb
      .from("story_bookmarks")
      .select(
        `
          story_id,
          created_at,
          stories:story_id (
            id,
            title,
            public_summary,
            cover_image_url,
            author_username,
            last_chapter_number,
            created_at
          )
        `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (savedErr) {
      savedError = savedErr.message;
    } else {
      // normalize join shape
      savedStories = (saved ?? [])
        .map((row: any) => row.stories)
        .filter(Boolean) as SavedStory[];
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-400">
            Author tools + your saved reading list.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full bg-gray-800 p-1 text-sm">
            <Link
              href={tabHref("author")}
              className={`rounded-full px-3 py-1 font-medium ${
                activeTab === "author"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Author
            </Link>
            <Link
              href={tabHref("reader")}
              className={`rounded-full px-3 py-1 font-medium ${
                activeTab === "reader"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Reader
            </Link>
          </div>

          {activeTab === "author" && (
            <Link
              href="/new"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Start new story
            </Link>
          )}
          {activeTab === "reader" && (
            <Link
              href="/library"
              className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-white/10"
            >
              Browse Library
            </Link>
          )}
        </div>
      </header>

      {activeTab === "author" ? (
        <>
          {myStoriesError && (
            <p className="mb-4 text-sm text-red-400">
              Failed to load your stories: {myStoriesError}
            </p>
          )}

          {myStories.length === 0 ? (
            <p className="mt-8 text-sm text-gray-400">
              You haven’t started any stories yet. Create one and it will appear
              here.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {myStories.map((story) => {
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
                          <h2 className="text-lg font-semibold text-white">
                            {story.title}
                          </h2>
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
      ) : (
        <>
          {savedError && (
            <p className="mb-4 text-sm text-red-400">
              Failed to load saved stories: {savedError}
              <br />
              <span className="text-gray-400">
                (Check your table name — this code expects{" "}
                <code className="text-gray-200">story_bookmarks</code> with{" "}
                <code className="text-gray-200">user_id</code> and{" "}
                <code className="text-gray-200">story_id</code>.)
              </span>
            </p>
          )}

          {savedStories.length === 0 ? (
            <p className="mt-8 text-sm text-gray-400">
              No saved stories yet. Go to the Library and bookmark a saga.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {savedStories.map((story) => {
                const cover = (story.cover_image_url ?? "").trim();
                const last = story.last_chapter_number ?? 0;
                const latest = last > 0 ? last : 1;

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
                        <div className="space-y-1 min-w-0">
                          <h2 className="text-lg font-semibold text-white truncate">
                            {story.title}
                          </h2>
                          <p className="text-xs text-gray-400">
                            by {story.author_username || "Unknown cultivator"}
                          </p>
                          {story.public_summary ? (
                            <p className="text-sm text-gray-300 line-clamp-2">
                              {story.public_summary}
                            </p>
                          ) : (
                            <p className="text-sm italic text-gray-500">
                              No summary yet.
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 sm:w-56">
                          <Link
                            href={`/read/${story.id}`}
                            className="w-full rounded-md bg-gray-800 px-3 py-2 text-xs font-medium text-gray-100 text-center hover:bg-gray-700"
                          >
                            Open story
                          </Link>

                          <Link
                            href={`/read/${story.id}/chapter/${latest}`}
                            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white text-center hover:bg-indigo-500"
                          >
                            Continue reading
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
    </main>
  );
}