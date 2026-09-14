// app/read/[storyId]/chapter/[chapterNumber]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";
import ChapterEditor from "@/components/ChapterEditor";
import DeleteChapterButton from "@/components/DeleteChapterButton";

type Params = { storyId: string; chapterNumber: string };

type StoryRow = {
  id: string;
  title: string;
  last_chapter_number: number | null;
  user_id: string | null;
  author_id: string | null;
  is_public: boolean | null;
};

type ChapterRow = {
  id: string;
  chapter_number: number;
  title: string | null;
  final_content: string | null;
  draft_content: string | null;
  content: string | null;
  created_at: string;
};

type MemoryRow = {
  kind: string | null;
  content: string | null;
  chapter_number: number | null;
};

type CanonicalNovel = {
  id: string;
  slug: string;
};

function safeParseInt(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  const integer = Math.trunc(number);
  return integer > 0 ? integer : null;
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const p = (await params) as Params;
  const storyId = p?.storyId?.trim();
  const chapterNum = safeParseInt(p?.chapterNumber);

  if (!storyId || !chapterNum) return notFound();

  const supabase = await supabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const viewerId = userData?.user?.id ?? null;

  const { data: storyData, error: storyError } = await supabase
    .from("stories")
    .select(
      "id, title, last_chapter_number, user_id, author_id, is_public"
    )
    .eq("id", storyId)
    .maybeSingle();

  if (storyError || !storyData) return notFound();

  const story = storyData as StoryRow;

  const isOwner =
    !!viewerId &&
    (story.user_id === viewerId || story.author_id === viewerId);

  if (!isOwner && !story.is_public) return notFound();

  const { data: chapterData, error: chapterError } = await supabase
    .from("chapters")
    .select(
      "id, chapter_number, title, final_content, draft_content, content, created_at"
    )
    .eq("story_id", storyId)
    .eq("chapter_number", chapterNum)
    .eq("is_deleted", false)
    .maybeSingle();

  if (chapterError || !chapterData) {
    const last = Number(story.last_chapter_number ?? 0);

    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-gray-100">
        <Link
          href={`/read/${storyId}`}
          className="text-sm text-indigo-300 hover:underline"
        >
          ← Back to story
        </Link>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Chapter {chapterNum}
          </p>

          <h1 className="mt-2 text-2xl font-bold text-white">
            Chapter not available
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            This chapter does not exist, has been removed, or is not available
            yet.
          </p>

          {last > 0 && (
            <Link
              href={`/read/${storyId}/chapter/${last}`}
              className="mt-5 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Go to latest chapter
            </Link>
          )}
        </div>
      </main>
    );
  }

  const chapter = chapterData as ChapterRow;

  const chapterText =
    chapter.final_content ??
    chapter.draft_content ??
    chapter.content ??
    "";

  const [
    { data: memoryData },
    { data: prevRow },
    { data: nextRow },
    { data: novelData },
  ] = await Promise.all([
    isOwner
      ? supabase
          .from("memories")
          .select("kind, content, chapter_number")
          .eq("story_id", storyId)
          .lte("chapter_number", chapterNum)
          .order("chapter_number", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null }),

    supabase
      .from("chapters")
      .select("chapter_number")
      .eq("story_id", storyId)
      .eq("is_deleted", false)
      .lt("chapter_number", chapterNum)
      .order("chapter_number", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("chapters")
      .select("chapter_number")
      .eq("story_id", storyId)
      .eq("is_deleted", false)
      .gt("chapter_number", chapterNum)
      .order("chapter_number", { ascending: true })
      .limit(1)
      .maybeSingle(),

    story.is_public
      ? supabase
          .from("novels")
          .select("id, slug")
          .eq("hosted_story_id", storyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const memories = (memoryData as MemoryRow[] | null) ?? [];
  const canonicalNovel = novelData as CanonicalNovel | null;

  const prev = prevRow?.chapter_number
    ? Number(prevRow.chapter_number)
    : null;

  const next = nextRow?.chapter_number
    ? Number(nextRow.chapter_number)
    : null;

  return (
    <main
      className={`mx-auto px-4 py-8 text-gray-100 ${
        isOwner ? "max-w-5xl" : "max-w-3xl"
      }`}
    >
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/read/${storyId}`}
            className="text-sm text-indigo-300 hover:underline"
          >
            {isOwner ? "← Story Management" : "← Story"}
          </Link>

          <div className="flex flex-wrap gap-2">
            {canonicalNovel && (
              <Link
                href={`/novel/${canonicalNovel.slug}`}
                className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 hover:border-indigo-500 hover:text-white"
              >
                Novel Page
              </Link>
            )}

            {isOwner && (
              <Link
                href={`/dashboard/analytics/${storyId}`}
                className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 hover:border-indigo-500 hover:text-white"
              >
                Analytics
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6 border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-[0.22em] text-indigo-300">
            {isOwner ? "Chapter Workspace" : story.title}
          </p>

          {isOwner && (
            <p className="mt-1 text-sm text-gray-500">{story.title}</p>
          )}

          <h1 className="mt-2 text-3xl font-bold text-white">
            Chapter {chapterNum}
            {chapter.title ? `: ${chapter.title}` : ""}
          </h1>

          {isOwner && (
            <span
              className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] ${
                story.is_public
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-white/10 text-gray-400"
              }`}
            >
              {story.is_public ? "Published story" : "Private draft"}
            </span>
          )}
        </div>
      </header>

      {!isOwner && (
        <article className="prose prose-invert prose-lg max-w-none">
          {chapterText.trim().length > 0 ? (
            <div className="whitespace-pre-wrap leading-8 text-gray-200">
              {chapterText}
            </div>
          ) : (
            <p className="text-gray-400">This chapter has no content yet.</p>
          )}
        </article>
      )}

      {isOwner && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">
                Editor
              </p>

              <h2 className="mt-1 text-xl font-semibold text-white">
                Write & Edit
              </h2>

              <p className="mt-1 text-sm text-gray-400">
                Edit the chapter directly. Optional writing assistance can live
                alongside your normal writing workflow.
              </p>
            </div>

            <ChapterEditor
              storyId={storyId}
              chapterNumber={chapterNum}
              authorId={(story.user_id ?? story.author_id) ?? null}
              initialContent={chapterText}
              initialTitle={chapter.title ?? ""}
            />
          </section>

          {memories.length > 0 && (
            <details className="rounded-2xl border border-white/10 bg-white/5">
              <summary className="cursor-pointer list-none p-5 text-sm font-semibold text-white">
                Continuity Notes
                <span className="ml-2 text-xs font-normal text-gray-500">
                  {memories.length} recent
                </span>
              </summary>

              <div className="grid gap-3 border-t border-white/10 p-5 sm:grid-cols-2">
                {memories.map((memory, index) => (
                  <div
                    key={`${memory.chapter_number}-${memory.kind}-${index}`}
                    className="rounded-xl border border-white/10 bg-black/25 p-3"
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-indigo-300">
                      {memory.kind ?? "Note"} · Chapter{" "}
                      {memory.chapter_number ?? "—"}
                    </p>

                    <p className="mt-2 text-sm leading-relaxed text-gray-300">
                      {memory.content ?? ""}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}

          <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-red-300">
              Danger Zone
            </p>

            <h2 className="mt-1 text-lg font-semibold text-white">
              Delete Chapter
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">
              Remove this chapter from the story and hide it from readers.
              Deleted chapters are preserved and can be restored later from
              Story Management.
            </p>

            <div className="mt-4">
              <DeleteChapterButton
                storyId={storyId}
                chapterNumber={chapterNum}
              />
            </div>
          </section>
        </div>
      )}

      <nav className="mt-10 grid grid-cols-2 gap-3 border-t border-white/10 pt-6">
        <div>
          {prev ? (
            <Link
              href={`/read/${storyId}/chapter/${prev}`}
              className="inline-flex rounded-md border border-white/10 bg-black/30 px-4 py-2 text-sm text-gray-300 hover:border-indigo-500 hover:text-white"
            >
              ← Chapter {prev}
            </Link>
          ) : (
            <span className="inline-flex px-4 py-2 text-sm text-gray-600">
              Beginning
            </span>
          )}
        </div>

        <div className="text-right">
          {next ? (
            <Link
              href={`/read/${storyId}/chapter/${next}`}
              className="inline-flex rounded-md border border-white/10 bg-black/30 px-4 py-2 text-sm text-gray-300 hover:border-indigo-500 hover:text-white"
            >
              Chapter {next} →
            </Link>
          ) : (
            <span className="inline-flex px-4 py-2 text-sm text-gray-600">
              Latest chapter
            </span>
          )}
        </div>
      </nav>
    </main>
  );
}