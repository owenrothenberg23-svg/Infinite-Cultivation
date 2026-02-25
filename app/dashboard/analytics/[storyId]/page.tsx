// app/dashboard/analytics/[storyId]/page.tsx
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

  comments_total: number;
  comments_7d: number;
  comments_30d: number;

  views_total: number;
  views_7d: number;
  views_30d: number;

  gifts_total: number;
};

type BookmarkAggRow = {
  story_id: string;
  bookmark_count: number;
};

type Params = { storyId: string };

export default async function AnalyticsStoryPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  // ✅ Next 15/16-safe params resolution (same pattern as your other pages)
  const p = (await (params as any)) as Params;
  const storyId = p?.storyId;

  const sb = await supabaseServerClient();
  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">Story Analytics</h1>
        <p className="mt-2 text-sm text-gray-400">Log in to view analytics.</p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Go sign in
        </Link>
      </main>
    );
  }

  if (!storyId) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">Story Analytics</h1>
        <p className="mt-2 text-sm text-red-400">
          Missing story id in route params.
        </p>
        <Link
          href="/dashboard/analytics"
          className="mt-6 inline-flex rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-700"
        >
          ← Back
        </Link>
      </main>
    );
  }

  const { data, error } = await sb.rpc("author_story_analytics", {
    p_story_id: storyId,
  });

  const row = (Array.isArray(data) ? data[0] : data) as Row | null;

  if (error || !row) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">Story Analytics</h1>
        <p className="mt-2 text-sm text-red-400">
          Couldn’t load analytics for this story.
        </p>
        {error?.message ? (
          <p className="mt-2 text-xs text-gray-400">
            Error: <span className="text-gray-300">{error.message}</span>
          </p>
        ) : null}
        <Link
          href="/dashboard/analytics"
          className="mt-6 inline-flex rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-700"
        >
          ← Back
        </Link>
      </main>
    );
  }

  // Pull bookmark count (single-story) via get_story_analytics
  let bookmarkCount = 0;
  const { data: aggData, error: aggErr } = await sb.rpc("get_story_analytics", {
    p_story_ids: [row.story_id],
  });

  if (!aggErr && Array.isArray(aggData) && aggData[0]) {
    const a = aggData[0] as BookmarkAggRow;
    bookmarkCount = Number(a.bookmark_count ?? 0);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-gray-100">
      <header className="mb-6 space-y-2">
        <Link
          href="/dashboard/analytics"
          className="text-sm text-indigo-300 hover:text-indigo-200"
        >
          ← Back to analytics
        </Link>
        <h1 className="text-3xl font-bold">{row.title}</h1>
        <p className="text-sm text-gray-400">
          {row.is_public ? "Public" : "Private draft"}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Total views" value={row.views_total ?? 0} />
        <Stat label="Views (7d)" value={row.views_7d ?? 0} />
        <Stat label="Views (30d)" value={row.views_30d ?? 0} />
        <Stat label="Bookmarks" value={bookmarkCount} />

        <Stat
          label="Avg rating"
          value={
            typeof row.avg_rating === "number" ? row.avg_rating.toFixed(1) : "—"
          }
        />
        <Stat label="Rating count" value={row.rating_count ?? 0} />

        <Stat label="Comments total" value={row.comments_total ?? 0} />
        <Stat label="Comments (7d)" value={row.comments_7d ?? 0} />
        <Stat label="Comments (30d)" value={row.comments_30d ?? 0} />

        <Stat label="Gifts total" value={row.gifts_total ?? 0} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={`/read/${row.story_id}`}
          className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-700"
        >
          Manage story
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}