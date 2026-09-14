// app/dashboard/analytics/[storyId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const dynamic = "force-dynamic";

type Params = { storyId: string };

type Story = {
  id: string;
  title: string;
  user_id: string;
  is_public: boolean | null;
  created_at: string;
  last_chapter_number: number | null;
};

type LegacyAnalytics = {
  story_id: string;
  views_total: number | null;
  views_7d: number | null;
  views_30d: number | null;
};

type CanonicalNovel = {
  id: string;
  slug: string;
  title: string;
  avg_rating: number | null;
  rating_count: number | null;
  view_count: number | null;
  chapters_total: number | null;
  hosted_story_id: string | null;
};

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("en-US");
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export default async function AnalyticsStoryPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const p = (await params) as Params;
  const storyId = p?.storyId?.trim();

  const sb = await supabaseServerClient();
  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">Story Analytics</h1>
        <p className="mt-2 text-sm text-gray-400">
          Log in to view your story analytics.
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

  if (!storyId) return notFound();

  const { data: storyData, error: storyError } = await sb
    .from("stories")
    .select(
      "id, title, user_id, is_public, created_at, last_chapter_number"
    )
    .eq("id", storyId)
    .maybeSingle();

  const story = storyData as Story | null;

  if (storyError || !story || story.user_id !== user.id) {
    return notFound();
  }

  const [{ data: novelData }, { data: legacyData }] = await Promise.all([
    sb
      .from("novels")
      .select(
        "id, slug, title, avg_rating, rating_count, view_count, chapters_total, hosted_story_id"
      )
      .eq("hosted_story_id", story.id)
      .maybeSingle(),
    sb.rpc("author_story_analytics", {
      p_story_id: story.id,
    }),
  ]);

  const novel = novelData as CanonicalNovel | null;
  const legacy = (Array.isArray(legacyData) ? legacyData[0] : legacyData) as
    | LegacyAnalytics
    | null;

  let bookmarkCount = 0;
  let reviewCount = 0;
  let commentCount = 0;

  if (novel) {
    const [
      { count: bookmarks },
      { count: reviews },
      { count: comments },
    ] = await Promise.all([
      sb
        .from("novel_bookmarks")
        .select("novel_id", { count: "exact", head: true })
        .eq("novel_id", novel.id),
      sb
        .from("novel_reviews")
        .select("id", { count: "exact", head: true })
        .eq("novel_id", novel.id),
      sb
        .from("novel_comments")
        .select("id", { count: "exact", head: true })
        .eq("novel_id", novel.id),
    ]);

    bookmarkCount = bookmarks ?? 0;
    reviewCount = reviews ?? 0;
    commentCount = comments ?? 0;
  }

  const totalViews =
    novel?.view_count ??
    legacy?.views_total ??
    0;

  const chapters =
    novel?.chapters_total ??
    story.last_chapter_number ??
    0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/analytics"
          className="text-sm text-indigo-300 hover:text-indigo-200"
        >
          ← Back to analytics
        </Link>

        <Link
          href="/dashboard?tab=creator"
          className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 hover:border-indigo-500 hover:text-white"
        >
          Creator Dashboard
        </Link>
      </div>

      <header className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
              Author Analytics
            </p>

            <span
              className={`rounded-full px-2.5 py-1 text-[11px] ${
                story.is_public
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-white/10 text-gray-400"
              }`}
            >
              {story.is_public ? "Published" : "Draft"}
            </span>

            {novel && (
              <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-200">
                In catalog
              </span>
            )}
          </div>

          <h1 className="mt-2 text-3xl font-bold text-white">{story.title}</h1>

          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Performance and community activity for this story on Infinite
            Cultivation.
          </p>

          {!novel && story.is_public && (
            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              This story is public, but no canonical catalog novel is linked yet.
              Reader-side metrics will appear here once the catalog record is
              synced.
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 border-t border-white/10 bg-black/20 sm:grid-cols-4">
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500">Views</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {formatNumber(totalViews)}
            </p>
          </div>

          <div className="border-l border-white/10 p-4 text-center">
            <p className="text-xs text-gray-500">Bookmarks</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {formatNumber(bookmarkCount)}
            </p>
          </div>

          <div className="border-t border-white/10 p-4 text-center sm:border-l sm:border-t-0">
            <p className="text-xs text-gray-500">Reviews</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {formatNumber(reviewCount)}
            </p>
          </div>

          <div className="border-l border-t border-white/10 p-4 text-center sm:border-t-0">
            <p className="text-xs text-gray-500">Comments</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {formatNumber(commentCount)}
            </p>
          </div>
        </div>
      </header>

      <section>
        <div className="mb-3">
          <h2 className="text-xl font-semibold text-white">Performance</h2>
          <p className="text-sm text-gray-400">
            Current catalog metrics plus recent story view activity where
            available.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Total Views" value={formatNumber(totalViews)} />
          <Stat
            label="Views · 7 Days"
            value={formatNumber(legacy?.views_7d)}
            hint="Recent hosted-story activity"
          />
          <Stat
            label="Views · 30 Days"
            value={formatNumber(legacy?.views_30d)}
            hint="Recent hosted-story activity"
          />

          <Stat
            label="Average Rating"
            value={
              typeof novel?.avg_rating === "number" && novel.avg_rating > 0
                ? `★ ${novel.avg_rating.toFixed(2)}`
                : "—"
            }
          />
          <Stat
            label="Ratings"
            value={formatNumber(novel?.rating_count)}
          />
          <Stat label="Chapters" value={formatNumber(chapters)} />
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3">
          <h2 className="text-xl font-semibold text-white">
            Community Activity
          </h2>
          <p className="text-sm text-gray-400">
            Engagement recorded on the canonical novel page.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Bookmarks" value={formatNumber(bookmarkCount)} />
          <Stat label="Reviews" value={formatNumber(reviewCount)} />
          <Stat label="Comments" value={formatNumber(commentCount)} />
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={`/read/${story.id}`}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Manage Story
        </Link>

        {novel && (
          <Link
            href={`/novel/${novel.slug}`}
            className="rounded-md border border-white/10 bg-black/30 px-4 py-2 text-sm font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            View Public Novel Page
          </Link>
        )}
      </div>
    </main>
  );
}