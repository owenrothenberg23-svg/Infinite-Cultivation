// app/read/[storyId]/import/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";
import ImportChaptersClient from "./ImportChaptersClient";

export const dynamic = "force-dynamic";

type Params = { storyId: string };

type StoryRow = {
  id: string;
  title: string;
  user_id: string | null;
  author_id: string | null;
  last_chapter_number: number | null;
};

export default async function ImportPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  // Next 15/16 safe params resolve
  const p =
    typeof (params as any)?.then === "function"
      ? (((await params) as any) ?? ({} as Params))
      : ((params as any) ?? ({} as Params));

  const storyId = p?.storyId;
  if (!storyId) return notFound();

  const sb = await supabaseServerClient();

  // Must be logged in
  const { data: userData, error: userErr } = await sb.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return notFound();

  // Load story + ownership guard (supports both schemas)
  const { data: story, error: storyErr } = await sb
    .from("stories")
    .select("id, title, user_id, author_id, last_chapter_number")
    .eq("id", storyId)
    .maybeSingle();

  if (storyErr || !story) return notFound();

  const s = story as StoryRow;
  const isOwner = s.user_id === user.id || s.author_id === user.id;
  if (!isOwner) return notFound();

  const suggestedStart = Number(s.last_chapter_number ?? 0) + 1;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-gray-100">
      <header className="mb-6 space-y-2">
        <Link
          href={`/read/${storyId}`}
          className="text-sm text-indigo-300 hover:text-indigo-200"
        >
          ← Back to story
        </Link>

        <h1 className="text-3xl font-bold">Bulk Import Chapters</h1>

        <p className="text-sm text-gray-400">
          Import into <span className="text-gray-200">{s.title}</span>. Paste
          multiple chapters, preview, then import as drafts.
        </p>

        <p className="text-xs text-gray-500">
          Suggested starting chapter:{" "}
          <span className="text-gray-300">{suggestedStart}</span>
        </p>
      </header>

      <ImportChaptersClient storyId={storyId} suggestedStart={suggestedStart} />
    </main>
  );
}