// app/read/[storyId]/page.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";
import GenerateButton from "@/components/GenerateButton";

type Params = { storyId: string };

export default async function StoryPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  // Handle Next 16 promise-params and older sync-params
  const p = (await (params as Promise<Params>).catch?.(() => params)) as Params;
  const storyId = (p as Params).storyId;

  // Story
  const { data: story } = await supabaseServer
    .from("stories")
    .select("id, title, last_chapter_number")
    .eq("id", storyId)
    .single();

  // Chapters
  const { data: chapters } = await supabaseServer
    .from("chapters")
    .select("id, chapter_number, title, created_at")
    .eq("story_id", storyId)
    .order("chapter_number", { ascending: true });

  const nextNumber = (story?.last_chapter_number ?? 0) + 1;

  return (
    <main className="max-w-3xl mx-auto p-8 text-gray-200">
      <h1 className="text-3xl font-bold mb-6">{story?.title ?? "Story"}</h1>

      <h2 className="text-xl font-semibold mb-3">Chapters</h2>
      <ul className="space-y-2">
        {chapters?.length ? (
          chapters.map((ch) => (
            <li key={ch.id}>
              <Link
                href={`/read/${storyId}/chapter/${ch.chapter_number}`}
                className="text-gray-300 hover:text-white"
              >
                Chapter {ch.chapter_number} — {ch.title || "Untitled"}
              </Link>
            </li>
          ))
        ) : (
          <li className="text-gray-500">No chapters yet.</li>
        )}
      </ul>

      <div className="mt-6">
        <GenerateButton storyId={storyId} nextNumber={nextNumber} />
      </div>
    </main>
  );
}
