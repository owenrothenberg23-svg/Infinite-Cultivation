// app/novel/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";
import NovelBookmarkButton from "@/components/NovelBookmarkButton";
import NovelRatingForm from "@/components/NovelRatingForm";

export const dynamic = "force-dynamic";

type Novel = {
  id: string;
  slug: string;
  title: string;
  original_title: string | null;
  author_name: string | null;
  source_url: string | null;
  source_site: string | null;
  cover_image_url: string | null;
  synopsis: string | null;
  primary_genre: string | null;
  tags: string[] | null;
  status: string | null;
  translation_status: string | null;
  chapters_total: number | null;
  country: string | null;
  year_started: number | null;
  year_completed: number | null;
  avg_rating: number | null;
  rating_count: number | null;
  view_count: number | null;
};

function pretty(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

export default async function NovelPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const p = (await params) as { slug: string };
  const slug = p.slug;

  const admin = supabaseAdmin();

  const { data } = await admin
    .from("novels")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  const novel = data as Novel | null;

  if (!novel) return notFound();

  // Best-effort view increment
  await admin
    .from("novels")
    .update({ view_count: (novel.view_count ?? 0) + 1 })
    .eq("id", novel.id);

  const ssr = await supabaseServerClient();
  const { data: userData } = await ssr.auth.getUser();
  const user = userData?.user ?? null;

  let initialSaved = false;
  let initialRating: number | null = null;

  if (user) {
    const { data: bm } = await ssr
      .from("novel_bookmarks")
      .select("novel_id")
      .eq("user_id", user.id)
      .eq("novel_id", novel.id)
      .maybeSingle();

    initialSaved = !!bm;

    const { data: ratingRow } = await ssr
      .from("novel_ratings")
      .select("rating")
      .eq("user_id", user.id)
      .eq("novel_id", novel.id)
      .maybeSingle();

    initialRating =
      typeof ratingRow?.rating === "number" ? ratingRow.rating : null;
  }

  const cover = (novel.cover_image_url || "").trim();
  const hasCover = !!cover && isAssetUrl(cover);

  const displayedViews = (novel.view_count ?? 0) + 1;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/library" className="text-sm text-indigo-300 hover:underline">
          ← Back to database
        </Link>

        <div className="flex flex-wrap gap-2">
          <NovelBookmarkButton
            novelId={novel.id}
            initialSaved={initialSaved}
            isAuthed={!!user}
          />

          <Link
            href="/rankings"
            className="inline-flex rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Rankings
          </Link>
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-[180px_1fr]">
        <div className="h-72 overflow-hidden rounded-xl border border-white/10 bg-black/30">
          {hasCover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20 text-sm text-gray-400">
              No Cover
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
              Novel Entry
            </p>
            <h1 className="mt-1 text-4xl font-bold text-white">{novel.title}</h1>

            {novel.original_title && (
              <p className="mt-1 text-sm text-gray-400">
                Original title: {novel.original_title}
              </p>
            )}

            <p className="mt-2 text-sm text-gray-400">
              by {novel.author_name || "Unknown author"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {novel.primary_genre && (
              <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-indigo-200">
                {pretty(novel.primary_genre)}
              </span>
            )}
            <span className="rounded-full bg-white/10 px-3 py-1 text-gray-300">
              {pretty(novel.status)}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-gray-300">
              {pretty(novel.translation_status)}
            </span>
            {novel.country && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-gray-300">
                {novel.country}
              </span>
            )}
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-gray-400">Rating</p>
              <p className="mt-1 text-lg font-semibold">
                {typeof novel.avg_rating === "number" && novel.avg_rating > 0
                  ? `★ ${novel.avg_rating.toFixed(1)}`
                  : "—"}
              </p>
              <p className="text-xs text-gray-500">
                {novel.rating_count ?? 0} ratings
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-gray-400">Views</p>
              <p className="mt-1 text-lg font-semibold">{displayedViews}</p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-gray-400">Chapters</p>
              <p className="mt-1 text-lg font-semibold">
                {novel.chapters_total ?? "Unknown"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {novel.source_url ? (
              <a
                href={novel.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Read at source
              </a>
            ) : (
              <span className="inline-flex rounded-md border border-white/10 px-4 py-2 text-sm text-gray-400">
                Source link not added yet
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-semibold text-white">Synopsis</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
            {novel.synopsis || "No synopsis added yet."}
          </p>
        </div>

        <NovelRatingForm
          novelId={novel.id}
          initialRating={initialRating}
          isAuthed={!!user}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-semibold text-white">Tags</h2>

        {novel.tags && novel.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {novel.tags.map((tag) => (
              <Link
                key={tag}
                href={`/library?tag=${encodeURIComponent(tag)}`}
                className="rounded-full bg-black/40 px-3 py-1 text-xs text-gray-300 hover:text-white"
              >
                #{tag}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-400">No tags yet.</p>
        )}
      </section>
    </main>
  );
}