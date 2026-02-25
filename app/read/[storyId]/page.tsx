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

export default async function StoryPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  // Next 15/16 safe params resolve
  const p =
    typeof (params as any)?.then === "function"
      ? (((await params) as any) ?? ({} as Params))
      : ((params as any) ?? ({} as Params));

  const storyId = p.storyId;

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

  // Support both schemas: some tables use user_id, some use author_id
  const isOwner =
    !!viewerId && (s.user_id === viewerId || s.author_id === viewerId);

  if (!isOwner && !s.is_public) return notFound();

  // ✅ Increment view count (only public + not owner)
  // NOTE: This is not perfectly race-safe, but good enough for now.
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

  const { data: chapters, error: chErr } = await sb
    .from("chapters")
    .select("id, chapter_number, title, created_at")
    .eq("story_id", storyId)
    .order("chapter_number", { ascending: true });

  const lastNum = s.last_chapter_number ?? 0;
  const nextNumber = lastNum + 1;
  const hasChapters = Array.isArray(chapters) && chapters.length > 0;
  const cover = (s.cover_image_url || "").trim();

  const viewsBase = Number(s.view_count ?? 0);
  const viewsDisplay =
    !isOwner && s.is_public ? viewsBase + (didIncrementView ? 1 : 0) : viewsBase;

  return (
    <main className="max-w-3xl mx-auto p-8 text-gray-200 space-y-8">
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
            <Link
              href={`/read/${storyId}/chapter/${lastNum}`}
              className="shrink-0 inline-flex items-center rounded-md bg-white/10 px-3 py-2 text-sm text-gray-100 hover:bg-white/15 border border-white/10"
            >
              Read latest →
            </Link>
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
            Chapters: <span className="text-gray-200">{lastNum}</span>
          </span>

          {!isOwner && s.is_public && (
            <span>
              Views: <span className="text-gray-200">{viewsDisplay}</span>
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

        {/* ✅ NEW: Quick creator actions */}
        {isOwner && (
          <div className="flex flex-wrap gap-2 pt-2">
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
                  <span className="text-gray-400">
                    {" "}
                    — {ch.title || "Untitled"}
                  </span>
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