// app/dashboard/analytics/page.tsx
import Link from "next/link";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const dynamic = "force-dynamic";

type Row = {
  story_id: string;
  title: string;
  is_public: boolean;
  created_at: string;
  view_count: number;
  avg_rating: number | null;
  rating_count: number;
  gifts_total: number;

  views_7d: number;
  views_30d: number;

  comments_7d: number;
  comments_30d: number;
};

type AnalyticsAggRow = {
  story_id: string;
  bookmark_count: number;
};

export default async function AnalyticsDashboardPage() {
  const sb = await supabaseServerClient();
  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">Author Analytics</h1>
        <p className="mt-2 text-sm text-gray-400">Log in to view analytics.</p>
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

  // ✅ Call the overloaded function explicitly with args so PostgREST resolves it reliably
  const { data, error } = await sb.rpc("author_analytics_summary", {
    p_user_id: user.id,
  });

  const rows = (data as Row[] | null) ?? [];

  // Fetch bookmark counts in one shot, then merge
  const storyIds = rows.map((r) => r.story_id).filter(Boolean);
  let bookmarkByStory: Record<string, number> = {};

  if (storyIds.length > 0) {
    const { data: aggData, error: aggErr } = await sb.rpc("get_story_analytics", {
      p_story_ids: storyIds,
    });

    if (!aggErr && Array.isArray(aggData)) {
      bookmarkByStory = (aggData as AnalyticsAggRow[]).reduce<Record<string, number>>(
        (acc, cur) => {
          acc[cur.story_id] = Number(cur.bookmark_count ?? 0);
          return acc;
        },
        {}
      );
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Author Analytics</h1>
          <p className="text-sm text-gray-400">
            Momentum signals (7d) plus deep metrics (30d) — per story.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="text-sm text-indigo-300 hover:text-indigo-200"
        >
          ← Back to dashboard
        </Link>
      </header>

      {error && (
        <p className="mb-4 text-sm text-red-400">
          Failed to load analytics: {error.message}
        </p>
      )}

      {!error && rows.length === 0 ? (
        <p className="mt-8 text-sm text-gray-400">
          No stories yet — publish or create one to start seeing analytics.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-gray-400">
          No analytics rows returned (but you are logged in). This usually means
          your RPC is filtering on the wrong author column (user_id vs author_id).
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const bookmarks = bookmarkByStory[r.story_id] ?? 0;

            return (
              <li
                key={r.story_id}
                className="rounded-lg border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-white">
                      {r.title}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {r.is_public ? "Public" : "Private draft"}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-300">
                      <span className="rounded-md bg-black/30 px-2 py-1">
                        Total views: <b>{r.view_count ?? 0}</b>
                      </span>

                      <span className="rounded-md bg-black/30 px-2 py-1">
                        7d views: <b>{r.views_7d ?? 0}</b>
                      </span>

                      <span className="rounded-md bg-black/30 px-2 py-1">
                        30d views: <b>{r.views_30d ?? 0}</b>
                      </span>

                      <span className="rounded-md bg-black/30 px-2 py-1">
                        Bookmarks: <b>{bookmarks}</b>
                      </span>

                      <span className="rounded-md bg-black/30 px-2 py-1">
                        Rating:{" "}
                        <b>
                          {typeof r.avg_rating === "number"
                            ? r.avg_rating.toFixed(1)
                            : "—"}
                        </b>{" "}
                        <span className="text-gray-400">
                          ({r.rating_count ?? 0})
                        </span>
                      </span>

                      <span className="rounded-md bg-black/30 px-2 py-1">
                        7d comments: <b>{r.comments_7d ?? 0}</b>
                      </span>

                      <span className="rounded-md bg-black/30 px-2 py-1">
                        30d comments: <b>{r.comments_30d ?? 0}</b>
                      </span>

                      <span className="rounded-md bg-black/30 px-2 py-1">
                        Gifts total: <b>{r.gifts_total ?? 0}</b>
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:flex-col">
                    <Link
                      href={`/dashboard/analytics/${r.story_id}`}
                      className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
                    >
                      View details
                    </Link>
                    <Link
                      href={`/read/${r.story_id}`}
                      className="inline-flex justify-center rounded-md bg-gray-800 px-3 py-2 text-xs font-medium text-gray-100 hover:bg-gray-700"
                    >
                      Manage story
                    </Link>
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