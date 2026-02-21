// app/dashboard/page.tsx
import Link from "next/link";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

type StoryBase = {
  id: string;
  title: string;
  created_at: string;
  last_chapter_number: number | null;
  is_public: boolean | null;
  author_username: string | null;
  cover_image_url?: string | null;
};

type AnalyticsRow = {
  story_id: string;
  view_count: number;
  bookmark_count: number;
  rating_count: number;
  avg_rating: number;
};

export const dynamic = "force-dynamic";

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export default async function DashboardPage() {
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
            href="/"
            className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Go sign in
          </Link>
        </div>
      </main>
    );
  }

  // ------------------------
  // 1) AUTHOR: my stories
  // ------------------------
  const { data: myStoriesData } = await sb
    .from("stories")
    .select(
      "id, title, created_at, last_chapter_number, is_public, author_username, cover_image_url"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const myStories = (myStoriesData as StoryBase[] | null) ?? [];

  // ------------------------
  // 2) READER: my bookmarks
  // ------------------------
  // This relies on a FK relationship story_bookmarks.story_id -> stories.id.
  // If Supabase complains about "stories" not found, we’ll adjust the select.
  const { data: savedRows } = await sb
    .from("story_bookmarks")
    .select(
      `
        story_id,
        created_at,
        stories:stories (
          id,
          title,
          created_at,
          last_chapter_number,
          is_public,
          author_username,
          cover_image_url
        )
      `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const savedStories: StoryBase[] =
    (savedRows as any[] | null)
      ?.map((r) => r?.stories)
      .filter(Boolean) ?? [];

  // ------------------------
  // 3) Analytics for both
  // ------------------------
  const allIds = Array.from(
    new Set([...myStories.map((s) => s.id), ...savedStories.map((s) => s.id)])
  );

  let analyticsMap = new Map<string, AnalyticsRow>();

  if (allIds.length > 0) {
    const { data: arows } = await sb.rpc("get_story_analytics", {
      p_story_ids: allIds,
    });

    const rows = (arows as AnalyticsRow[] | null) ?? [];
    for (const r of rows) {
      analyticsMap.set(r.story_id, {
        story_id: r.story_id,
        view_count: n((r as any).view_count),
        bookmark_count: n((r as any).bookmark_count),
        rating_count: n((r as any).rating_count),
        avg_rating: Number((r as any).avg_rating ?? 0),
      });
    }
  }

  function A(storyId: string) {
    return (
      analyticsMap.get(storyId) ?? {
        story_id: storyId,
        view_count: 0,
        bookmark_count: 0,
        rating_count: 0,
        avg_rating: 0,
      }
    );
  }

  // Default tab: Author if they have authored stories, else Reader
  const defaultMode: "author" | "reader" =
    myStories.length > 0 ? "author" : "reader";

  // NOTE: We’re not using searchParams here to keep it simple SSR-only.
  // If you want a URL-driven toggle (?mode=reader), tell me and I’ll add it.

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-400">
            Author tools + reader library in one place.
          </p>
        </div>

        <Link
          href="/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Start new story
        </Link>
      </header>

      {/* Tabs (visual only, based on defaultMode for now) */}
      <div className="mb-6 inline-flex rounded-full bg-gray-800 p-1 text-sm">
        <span
          className={`rounded-full px-3 py-1 font-medium ${
            defaultMode === "author"
              ? "bg-indigo-600 text-white"
              : "text-gray-300"
          }`}
        >
          Author
        </span>
        <span
          className={`rounded-full px-3 py-1 font-medium ${
            defaultMode === "reader"
              ? "bg-indigo-600 text-white"
              : "text-gray-300"
          }`}
        >
          Reader
        </span>
      </div>

      {/* AUTHOR SECTION */}
      <section className="mb-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Author</h2>
            <p className="text-sm text-gray-400">
              Your stories + performance stats.
            </p>
          </div>
        </div>

        {myStories.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">
            You haven’t started any stories yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {myStories.map((story) => {
              const chapterCount = story.last_chapter_number ?? 0;
              const latestChapter = chapterCount > 0 ? chapterCount : 1;
              const cover = (story.cover_image_url ?? "").trim();
              const stats = A(story.id);

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
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-white">
                            {story.title}
                          </h3>
                          <p className="text-xs text-gray-400">
                            {chapterCount}{" "}
                            {chapterCount === 1 ? "chapter" : "chapters"} ·{" "}
                            {story.is_public ? "Public (in Library)" : "Draft"}
                          </p>
                        </div>

                        {/* Analytics row */}
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-black/30 px-2 py-1 text-gray-200 border border-white/10">
                            👁 {stats.view_count}
                          </span>
                          <span className="rounded-full bg-black/30 px-2 py-1 text-gray-200 border border-white/10">
                            🔖 {stats.bookmark_count}
                          </span>
                          <span className="rounded-full bg-black/30 px-2 py-1 text-gray-200 border border-white/10">
                            ★ {stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) : "—"}{" "}
                            <span className="text-gray-400">
                              ({stats.rating_count})
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:w-56">
                        <Link
                          href={`/read/${story.id}`}
                          className="w-full rounded-md bg-gray-800 px-3 py-2 text-xs font-medium text-gray-100 text-center hover:bg-gray-700"
                        >
                          Manage story
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
      </section>

      {/* READER SECTION */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Reader</h2>
            <p className="text-sm text-gray-400">
              Stories you’ve saved/bookmarked.
            </p>
          </div>

          <Link
            href="/library"
            className="text-sm text-indigo-400 hover:underline"
          >
            Browse library →
          </Link>
        </div>

        {savedStories.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">
            No saved stories yet. Go to the Library and hit “Save”.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {savedStories.map((story) => {
              const cover = (story.cover_image_url ?? "").trim();
              const stats = A(story.id);

              return (
                <li
                  key={story.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 p-3 hover:border-indigo-500 hover:bg-white/10"
                >
                  <Link href={`/read/${story.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate font-medium text-white">
                          {story.title}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-400">
                          <span>👁 {stats.view_count}</span>
                          <span>🔖 {stats.bookmark_count}</span>
                          <span>
                            ★{" "}
                            {stats.avg_rating > 0
                              ? stats.avg_rating.toFixed(1)
                              : "—"}{" "}
                            ({stats.rating_count})
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <Link
                    href={`/read/${story.id}`}
                    className="shrink-0 rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    Read
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}