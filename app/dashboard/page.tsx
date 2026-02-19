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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // ✅ IMPORTANT: use SSR client that reads cookies
  const sb = await supabaseServerClient();

  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;

  // ✅ Don’t redirect to landing; show a clear state instead
  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">My Stories</h1>
        <p className="mt-2 text-sm text-gray-400">
          You’re not logged in on this session. Log in to view your stories.
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

  const { data, error } = await sb
    .from("stories")
    .select("id, title, created_at, last_chapter_number, is_public, author_username, cover_image_url")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const stories = (data as MyStory[] | null) ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">My Stories</h1>
          <p className="text-sm text-gray-400">
            Your private dashboard: manage chapters, edit, generate more, and add cover art.
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
          You haven’t started any stories yet. Create one and it will appear here.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {stories.map((story) => {
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
                  <img src={cover} alt="" className="h-32 w-full object-cover" loading="lazy" />
                ) : null}

                <div className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold text-white">{story.title}</h2>
                      <p className="text-xs text-gray-400">
                        {chapterCount} {chapterCount === 1 ? "chapter" : "chapters"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {story.is_public ? "Public (in Library)" : "Private draft"}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:w-56">
                      {/* ✅ This is the page you described (chapters list + generate + publish/cover panel) */}
                      <Link
                        href={`/read/${story.id}`}
                        className="w-full rounded-md bg-gray-800 px-3 py-2 text-xs font-medium text-gray-100 text-center hover:bg-gray-700"
                      >
                        Manage story (chapters + cover)
                      </Link>

                      {/* ✅ Jump straight into editor for latest chapter */}
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
    </main>
  );
}
