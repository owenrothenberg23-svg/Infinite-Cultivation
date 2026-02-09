// app/read/[storyId]/chapter/[chapterNumber]/page.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";
import GenerateButton from "@/components/GenerateButton";
import ChapterEditor from "@/components/ChapterEditor";

type Params = { storyId: string; chapterNumber: string };

export default async function ChapterPage({
  params,
}: {
  params: Promise<Params>;
}) {
  // Next 16 promise-params
  const { storyId, chapterNumber } = await params;
  const chapterNum = Number(chapterNumber);

  // Guard: invalid chapter number
  if (!Number.isFinite(chapterNum) || chapterNum <= 0) {
    return (
      <main className="max-w-3xl mx-auto p-8 text-gray-200 space-y-4">
        <h1 className="text-2xl font-bold">Invalid chapter</h1>
        <p className="text-gray-400">
          That chapter number doesn’t look right.
        </p>
        <Link
          href={`/read/${storyId}`}
          className="text-indigo-400 hover:underline"
        >
          ← Back to story
        </Link>
      </main>
    );
  }

  // Load story (for title & bounds + author)
  const { data: story } = await supabaseServer
    .from("stories")
    .select("id, title, last_chapter_number, user_id")
    .eq("id", storyId)
    .single();

  if (!story) {
    return (
      <main className="max-w-3xl mx-auto p-8 text-gray-200 space-y-4">
        <h1 className="text-2xl font-bold">Story not found</h1>
        <Link href="/library" className="text-indigo-400 hover:underline">
          ← Back to Library
        </Link>
      </main>
    );
  }

  // Load the chapter by composite key
  const { data: chapter } = await supabaseServer
    .from("chapters")
    .select("id, chapter_number, title, final_content, draft_content, content, created_at")
    .eq("story_id", storyId)
    .eq("chapter_number", chapterNum)
    .maybeSingle();

  // Choose best available text (supports your draft-first + finalize flow)
  const chapterText =
    (chapter as any)?.final_content ??
    (chapter as any)?.draft_content ??
    (chapter as any)?.content ??
    "";

  // Fetch recent memories up to this chapter
  const { data: mems } = await supabaseServer
    .from("memories")
    .select("kind, content, chapter_number")
    .eq("story_id", storyId)
    .lte("chapter_number", chapterNum)
    .order("chapter_number", { ascending: false })
    .limit(20);

  const prev = chapterNum > 1 ? chapterNum - 1 : null;
  const next =
    story?.last_chapter_number && chapterNum < story.last_chapter_number
      ? chapterNum + 1
      : null;

  const isLastChapter = chapterNum === (story.last_chapter_number ?? 0);

  // Friendly missing-chapter state
  if (!chapter) {
    const last = story.last_chapter_number ?? 0;

    return (
      <main className="max-w-3xl mx-auto p-8 text-gray-200 space-y-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{story.title}</h1>
          <p className="text-sm text-gray-400">Chapter {chapterNum}</p>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-gray-200 font-medium">
            This chapter hasn’t manifested yet.
          </p>
          <p className="text-sm text-gray-400 mt-1">
            It may not exist, or it hasn’t been generated/published.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/read/${storyId}`}
              className="inline-flex items-center rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/15 border border-white/10"
            >
              ← Back to story
            </Link>

            {last > 0 && (
              <Link
                href={`/read/${storyId}/chapter/${last}`}
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Go to latest (Ch {last}) →
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-8 text-gray-200">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{story.title}</h1>
          <Link
            href={`/read/${storyId}`}
            className="text-sm text-indigo-400 hover:underline"
          >
            ← Back to story
          </Link>
        </div>
      </div>

      <article className="prose prose-invert">
        <h2 className="text-2xl font-semibold mb-2">
          {chapter.title || `Chapter ${chapterNum}`}
        </h2>

        {chapterText.trim().length > 0 ? (
          <div className="whitespace-pre-wrap leading-relaxed">{chapterText}</div>
        ) : (
          <p className="text-gray-400">
            This chapter has no content yet.
          </p>
        )}
      </article>

      {/* Previously on… */}
      <section className="mt-10 border-t border-white/10 pt-6">
        <h3 className="text-lg font-semibold mb-3">Previously on…</h3>
        {!mems || mems.length === 0 ? (
          <p className="text-gray-400 text-sm">No continuity notes yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {mems.map((m: any, i: number) => (
              <div key={i} className="rounded-lg bg-white/5 p-3">
                <div className="text-xs uppercase tracking-wide text-indigo-300">
                  {(m.kind ?? "note")} · ch {m.chapter_number}
                </div>
                <div className="text-sm text-gray-200">{m.content ?? ""}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Author-only chapter editor */}
      <ChapterEditor
        storyId={storyId}
        chapterNumber={chapterNum}
        authorId={story.user_id ?? null}
        initialContent={chapterText ?? ""}
      />

      <nav className="flex items-center justify-between mt-8">
        <div>
          {prev ? (
            <Link
              href={`/read/${storyId}/chapter/${prev}`}
              className="text-gray-300 hover:text-white"
            >
              ← Previous
            </Link>
          ) : (
            <span className="text-gray-600 select-none">← Previous</span>
          )}
        </div>

        <div>
          {next ? (
            <Link
              href={`/read/${storyId}/chapter/${next}`}
              className="text-gray-300 hover:text-white"
            >
              Next →
            </Link>
          ) : (
            <span className="text-gray-600 select-none">Next →</span>
          )}
        </div>
      </nav>

      {/* Generate-next button when you're at the end */}
      {isLastChapter && (
        <section className="mt-10 border-t border-white/10 pt-6">
          <h3 className="text-lg font-semibold mb-3">Continue the saga</h3>
          <GenerateButton
            storyId={storyId}
            nextNumber={(story.last_chapter_number ?? 0) + 1}
          />
        </section>
      )}
    </main>
  );
}
