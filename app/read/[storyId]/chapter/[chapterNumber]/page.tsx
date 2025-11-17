import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type Params = { storyId: string; chapterNumber: string };

export default async function ChapterPage({
  params,
}: {
  params: Promise<Params>;
}) {
  // Next 16 promise-params
  const { storyId, chapterNumber } = await params;
  const chapterNum = Number(chapterNumber);

  // Load story (for title & bounds)
  const { data: story } = await supabaseServer
    .from("stories")
    .select("id,title,last_chapter_number")
    .eq("id", storyId)
    .single();

  // Load the chapter by composite key
  const { data: chapter } = await supabaseServer
    .from("chapters")
    .select("id, chapter_number, title, content, created_at")
    .eq("story_id", storyId)
    .eq("chapter_number", chapterNum)
    .single();

  // NEW: Fetch recent memories up to this chapter
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

  return (
    <main className="max-w-3xl mx-auto p-8 text-gray-200">
      <h1 className="text-3xl font-bold mb-4">{story?.title ?? "Story"}</h1>

      <article className="prose prose-invert">
        <h2 className="text-2xl font-semibold mb-2">
          {chapter?.title || `Chapter ${chapterNum}`}
        </h2>

        {chapter?.content ? (
          <div className="whitespace-pre-wrap leading-relaxed">
            {chapter.content}
          </div>
        ) : (
          <p>Chapter not found.</p>
        )}
      </article>

      {/* NEW: Previously on… (memories) */}
      <section className="mt-10 border-t border-white/10 pt-6">
        <h3 className="text-lg font-semibold mb-3">Previously on…</h3>
        {(!mems || mems.length === 0) ? (
          <p className="text-gray-400 text-sm">No continuity notes yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {mems.map((m, i) => (
              <div key={i} className="rounded-lg bg-white/5 p-3">
                <div className="text-xs uppercase tracking-wide text-indigo-300">
                  {m.kind} · ch {m.chapter_number}
                </div>
                <div className="text-sm text-gray-200">{m.content}</div>
              </div>
            ))}
          </div>
        )}
      </section>

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
    </main>
  );
}
