// app/novel/[slug]/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

import NovelBookmarkButton from "@/components/NovelBookmarkButton";
import NovelRatingForm from "@/components/NovelRatingForm";
import NovelCommentForm from "@/components/NovelCommentForm";
import NovelReviewForm from "@/components/NovelReviewForm";
import AddNovelToListButton from "@/components/AddNovelToListButton";

import {
  rankRelatedNovels,
  type SimilarityNovel,
} from "@/lib/novelDiscovery/relatedNovels";

export const dynamic = "force-dynamic";

type Novel = {
  id: string;
  slug: string;
  title: string;
  original_title: string | null;
  author_name: string | null;
  source_url: string | null;
  source_site: string | null;
  hosted_story_id: string | null;
  cover_image_url: string | null;
  cover_status: string | null;
  synopsis: string | null;
  primary_genre: string | null;
  tags: string[] | null;
  status: string | null;
  translation_status: string | null;
  chapters_total: number | null;
  country: string | null;
  year_started: number | null;
  year_completed: number | null;
  avg_rating: number | null;
  rating_count: number | null;
  view_count: number | null;
};

type NovelComment = {
  id: number;
  content: string;
  created_at: string;
  user_id: string;
};

type NovelReview = {
  id: number;
  title: string | null;
  review_text: string;
  contains_spoilers: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
};

type UserList = {
  id: number;
  title: string;
};

type RelatedNovelRow = {
  related_novel_id: string;
  score: number | null;
  novels: {
    id: string;
    slug: string;
    title: string;
    author_name: string | null;
    cover_image_url: string | null;
    avg_rating: number | null;
  } | null;
};

function pretty(value: string | null | undefined) {
  if (!value) return "Unknown";

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
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

function prettySource(value: string | null | undefined) {
  if (!value) return "Unknown source";

  const normalized = value.trim().toLowerCase();

  if (normalized === "novelbuddy.me") return "NovelBuddy";
  if (normalized === "novelcool.com") return "NovelCool";
  if (normalized === "royalroad.com") return "Royal Road";
  if (normalized === "mtlnovel.me") return "MTLNovel";
  if (normalized === "infinite_cultivation") {
    return "Infinite Cultivation";
  }

  const cleaned = value
    .replace(/^www\./i, "")
    .replace(/\.(com|net|org|me)$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();

  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function NovelPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const p = (await params) as { slug: string };
  const slug = p.slug;

  const admin = supabaseAdmin();

  const { data } = await admin
    .from("novels")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  const novel = data as Novel | null;

  if (!novel) return notFound();

  await admin
    .from("novels")
    .update({
      view_count: (novel.view_count ?? 0) + 1,
    })
    .eq("id", novel.id);

  const ssr = await supabaseServerClient();

  const { data: userData } =
    await ssr.auth.getUser();

  const user = userData?.user ?? null;

  let initialSaved = false;
  let initialRating: number | null = null;
  let userLists: UserList[] = [];

  if (user) {
    const { data: bm } = await ssr
      .from("novel_bookmarks")
      .select("novel_id")
      .eq("user_id", user.id)
      .eq("novel_id", novel.id)
      .maybeSingle();

    initialSaved = !!bm;

    const { data: ratingRow } = await ssr
      .from("novel_ratings")
      .select("rating")
      .eq("user_id", user.id)
      .eq("novel_id", novel.id)
      .maybeSingle();

    initialRating =
      typeof ratingRow?.rating === "number"
        ? ratingRow.rating
        : null;

    const { data: listsRows } = await ssr
      .from("novel_lists")
      .select("id, title")
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    userLists =
      (listsRows as UserList[] | null) ?? [];
  }

  const { data: commentRows } = await admin
    .from("novel_comments")
    .select(
      "id, content, created_at, user_id"
    )
    .eq("novel_id", novel.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(20);

  const comments =
    (commentRows as NovelComment[] | null) ??
    [];

  const { data: reviewRows } = await admin
    .from("novel_reviews")
    .select(
      "id, title, review_text, contains_spoilers, created_at, updated_at, user_id"
    )
    .eq("novel_id", novel.id)
    .order("updated_at", {
      ascending: false,
    })
    .limit(20);

  const reviews =
    (reviewRows as NovelReview[] | null) ??
    [];

  const [
    { count: bookmarkCount },
    { count: reviewCount },
    { count: commentCount },
  ] = await Promise.all([
    admin
      .from("novel_bookmarks")
      .select("novel_id", {
        count: "exact",
        head: true,
      })
      .eq("novel_id", novel.id),

    admin
      .from("novel_reviews")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("novel_id", novel.id),

    admin
      .from("novel_comments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("novel_id", novel.id),
  ]);

  const { data: relatedRows } = await admin
    .from("novel_relationships")
    .select(
      `
        related_novel_id,
        score,
        novels:related_novel_id (
          id,
          slug,
          title,
          author_name,
          cover_image_url,
          avg_rating
        )
      `
    )
    .eq("novel_id", novel.id)
    .order("score", {
      ascending: false,
    })
    .limit(8);

  const manualRelated =
    (relatedRows as RelatedNovelRow[] | null) ??
    [];

  const manualIds = new Set(
    manualRelated
      .map((row) => row.novels?.id)
      .filter(
        (id): id is string => Boolean(id)
      )
  );

  const remainingSlots = Math.max(
    0,
    8 - manualRelated.length
  );

  let automaticRelated: RelatedNovelRow[] = [];

  if (remainingSlots > 0) {
    const { data: candidateRows } =
      await admin
        .from("novels")
        .select(
          "id, slug, title, author_name, cover_image_url, avg_rating, rating_count, view_count, primary_genre, tags, country"
        )
        .neq("id", novel.id)
        .limit(2000);

    const candidates = (
      (candidateRows as
        | SimilarityNovel[]
        | null) ?? []
    ).filter(
      (candidate) =>
        !manualIds.has(candidate.id)
    );

    automaticRelated =
      rankRelatedNovels(
        novel as SimilarityNovel,
        candidates,
        remainingSlots
      ).map(
        ({
          novel: related,
          score,
        }) => ({
          related_novel_id:
            related.id,
          score,
          novels: {
            id: related.id,
            slug: related.slug,
            title: related.title,
            author_name:
              related.author_name,
            cover_image_url:
              related.cover_image_url,
            avg_rating:
              related.avg_rating,
          },
        })
      );
  }

  const relatedNovels = [
    ...manualRelated,
    ...automaticRelated,
  ].slice(0, 8);

  const cover =
    (novel.cover_image_url || "").trim();

  const hasCover =
    novel.cover_status !== "disabled" &&
    !!cover &&
    isAssetUrl(cover);

  const displayedViews =
    (novel.view_count ?? 0) + 1;

  const isHosted =
    !!novel.hosted_story_id;

  const sourceName = isHosted
    ? "Infinite Cultivation"
    : prettySource(novel.source_site);

  const publicationYears =
    novel.year_started &&
    novel.year_completed
      ? `${novel.year_started}–${novel.year_completed}`
      : novel.year_started
        ? `${novel.year_started}–Present`
        : novel.year_completed
          ? String(
              novel.year_completed
            )
          : null;

  const hasRating =
    typeof novel.avg_rating === "number" &&
    novel.avg_rating > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/library"
          className="text-sm text-indigo-300 hover:text-indigo-200"
        >
          ← Back to database
        </Link>

        <div className="flex flex-wrap gap-2">
          <NovelBookmarkButton
            novelId={novel.id}
            initialSaved={initialSaved}
            isAuthed={!!user}
          />

          <Link
            href="/rankings"
            className="inline-flex rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Rankings
          </Link>
        </div>
      </div>

      {/* HERO */}
      <section className="grid gap-7 md:grid-cols-[200px_minmax(0,1fr)] md:items-start">
        <div className="mx-auto w-full max-w-[200px] md:mx-0">
          <div className="aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-black/30 shadow-xl">
            {hasCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={novel.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20 px-4 text-center text-sm text-gray-400">
                No Cover
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">
                {isHosted
                  ? "Infinite Cultivation Original"
                  : "Web Novel"}
              </p>

              <span className="rounded-full border border-sky-400/15 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-200">
                {isHosted
                  ? "Hosted here"
                  : sourceName}
              </span>
            </div>

            <h1 className="mt-2 text-3xl font-bold leading-tight text-white sm:text-4xl">
              {novel.title}
            </h1>

            {novel.original_title && (
              <p className="mt-2 text-sm text-gray-500">
                Original title:{" "}
                {novel.original_title}
              </p>
            )}

            <p className="mt-3 text-sm text-gray-300">
              by{" "}
              <span className="font-medium text-gray-200">
                {novel.author_name ||
                  "Unknown author"}
              </span>
            </p>

            {!isHosted && (
              <p className="mt-1 text-xs text-gray-500">
                Listed from {sourceName}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {novel.primary_genre && (
              <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-indigo-200">
                {pretty(
                  novel.primary_genre
                )}
              </span>
            )}

            {novel.status && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-gray-300">
                {pretty(novel.status)}
              </span>
            )}

            {novel.translation_status && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-gray-300">
                {pretty(
                  novel.translation_status
                )}
              </span>
            )}

            {novel.country && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-gray-300">
                {novel.country}
              </span>
            )}
          </div>

          {/* PRIMARY DATABASE STATS */}
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs text-gray-500">
                Rating
              </p>

              <p className="mt-1 text-lg font-semibold text-white">
                {hasRating
                  ? `★ ${novel.avg_rating!.toFixed(
                      1
                    )}`
                  : "—"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs text-gray-500">
                Ratings
              </p>

              <p className="mt-1 text-lg font-semibold text-white">
                {(
                  novel.rating_count ?? 0
                ).toLocaleString(
                  "en-US"
                )}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs text-gray-500">
                Chapters
              </p>

              <p className="mt-1 text-lg font-semibold text-white">
                {novel.chapters_total ??
                  "—"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs text-gray-500">
                Status
              </p>

              <p className="mt-1 text-lg font-semibold text-white">
                {pretty(
                  novel.status
                )}
              </p>
            </div>
          </div>

          {/* READ */}
          <div className="flex flex-wrap items-center gap-3">
            {novel.hosted_story_id ? (
              <Link
                href={`/read/${novel.hosted_story_id}`}
                className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Start Reading
              </Link>
            ) : novel.source_url ? (
              <a
                href={novel.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Read on {sourceName} ↗
              </a>
            ) : (
              <span className="inline-flex rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-400">
                Reading link unavailable
              </span>
            )}

            {!isHosted &&
              novel.source_url && (
                <span className="text-xs text-gray-500">
                  Opens the source site
                  in a new tab
                </span>
              )}
          </div>

          {/* DATABASE DETAILS */}
          <div className="grid gap-4 rounded-xl border border-white/10 bg-black/20 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-gray-500">
                Platform
              </p>

              <p className="mt-1 font-medium text-gray-200">
                {sourceName}
              </p>
            </div>

            <div>
              <p className="text-gray-500">
                Publication
              </p>

              <p className="mt-1 font-medium text-gray-200">
                {publicationYears ||
                  "Unknown"}
              </p>
            </div>

            <div>
              <p className="text-gray-500">
                Country
              </p>

              <p className="mt-1 font-medium text-gray-200">
                {novel.country ||
                  "Unknown"}
              </p>
            </div>

            <div>
              <p className="text-gray-500">
                Translation
              </p>

              <p className="mt-1 font-medium text-gray-200">
                {pretty(
                  novel.translation_status
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SYNOPSIS / READER ACTIONS */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-semibold text-white">
              Synopsis
            </h2>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
              {novel.synopsis ||
                "No synopsis added yet."}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Reader Snapshot
                </h2>

                <p className="mt-1 text-xs text-gray-400">
                  Community activity on
                  Infinite Cultivation.
                </p>
              </div>

              <span className="text-xs text-gray-500">
                {isHosted
                  ? "Hosted novel"
                  : "Community activity"}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Saved
                </p>

                <p className="mt-1 text-lg font-semibold text-white">
                  {bookmarkCount ?? 0}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Reviews
                </p>

                <p className="mt-1 text-lg font-semibold text-white">
                  {reviewCount ?? 0}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Discussion
                </p>

                <p className="mt-1 text-lg font-semibold text-white">
                  {commentCount ?? 0}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Views
                </p>

                <p className="mt-1 text-lg font-semibold text-white">
                  {displayedViews}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <NovelRatingForm
            novelId={novel.id}
            initialRating={initialRating}
            isAuthed={!!user}
          />

          <AddNovelToListButton
            novelId={novel.id}
            lists={userLists}
            isAuthed={!!user}
          />

          <Link
            href="/create-list"
            className="inline-flex w-full justify-center rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Create a new list
          </Link>
        </div>
      </section>

      {/* TAGS */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-semibold text-white">
          Tags
        </h2>

        {novel.tags &&
        novel.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {novel.tags.map((tag) => (
              <Link
                key={tag}
                href={`/library?tag=${encodeURIComponent(
                  tag
                )}`}
                className="rounded-full bg-black/40 px-3 py-1 text-xs text-gray-300 hover:bg-white/10 hover:text-white"
              >
                #{pretty(tag)}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-400">
            No tags yet.
          </p>
        )}
      </section>

      {/* RELATED */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-semibold text-white">
          Readers Also Enjoyed
        </h2>

        <p className="mt-1 text-sm text-gray-400">
          Similar novels based on genre,
          taxonomy, tags, and curated
          relationships.
        </p>

        {relatedNovels.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            No strong similar matches
            found yet.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {relatedNovels.map(
              (row) => {
                const related =
                  row.novels;

                if (!related) return null;

                const relatedCover =
                  (
                    related.cover_image_url ||
                    ""
                  ).trim();

                const relatedHasCover =
                  !!relatedCover &&
                  isAssetUrl(
                    relatedCover
                  );

                return (
                  <Link
                    key={related.id}
                    href={`/novel/${related.slug}`}
                    className="group rounded-xl border border-white/10 bg-black/30 p-3 transition hover:border-indigo-500 hover:bg-white/[0.07]"
                  >
                    <div className="mx-auto aspect-[2/3] w-full max-w-[150px] overflow-hidden rounded-md border border-white/10 bg-black/40">
                      {relatedHasCover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            relatedCover
                          }
                          alt={
                            related.title
                          }
                          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20" />
                      )}
                    </div>

                    <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-white">
                      {related.title}
                    </h3>

                    <p className="mt-1 line-clamp-1 text-xs text-gray-400">
                      {related.author_name ||
                        "Unknown author"}
                    </p>

                    <p className="mt-2 text-xs text-gray-500">
                      ★{" "}
                      {typeof related.avg_rating ===
                        "number" &&
                      related.avg_rating > 0
                        ? related.avg_rating.toFixed(
                            1
                          )
                        : "—"}
                    </p>
                  </Link>
                );
              }
            )}
          </div>
        )}
      </section>

      {/* REVIEWS */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-semibold text-white">
            Reviews
          </h2>

          {reviews.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">
              No reviews yet. Be the
              first to leave a full
              review.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {reviews.map(
                (review) => (
                  <li
                    key={review.id}
                    className="rounded-lg border border-white/10 bg-black/30 p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          {review.title ||
                            "Untitled Review"}
                        </p>

                        <p className="text-xs text-gray-500">
                          Reader{" "}
                          {review.user_id.slice(
                            0,
                            8
                          )}{" "}
                          ·{" "}
                          {formatDate(
                            review.updated_at ||
                              review.created_at
                          )}
                        </p>
                      </div>

                      {review.contains_spoilers && (
                        <span className="rounded-full bg-red-500/15 px-2 py-1 text-[11px] font-medium text-red-300">
                          Spoilers
                        </span>
                      )}
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                      {
                        review.review_text
                      }
                    </p>
                  </li>
                )
              )}
            </ul>
          )}
        </div>

        <NovelReviewForm
          novelId={novel.id}
          isAuthed={!!user}
        />
      </section>

      {/* DISCUSSION */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-semibold text-white">
            Discussion
          </h2>

          {comments.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">
              No comments yet. Start the
              discussion.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {comments.map(
                (comment) => (
                  <li
                    key={comment.id}
                    className="rounded-lg border border-white/10 bg-black/30 p-3"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-500">
                        Reader{" "}
                        {comment.user_id.slice(
                          0,
                          8
                        )}
                      </span>

                      <span className="text-xs text-gray-500">
                        {formatDate(
                          comment.created_at
                        )}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                      {
                        comment.content
                      }
                    </p>
                  </li>
                )
              )}
            </ul>
          )}
        </div>

        <NovelCommentForm
          novelId={novel.id}
          isAuthed={!!user}
        />
      </section>
    </main>
  );
}