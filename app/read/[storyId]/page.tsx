// app/read/[storyId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase";
import GenerateButton from "@/components/GenerateButton";
import PublishStoryPanel from "@/components/PublishStoryPanel";

type Params = { storyId: string };

export default async function StoryPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const p = (await (params as any)) as Params;
  const storyId = p.storyId;

  const sb = getSupabaseServer();

  // who is viewing?
  const { data: userData } = await sb.auth.getUser();
  const viewerId = userData?.user?.id ?? null;

  // Load story INCLUDING user_id so we can determine ownership
  const { data: story } = await sb
    .from("stories")
    .select(
      `
        id,
        user_id,
        title,
        last_chapter_number,
        is_public,
        public_summary,
        cover_image_url,
        author_username
      `
    )
    .eq("id", storyId)
    .single();

  if (!story) return notFound();

  const isOwner = !!viewerId && story.user_id === viewerId;

  // If not owner AND not public → hide it
  if (!isOwner && !story.is_public) return notFound();

  // Chapters (RLS will also protect this)
  const { data: chapters } = await sb
    .from("chapters")
    .select("id, chapter_number, title, created_at")
    .eq("story_id", storyId)
    .order("chapter_number", { ascending: true });

  const lastNum = story.last_chapter_number ?? 0;
  const nextNumber = lastNum + 1;
  const hasChapters = !!chapters?.length;

  const cover = (story.cover_image_url || "").trim();

  return (
    <main className="max-w-3xl mx-auto p-8 text-gray-200 space-y-8">
      <header className="space-y-3">
        {cover ? (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="h-48 w-full object-cover" loading="lazy" />
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">{story.title}</h1>

            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">
              {isOwner ? "Creator Dashboard" : "Reader View"}
            </p>

            {story.author_username && (
              <p className="text-sm text-gray-400">by {story.author_username}</p>
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

        {story.is_public ? (
          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
            Published in Library
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gray-300 border border-white/10">
            Draft (private)
          </span>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span>
            Chapters: <span className="text-gray-200">{lastNum}</span>
          </span>
          {isOwner && (
            <span>
              Next: <span className="text-gray-200">Chapter {nextNumber}</span>
            </span>
          )}
        </div>

        {story.public_summary && <p className="text-sm text-gray-300">{story.public_summary}</p>}
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-3">Chapters</h2>

        <ul className="space-y-2">
          {hasChapters ? (
            chapters!.map((ch: any) => (
              <li key={ch.id}>
                <Link
                  href={`/read/${storyId}/chapter/${ch.chapter_number}`}
                  className="block rounded-md border border-white/5 bg-white/5 px-3 py-2 text-gray-300 hover:text-white hover:bg-white/10 hover:border-indigo-500 transition"
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

        {/* ✅ ONLY owners can generate */}
        {isOwner && (
          <div className="mt-6">
            <GenerateButton storyId={storyId} nextNumber={nextNumber} />
          </div>
        )}
      </section>

      {/* ✅ ONLY owners can publish/edit metadata */}
      {isOwner && (
        <PublishStoryPanel
          storyId={storyId}
          initialSummary={story.public_summary}
          initialCoverUrl={story.cover_image_url ?? null}
          isAlreadyPublic={!!story.is_public}
        />
      )}
    </main>
  );
}