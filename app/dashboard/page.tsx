// app/dashboard/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase";

type MyStory = {
  id: string;
  title: string;
  created_at: string;
  last_chapter_number: number | null;
  is_public: boolean | null;
  author_username: string | null;
  cover_image_url?: string | null; // optional if column exists
  view_count?: number | null;
  avg_rating?: number | null;
};

export const dynamic = "force-dynamic"; // always show fresh data

export default async function DashboardPage() {
  const sb = getSupabaseServer();

  // ✅ must be logged in to see "My Stories"
  const { data: userData, error: userErr } = await sb.auth.getUser();
  const user = userData?.user;

  if (userErr || !user) {
    redirect("/"); // or "/login" if you have it
  }

  // ✅ Only load stories owned by current user
  const { data, error } = await sb
    .from("stories")
    .select(
      "id, title, created_at, last_chapter_number, is_public, author_username, cover_image_url, view_count, avg_rating"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const stories = (data as MyStory[] | null) ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">My Stories</h1>
          <p className="text-sm text-gray-400">
            View, continue, edit, and publish the sagas you&apos;ve started forging.
          </p>
        </div>

        <Link
          href="/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Start new story
        </Link>
      </header>

      {error && (
        <p className="mb-4 text-sm text-red-400">
          Failed to load your stories.
        </p>
      )}

      {stories.length === 0 ? (
        <p className="mt-8 text-sm text-gray-400">
          You haven&apos;t started any stories yet. Begin a new saga and it will
          appear here.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {stories.map((story) => {
            const chapterCount = story.last_chapter_number ?? 0;
            const visibility = story.is_public ? "Public" : "Private";
            const created = new Date(story.created_at);
            const createdLabel = created.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            });

            const views = story.view_count ?? 0;
            const hasRating =
              typeof story.avg_rating === "number" &&
              !Number.isNaN(story.avg_rating);

            // Latest chapter to jump to when continuing
            const latestChapter = chapterCount > 0 ? chapterCount : 1;

            const cover = (story.cover_image_url ?? "").trim();

            return (
              <li
                key={story.id}
                className="transition overflow-hidden rounded-lg border border-white/5 bg-white/5 hover:border-indigo-500 hover:bg-white/10"
              >
                {/* optional cover preview */}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">
                          {story.title}
                        </h2>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            story.is_public
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-gray-700/40 text-gray-300 border border-gray-600/60"
                          }`}
                        >
                          {visibility}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400">
                        {story.author_username ? `by ${story.author_username}` : "by You"}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {chapterCount}{" "}
                        {chapterCount === 1 ? "chapter" : "chapters"} · Created{" "}
                        {createdLabel}
                      </p>

                      {(views > 0 || hasRating) && (
                        <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                          {views > 0 && (
                            <span>
                              {views} {views === 1 ? "view" : "views"}
                            </span>
                          )}
                          {hasRating && (
                            <span>
                              ★ {story.avg_rating?.toFixed(1)}{" "}
                              <span className="text-gray-500">avg rating</span>
                            </span>
                          )}
                        </p>
                      )}

                      {story.is_public && (
                        <p className="mt-1 text-[11px] text-emerald-300/80">
                          Public — this saga appears in the Library for other cultivators to read.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-stretch gap-2 text-sm sm:w-56">
                      {/* ✅ main action: go to dashboard/story manager (chapters list + generate + publish/cover) */}
                      <Link
                        href={`/read/${story.id}`}
                        className="w-full rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-100 text-center hover:bg-gray-700"
                      >
                        Manage story (chapters + cover)
                      </Link>

                      {/* ✅ continue: jump into the latest chapter editor */}
                      <Link
                        href={`/read/${story.id}/chapter/${latestChapter}`}
                        className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white text-center hover:bg-indigo-500"
                      >
                        Continue writing
                      </Link>

                      {/* optional: quick read latest */}
                      {chapterCount > 0 && (
                        <Link
                          href={`/read/${story.id}/chapter/${latestChapter}`}
                          className="w-full rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-100 text-center hover:bg-white/15 border border-white/10"
                        >
                          Read latest
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
