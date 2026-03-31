// app/read/[storyId]/chapter/[chapterNumber]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseServer"; // ✅ needed for view increments (your current pattern)
import GenerateButton from "@/components/GenerateButton";
import ChapterEditor from "@/components/ChapterEditor";

type Params = { storyId: string; chapterNumber: string };

function safeParseInt(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  // ✅ Next 15/16 safe params resolve
  const p =
    typeof (params as any)?.then === "function"
      ? (((await params) as any) ?? ({} as Params))
      : ((params as any) ?? ({} as Params));

  const storyId = p?.storyId;
  const chapterNum = safeParseInt(p?.chapterNumber);

  if (!storyId || !chapterNum) {
    return (
      <main className="max-w-3xl mx-auto p-8 text-gray-200 space-y-4">
        <h1 className="text-2xl font-bold">Invalid chapter</h1>
        <p className="text-gray-400">That chapter number doesn’t look right.</p>
        <Link
          href={storyId ? `/read/${storyId}` : "/library"}
          className="text-indigo-400 hover:underline"
        >
          ← Back
        </Link>
      </main>
    );
  }

  const supabase = getSupabaseServer();

  // ✅ auth (needed to allow authors to read private stories/chapters)
  const { data: userData } = await supabase.auth.getUser();
  const viewerId = userData?.user?.id ?? null;

  // ✅ Load story (include is_public + author_id support)
  const { data: story, error: storyErr } = await supabase
    .from("stories")
    .select("id, title, last_chapter_number, user_id, author_id, is_public, view_count")
    .eq("id", storyId)
    .maybeSingle();

  if (storyErr || !story) {
    return (
      <main className="max-w-3xl mx-auto p-8 text-gray-200 space-y-4">
        <h1 className="text-2xl font-bold">Story not found</h1>
        <Link href="/library" className="text-indigo-400 hover:underline">
          ← Back to Library
        </Link>
      </main>
    );
  }

  const isOwner =
    !!viewerId && (story.user_id === viewerId || story.author_id === viewerId);

  // ✅ protect private stories from non-owners
  if (!isOwner && !story.is_public) return notFound();

  // ✅ Load the chapter and IGNORE deleted chapters
  const { data: chapter, error: chapErr } = await supabase
    .from("chapters")
    .select(
      "id, chapter_number, title, final_content, draft_content, content, created_at, is_deleted, deleted_at"
    )
    .eq("story_id", storyId)
    .eq("chapter_number", chapterNum)
    .eq("is_deleted", false) // ✅ critical
    .maybeSingle();

  // If missing/deleted => show the friendly "hasn't manifested" state
  if (chapErr || !chapter) {
    const last = Number(story.last_chapter_number ?? 0);

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
            It may not exist, it may be deleted, or it hasn’t been generated/published.
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

  // ✅ Choose best available text (draft-first + finalize flow)
  const chapterText =
    (chapter as any)?.final_content ??
    (chapter as any)?.draft_content ??
    (chapter as any)?.content ??
    "";

  // ✅ Fetch recent memories up to this chapter
  const { data: mems } = await supabase
    .from("memories")
    .select("kind, content, chapter_number")
    .eq("story_id", storyId)
    .lte("chapter_number", chapterNum)
    .order("chapter_number", { ascending: false })
    .limit(20);

  // ✅ Prev/Next should skip deleted chapters
  const { data: prevRow } = await supabase
    .from("chapters")
    .select("chapter_number")
    .eq("story_id", storyId)
    .eq("is_deleted", false)
    .lt("chapter_number", chapterNum)
    .order("chapter_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: nextRow } = await supabase
    .from("chapters")
    .select("chapter_number")
    .eq("story_id", storyId)
    .eq("is_deleted", false)
    .gt("chapter_number", chapterNum)
    .order("chapter_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  const prev = prevRow?.chapter_number ? Number(prevRow.chapter_number) : null;
  const next = nextRow?.chapter_number ? Number(nextRow.chapter_number) : null;

  // ✅ "is last chapter" should be computed based on next existing chapter, not story cache
  const isLastChapter = !next;

  // ✅ Increment view count (only public + not owner)
  if (story.is_public && !isOwner) {
    const admin = supabaseAdmin();
    const current = Number(story.view_count ?? 0);
    await admin.from("stories").update({ view_count: current + 1 }).eq("id", storyId);
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
          {(chapter as any)?.title || `Chapter ${chapterNum}`}
        </h2>

        {chapterText.trim().length > 0 ? (
          <div className="whitespace-pre-wrap leading-relaxed">{chapterText}</div>
        ) : (
          <p className="text-gray-400">This chapter has no content yet.</p>
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
        authorId={(story.user_id ?? story.author_id) ?? null} // ✅ supports both schemas
        initialContent={chapterText ?? ""}
        initialTitle={(chapter as any)?.title ?? ""}
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
            nextNumber={(Number(story.last_chapter_number ?? chapterNum) || chapterNum) + 1}
          />
        </section>
      )}
    </main>
  );
}