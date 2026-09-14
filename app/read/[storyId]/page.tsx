// app/read/[storyId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";
import PublishStoryPanel from "@/components/PublishStoryPanel";
import RestoreChapterButton from "@/components/RestoreChapterButton";

type Params = { storyId: string };

type StoryRow = {
  id: string;
  user_id: string | null;
  author_id: string | null;
  title: string;
  last_chapter_number: number | null;
  is_public: boolean | null;
  public_summary: string | null;
  cover_image_url: string | null;
  author_username: string | null;
};

type ChapterRow = {
  id: string;
  chapter_number: number;
  title: string | null;
  created_at: string;
};

type CanonicalNovel = {
  id: string;
  slug: string;
  title: string;
  view_count: number | null;
  avg_rating: number | null;
  rating_count: number | null;
  chapters_total: number | null;
  hosted_story_id: string | null;
};

export const dynamic = "force-dynamic";

function parseImportedCount(v: unknown): number | null {
  const s = Array.isArray(v) ? v[0] : v;

  if (typeof s !== "string" || !/^\d+$/.test(s)) {
    return null;
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function computeMissing(nums: number[], maxToShow = 12) {
  const unique = Array.from(
    new Set(
      nums.filter(
        (n) =>
          Number.isFinite(n) &&
          n > 0
      )
    )
  ).sort((a, b) => a - b);

  if (unique.length < 2) {
    return {
      missing: [] as number[],
      totalMissing: 0,
    };
  }

  const min = unique[0];
  const max = unique[unique.length - 1];
  const set = new Set(unique);

  const missing: number[] = [];
  let totalMissing = 0;

  for (let n = min; n <= max; n++) {
    if (!set.has(n)) {
      totalMissing++;

      if (missing.length < maxToShow) {
        missing.push(n);
      }
    }
  }

  return {
    missing,
    totalMissing,
  };
}

function safeFilename(name: string) {
  const base =
    (name || "story").trim() || "story";

  return base
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(
    url.trim()
  );
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) return "—";

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(date);
}

export default async function StoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params> | Params;
  searchParams?:
    | {
        imported?:
          | string
          | string[];
      }
    | Promise<{
        imported?:
          | string
          | string[];
      }>;
}) {
  const p =
    (await params) as Params;

  const storyId =
    p?.storyId?.trim();

  if (!storyId) {
    return notFound();
  }

  const resolvedSearchParams =
    searchParams
      ? await searchParams
      : undefined;

  const importedCount =
    parseImportedCount(
      resolvedSearchParams?.imported
    );

  const sb =
    await supabaseServerClient();

  const {
    data: userData,
  } = await sb.auth.getUser();

  const viewerId =
    userData?.user?.id ?? null;

  const {
    data: storyData,
    error: storyErr,
  } = await sb
    .from("stories")
    .select(
      `
        id,
        user_id,
        author_id,
        title,
        last_chapter_number,
        is_public,
        public_summary,
        cover_image_url,
        author_username
      `
    )
    .eq("id", storyId)
    .maybeSingle();

  if (
    storyErr ||
    !storyData
  ) {
    return notFound();
  }

  const story =
    storyData as StoryRow;

  const isOwner =
    !!viewerId &&
    (
      story.user_id ===
        viewerId ||
      story.author_id ===
        viewerId
    );

  if (
    !isOwner &&
    !story.is_public
  ) {
    return notFound();
  }

  const {
    data: chapterRows,
    error: chapterError,
  } = await sb
    .from("chapters")
    .select(
      "id, chapter_number, title, created_at"
    )
    .eq(
      "story_id",
      storyId
    )
    .eq(
      "is_deleted",
      false
    )
    .order(
      "chapter_number",
      {
        ascending: true,
      }
    );

  const chapters =
    (
      chapterRows as
        | ChapterRow[]
        | null
    ) ?? [];

  const chapterCount =
    chapters.length;

  const deletedChapterRows =
    isOwner
      ? await sb
          .from("chapters")
          .select(
            "id, chapter_number, title, created_at"
          )
          .eq(
            "story_id",
            storyId
          )
          .eq(
            "is_deleted",
            true
          )
          .order(
            "chapter_number",
            {
              ascending: true,
            }
          )
      : {
          data: null,
          error: null,
        };

  const deletedChapters =
    (
      deletedChapterRows.data as
        | ChapterRow[]
        | null
    ) ?? [];

  const chapterNums =
    chapters
      .map((chapter) =>
        Number(
          chapter.chapter_number ??
            0
        )
      )
      .filter(
        (number) =>
          Number.isFinite(
            number
          ) &&
          number > 0
      );

  const firstChapterNum =
    chapterNums.length
      ? chapterNums[0]
      : 0;

  const lastNumFromList =
    chapterNums.length
      ? chapterNums[
          chapterNums.length - 1
        ]
      : 0;

  const highestDeletedNumber =
    deletedChapters.length
      ? Math.max(
          ...deletedChapters.map(
            (chapter) =>
              Number(
                chapter.chapter_number ??
                  0
              )
          )
        )
      : 0;

  const lastNum =
    lastNumFromList;

  const nextNumber =
    Math.max(
      lastNumFromList,
      highestDeletedNumber,
      Number(
        story.last_chapter_number ??
          0
      )
    ) + 1;

  const {
    missing,
    totalMissing,
  } = computeMissing(
    chapterNums
  );

  const lastUpdated =
    chapters.length > 0
      ? formatDate(
          chapters[
            chapters.length - 1
          ]?.created_at
        )
      : "—";

  const cover =
    (
      story.cover_image_url ||
      ""
    ).trim();

  const hasCover =
    !!cover &&
    isAssetUrl(cover);

  const exportFile =
    safeFilename(
      story.title
    );

  const exportHref =
    `/api/export-story?storyId=${encodeURIComponent(
      storyId
    )}&filename=${encodeURIComponent(
      exportFile
    )}`;

  let canonicalNovel:
    | CanonicalNovel
    | null = null;

  let bookmarkCount = 0;
  let reviewCount = 0;
  let commentCount = 0;

  if (story.is_public) {
    const {
      data: novelData,
    } = await sb
      .from("novels")
      .select(
        "id, slug, title, view_count, avg_rating, rating_count, chapters_total, hosted_story_id"
      )
      .eq(
        "hosted_story_id",
        story.id
      )
      .maybeSingle();

    canonicalNovel =
      novelData as
        | CanonicalNovel
        | null;

    if (canonicalNovel) {
      const [
        {
          count: bookmarks,
        },
        {
          count: reviews,
        },
        {
          count: comments,
        },
      ] =
        await Promise.all([
          sb
            .from(
              "novel_bookmarks"
            )
            .select(
              "novel_id",
              {
                count:
                  "exact",
                head: true,
              }
            )
            .eq(
              "novel_id",
              canonicalNovel.id
            ),

          sb
            .from(
              "novel_reviews"
            )
            .select(
              "id",
              {
                count:
                  "exact",
                head: true,
              }
            )
            .eq(
              "novel_id",
              canonicalNovel.id
            ),

          sb
            .from(
              "novel_comments"
            )
            .select(
              "id",
              {
                count:
                  "exact",
                head: true,
              }
            )
            .eq(
              "novel_id",
              canonicalNovel.id
            ),
        ]);

      bookmarkCount =
        bookmarks ?? 0;

      reviewCount =
        reviews ?? 0;

      commentCount =
        comments ?? 0;
    }
  }

  const readerHref =
    firstChapterNum > 0
      ? `/read/${storyId}/chapter/${firstChapterNum}`
      : `/read/${storyId}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-gray-100">
      {isOwner &&
        importedCount &&
        importedCount > 0 && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <p>
              Successfully
              imported{" "}
              <strong>
                {importedCount}
              </strong>{" "}
              {importedCount ===
              1
                ? "chapter"
                : "chapters"}
              .
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {lastNum > 0 && (
                <Link
                  href={`/read/${storyId}/chapter/${lastNum}`}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Open latest
                  chapter
                </Link>
              )}

              <Link
                href={`/read/${storyId}/import`}
                className="rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:border-indigo-500"
              >
                Import more
              </Link>
            </div>
          </div>
        )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={
            isOwner
              ? "/dashboard?tab=creator"
              : "/library"
          }
          className="text-sm text-indigo-300 hover:underline"
        >
          {isOwner
            ? "← Creator Dashboard"
            : "← Back to Library"}
        </Link>

        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/analytics/${storyId}`}
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 hover:border-indigo-500 hover:text-white"
            >
              Analytics
            </Link>

            {canonicalNovel && (
              <Link
                href={`/novel/${canonicalNovel.slug}`}
                className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 hover:border-indigo-500 hover:text-white"
              >
                Public Novel
                Page
              </Link>
            )}
          </div>
        )}
      </div>

      <header className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="p-6 sm:p-7">
          <div className="grid gap-6 md:grid-cols-[160px_1fr]">
            <div className="h-56 w-40 overflow-hidden rounded-xl border border-white/10 bg-black/30">
              {hasCover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20 px-4 text-center text-xs text-gray-500">
                  No cover yet
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
                  {isOwner
                    ? "Story Management"
                    : "Infinite Cultivation Novel"}
                </p>

                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    story.is_public
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "bg-white/10 text-gray-400"
                  }`}
                >
                  {story.is_public
                    ? "Published"
                    : "Draft"}
                </span>

                {canonicalNovel && (
                  <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-200">
                    In catalog
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                {story.title}
              </h1>

              {story.author_username && (
                <p className="mt-1 text-sm text-gray-400">
                  by{" "}
                  {
                    story.author_username
                  }
                </p>
              )}

              <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                {story.public_summary ||
                  (isOwner
                    ? "Add a public summary before publishing so readers know what your story is about."
                    : "No summary available.")}
              </p>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400">
                <span>
                  Chapters:{" "}
                  <strong className="font-medium text-gray-200">
                    {chapterCount}
                  </strong>
                </span>

                <span>
                  Last
                  updated:{" "}
                  <strong className="font-medium text-gray-200">
                    {lastUpdated}
                  </strong>
                </span>

                {canonicalNovel && (
                  <>
                    <span>
                      Views:{" "}
                      <strong className="font-medium text-gray-200">
                        {(
                          canonicalNovel.view_count ??
                          0
                        ).toLocaleString(
                          "en-US"
                        )}
                      </strong>
                    </span>

                    <span>
                      Rating:{" "}
                      <strong className="font-medium text-gray-200">
                        {typeof canonicalNovel.avg_rating ===
                          "number" &&
                        canonicalNovel.avg_rating >
                          0
                          ? `★ ${canonicalNovel.avg_rating.toFixed(
                              1
                            )}`
                          : "—"}
                      </strong>
                    </span>
                  </>
                )}
              </div>

              {isOwner &&
                totalMissing >
                  0 && (
                  <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    Missing chapter
                    numbers:{" "}
                    <strong>
                      {missing.join(
                        ", "
                      )}
                    </strong>
                    {totalMissing >
                    missing.length
                      ? ` … (${totalMissing} total)`
                      : ""}
                  </div>
                )}

              {isOwner &&
                story.is_public &&
                !canonicalNovel && (
                  <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                    This story is
                    public, but its
                    canonical Library
                    listing is not
                    linked yet.
                    Republishing
                    through the
                    publication panel
                    can sync it into
                    the current
                    catalog flow.
                  </div>
                )}

              <div className="mt-5 flex flex-wrap gap-2">
                {firstChapterNum >
                  0 && (
                  <Link
                    href={
                      readerHref
                    }
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                  >
                    {isOwner
                      ? "Preview from Chapter 1"
                      : "Start Reading"}
                  </Link>
                )}

                {lastNum > 0 &&
                  firstChapterNum !==
                    lastNum && (
                    <Link
                      href={`/read/${storyId}/chapter/${lastNum}`}
                      className="rounded-md border border-white/10 bg-black/30 px-4 py-2 text-sm font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
                    >
                      Latest
                      Chapter
                    </Link>
                  )}
              </div>
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="grid grid-cols-2 border-t border-white/10 bg-black/20 sm:grid-cols-4">
            <Metric
              label="Chapters"
              value={
                chapterCount
              }
            />

            <Metric
              label="Catalog Views"
              value={(
                canonicalNovel?.view_count ??
                0
              ).toLocaleString(
                "en-US"
              )}
            />

            <Metric
              label="Bookmarks"
              value={
                bookmarkCount
              }
            />

            <Metric
              label="Rating"
              value={
                typeof canonicalNovel?.avg_rating ===
                  "number" &&
                canonicalNovel.avg_rating >
                  0
                  ? `★ ${canonicalNovel.avg_rating.toFixed(
                      1
                    )}`
                  : "—"
              }
            />
          </div>
        )}
      </header>

      {isOwner && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">
              Author Tools
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Manage Story
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href={`/read/${storyId}/import`}
              className="rounded-xl border border-white/10 bg-black/25 p-4 transition hover:border-indigo-500/70 hover:bg-white/[0.06]"
            >
              <p className="font-semibold text-white">
                Import Chapters
              </p>

              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                Add multiple
                existing chapters
                to this story.
              </p>
            </Link>

            <Link
              href={`/dashboard/analytics/${storyId}`}
              className="rounded-xl border border-white/10 bg-black/25 p-4 transition hover:border-indigo-500/70 hover:bg-white/[0.06]"
            >
              <p className="font-semibold text-white">
                View Analytics
              </p>

              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                Track views and
                reader engagement.
              </p>
            </Link>

            <a
              href={exportHref}
              className="rounded-xl border border-white/10 bg-black/25 p-4 transition hover:border-indigo-500/70 hover:bg-white/[0.06]"
            >
              <p className="font-semibold text-white">
                Export Story
              </p>

              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                Download your
                current story as a
                text file.
              </p>
            </a>

            {canonicalNovel ? (
              <Link
                href={`/novel/${canonicalNovel.slug}`}
                className="rounded-xl border border-white/10 bg-black/25 p-4 transition hover:border-indigo-500/70 hover:bg-white/[0.06]"
              >
                <p className="font-semibold text-white">
                  Public Novel
                  Page
                </p>

                <p className="mt-1 text-xs leading-relaxed text-gray-400">
                  See the page
                  readers discover
                  and interact with.
                </p>
              </Link>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="font-semibold text-gray-400">
                  Public Novel
                  Page
                </p>

                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Available after
                  this story is
                  published into
                  the catalog.
                </p>
              </div>
            )}
          </div>

          {canonicalNovel && (
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
              <span>
                {bookmarkCount}{" "}
                bookmarks
              </span>

              <span>
                {reviewCount}{" "}
                reviews
              </span>

              <span>
                {commentCount}{" "}
                comments
              </span>

              <span>
                {canonicalNovel.rating_count ??
                  0}{" "}
                ratings
              </span>
            </div>
          )}
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Chapters
            </h2>

            <p className="text-sm text-gray-400">
              {isOwner
                ? "Open a chapter to read or continue working on it."
                : "Read this story from the beginning or jump to a chapter."}
            </p>
          </div>

          {isOwner && (
            <span className="text-xs text-gray-500">
              Next chapter:{" "}
              {nextNumber}
            </span>
          )}
        </div>

        {chapterError && (
          <p className="mb-4 text-sm text-red-400">
            Failed to load
            chapters:{" "}
            {
              chapterError.message
            }
          </p>
        )}

        {chapters.length ===
        0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
            <p className="text-sm text-gray-400">
              No chapters yet.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-black/20">
            {chapters.map(
              (chapter) => (
                <li
                  key={
                    chapter.id
                  }
                >
                  <Link
                    href={`/read/${storyId}/chapter/${chapter.chapter_number}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-white/[0.06]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-white">
                        Chapter{" "}
                        {
                          chapter.chapter_number
                        }
                      </p>

                      <p className="truncate text-sm text-gray-400">
                        {chapter.title ||
                          "Untitled"}
                      </p>
                    </div>

                    <span className="shrink-0 text-xs text-gray-600">
                      {formatDate(
                        chapter.created_at
                      )}{" "}
                      →
                    </span>
                  </Link>
                </li>
              )
            )}
          </ol>
        )}
      </section>

      {isOwner &&
        deletedChapters.length >
          0 && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                Author Tools
              </p>

              <h2 className="mt-1 text-xl font-semibold text-white">
                Deleted Chapters
              </h2>

              <p className="mt-1 text-sm text-gray-400">
                Deleted chapters
                are hidden from
                readers but can be
                restored.
              </p>
            </div>

            <ol className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-black/20">
              {deletedChapters.map(
                (chapter) => (
                  <li
                    key={
                      chapter.id
                    }
                    className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-300">
                        Chapter{" "}
                        {
                          chapter.chapter_number
                        }
                      </p>

                      <p className="truncate text-sm text-gray-500">
                        {chapter.title ||
                          "Untitled"}
                      </p>
                    </div>

                    <RestoreChapterButton
                      storyId={
                        storyId
                      }
                      chapterNumber={
                        chapter.chapter_number
                      }
                    />
                  </li>
                )
              )}
            </ol>
          </section>
        )}

      {isOwner && (
        <section className="mt-6">
          <PublishStoryPanel
            storyId={storyId}
            initialSummary={
              story.public_summary
            }
            initialCoverUrl={
              story.cover_image_url ??
              null
            }
            isAlreadyPublic={
              !!story.is_public
            }
          />
        </section>
      )}
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="p-4 text-center">
      <p className="text-xs text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-white">
        {value}
      </p>
    </div>
  );
}