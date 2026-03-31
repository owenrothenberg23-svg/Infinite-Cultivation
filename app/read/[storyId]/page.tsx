// app/read/[storyId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";
import { supabaseAdmin } from "@/lib/supabaseServer";
import GenerateButton from "@/components/GenerateButton";
import PublishStoryPanel from "@/components/PublishStoryPanel";

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
  view_count: number | null;
};

export const dynamic = "force-dynamic";

function parseImportedCount(v: unknown): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== "string") return null;
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function computeMissing(nums: number[], maxToShow = 12) {
  const unique = Array.from(
    new Set(nums.filter((n) => Number.isFinite(n) && n > 0))
  ).sort((a, b) => a - b);

  if (unique.length < 2) return { missing: [] as number[], totalMissing: 0 };

  const min = unique[0];
  const max = unique[unique.length - 1];
  const set = new Set(unique);

  const missing: number[] = [];
  let totalMissing = 0;

  for (let n = min; n <= max; n++) {
    if (!set.has(n)) {
      totalMissing++;
      if (missing.length < maxToShow) missing.push(n);
    }
  }

  return { missing, totalMissing };
}

function safeFilename(name: string) {
  const base = (name || "story").trim() || "story";
  return base.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 120);
}

export default async function StoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params> | Params;
  searchParams?: { imported?: string | string[] };
}) {
  const p =
    typeof (params as any)?.then === "function"
      ? (((await params) as any) ?? ({} as Params))
      : ((params as any) ?? ({} as Params));

  const storyId = p?.storyId;
  if (!storyId) return notFound();

  const importedCount = parseImportedCount(searchParams?.imported);

  const sb = await supabaseServerClient();

  const { data: userData } = await sb.auth.getUser();
  const viewerId = userData?.user?.id ?? null;

  const { data: story, error: storyErr } = await sb
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
        author_username,
        view_count
      `
    )
    .eq("id", storyId)
    .maybeSingle();

  if (storyErr || !story) return notFound();

  const s = story as StoryRow;

  const isOwner =
    !!viewerId && (s.user_id === viewerId || s.author_id === viewerId);

  if (!isOwner && !s.is_public) return notFound();

  // ✅ IMPORTANT: ignore deleted chapters everywhere in the UI list
  const { data: chapters, error: chErr } = await sb
    .from("chapters")
    .select("id, chapter_number, title, created_at")
    .eq("story_id", storyId)
    .eq("is_deleted", false)
    .order("chapter_number", { ascending: true });

  const hasChapters = Array.isArray(chapters) && chapters.length > 0;
  const chapterCount = hasChapters ? chapters!.length : 0;

  const chapterNums = hasChapters
    ? chapters!
        .map((c: any) => Number(c.chapter_number ?? 0))
        .filter((n: number) => Number.isFinite(n) && n > 0)
    : [];

  const lastNumFromList = chapterNums.length
    ? chapterNums[chapterNums.length - 1]
    : 0;

  const lastNum = lastNumFromList || Number(s.last_chapter_number ?? 0);
  const nextNumber = lastNum + 1;

  const cover = (s.cover_image_url || "").trim();

  // ✅ Increment view count (only public + not owner)
  let didIncrementView = false;
  if (s.is_public && !isOwner) {
    const admin = supabaseAdmin();
    const current = Number(s.view_count ?? 0);

    const { error: incErr } = await admin
      .from("stories")
      .update({ view_count: current + 1 })
      .eq("id", storyId);

    didIncrementView = !incErr;
  }

  const viewsBase = Number(s.view_count ?? 0);
  const viewsDisplay =
    !isOwner && s.is_public ? viewsBase + (didIncrementView ? 1 : 0) : viewsBase;

  // ✅ last updated should be based on last non-deleted chapter
  const lastUpdated =
    hasChapters && chapters![chapters!.length - 1]?.created_at
      ? new Date(chapters![chapters!.length - 1].created_at).toLocaleDateString()
      : null;

  const firstChapterNum = chapterNums.length ? chapterNums[0] : 0;

  const { missing, totalMissing } = computeMissing(chapterNums);

  const exportFile = safeFilename(s.title);
  const exportHref = `/api/export-story?storyId=${encodeURIComponent(
    storyId
  )}&filename=${encodeURIComponent(exportFile)}`;

  return (
    <main className="max-w-3xl mx-auto p-8 text-gray-200 space-y-8">
      {isOwner && importedCount && importedCount > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <p>
            ✅ Successfully imported <b>{importedCount}</b> chapter
            {importedCount === 1 ? "" : "s"}.
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {hasChapters && lastNum > 0 && (
              <Link
                href={`/read/${storyId}/chapter/${lastNum}`}
                className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Read latest →
              </Link>
            )}

            <Link
              href={`/dashboard/analytics/${storyId}`}
              className="inline-flex items-center rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:border-indigo-500 hover:bg-white/5"
            >
              View analytics
            </Link>

            <Link
              href={`/read/${storyId}/import`}
              className="inline-flex items-center rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:border-indigo-500 hover:bg-white/5"
            >
              Import more
            </Link>
          </div>
        </div>
      )}

      <header className="space-y-3">
        {cover && (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="h-48 w-full object-cover" />
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-3xl font-bold truncate">{s.title}</h1>
            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">
              {isOwner ? "Creator Dashboard" : "Reader View"}
            </p>
            {s.author_username && (
              <p className="text-sm text-gray-400">by {s.author_username}</p>
            )}
          </div>

          {hasChapters && lastNum > 0 && (
            <div className="shrink-0 flex flex-col gap-2">
              <Link
                href={`/read/${storyId}/chapter/${lastNum}`}
                className="inline-flex items-center justify-center rounded-md bg-white/10 px-3 py-2 text-sm text-gray-100 hover:bg-white/15 border border-white/10"
              >
                Read latest →
              </Link>

              {firstChapterNum > 0 && firstChapterNum !== lastNum && (
                <Link
                  href={`/read/${storyId}/chapter/${firstChapterNum}`}
                  className="inline-flex items-center justify-center rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 hover:border-indigo-500 hover:bg-white/5"
                >
                  Start from Ch. {firstChapterNum}
                </Link>
              )}
            </div>
          )}
        </div>

        {s.is_public ? (
          <span className="inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
            Published in Library
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300 border border-white/10">
            Draft (private)
          </span>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span>
            Chapters: <span className="text-gray-200">{chapterCount}</span>
          </span>

          {lastUpdated && (
            <span>
              Last updated: <span className="text-gray-200">{lastUpdated}</span>
            </span>
          )}

          {!isOwner && s.is_public && (
            <span>
              Views: <span className="text-gray-200">{viewsDisplay}</span>
            </span>
          )}

          {isOwner && totalMissing > 0 && (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">
              Missing chapter #s: <b>{missing.join(", ")}</b>
              {totalMissing > missing.length ? (
                <span className="text-amber-300/80"> … ({totalMissing} total)</span>
              ) : null}
            </span>
          )}

          {chErr && (
            <span className="text-red-300">
              Failed to load chapters: {chErr.message}
            </span>
          )}
        </div>

        {s.public_summary && (
          <p className="text-sm text-gray-300">{s.public_summary}</p>
        )}

        {isOwner && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/read/${storyId}/import`}
                className="inline-flex items-center rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 hover:border-indigo-500 hover:bg-white/5"
              >
                Bulk import chapters
              </Link>

              <Link
                href={`/dashboard/analytics/${storyId}`}
                className="inline-flex items-center rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 hover:border-indigo-500 hover:bg-white/5"
              >
                View analytics
              </Link>

              <a
                href={exportHref}
                className="inline-flex items-center rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 hover:border-indigo-500 hover:bg-white/5"
              >
                Export story (.txt)
              </a>

              {!hasChapters && (
                <span className="inline-flex items-center rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-400">
                  Tip: create Chapter 1 to unlock reading & stats
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Views" value={viewsBase} />
              <Metric label="Chapters" value={chapterCount} />
              <Metric label="Status" value={s.is_public ? "Public" : "Draft"} />
              <Metric label="Last update" value={lastUpdated ?? "—"} />
            </div>
          </div>
        )}
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-3">Chapters</h2>

        <ul className="space-y-2">
          {hasChapters ? (
            chapters!.map((ch: any) => (
              <li key={ch.id}>
                <Link
                  href={`/read/${storyId}/chapter/${ch.chapter_number}`}
                  className="block rounded-md border border-white/5 bg-white/5 px-3 py-2 hover:border-indigo-500 hover:bg-white/10"
                >
                  <span className="font-medium">Chapter {ch.chapter_number}</span>
                  <span className="text-gray-400"> — {ch.title || "Untitled"}</span>
                </Link>
              </li>
            ))
          ) : (
            <li className="text-gray-500">No chapters yet.</li>
          )}
        </ul>

        {isOwner && (
          <div className="mt-6">
            <GenerateButton storyId={storyId} nextNumber={nextNumber} />
            {!hasChapters && (
              <p className="mt-2 text-xs text-gray-500">
                Create Chapter 1 to start publishing or importing after.
              </p>
            )}
          </div>
        )}
      </section>

      {isOwner && (
        <PublishStoryPanel
          storyId={storyId}
          initialSummary={s.public_summary}
          initialCoverUrl={s.cover_image_url ?? null}
          isAlreadyPublic={!!s.is_public}
        />
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}