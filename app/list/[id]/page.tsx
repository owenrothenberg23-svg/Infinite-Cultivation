// app/list/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type Params = { id: string };

type NovelList = {
  id: number;
  title: string;
  description: string | null;
  user_id: string;
  is_public: boolean;
  created_at: string;
};

type ListItem = {
  id: number;
  novel_id: string;
  novels: {
    id: string;
    slug: string;
    title: string;
    author_name: string | null;
    synopsis: string | null;
    cover_image_url: string | null;
    avg_rating: number | null;
    view_count: number | null;
    primary_genre: string | null;
  } | null;
};

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

export default async function ListPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const p = (await params) as Params;
  const listId = Number(p.id);

  if (!Number.isFinite(listId)) return notFound();

  const admin = supabaseAdmin();

  const { data: listData } = await admin
    .from("novel_lists")
    .select("id, title, description, user_id, is_public, created_at")
    .eq("id", listId)
    .maybeSingle();

  const list = listData as NovelList | null;

  if (!list || !list.is_public) return notFound();

  const { data: itemRows } = await admin
    .from("novel_list_items")
    .select(
      `
      id,
      novel_id,
      novels (
        id,
        slug,
        title,
        author_name,
        synopsis,
        cover_image_url,
        avg_rating,
        view_count,
        primary_genre
      )
    `
    )
    .eq("list_id", list.id)
    .order("created_at", { ascending: true });

  const items = (itemRows as ListItem[] | null) ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <div className="mb-6">
        <Link href="/lists" className="text-sm text-indigo-300 hover:underline">
          ← Back to lists
        </Link>
      </div>

      <header className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
          Community List
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">{list.title}</h1>
        {list.description && (
          <p className="mt-2 text-sm leading-relaxed text-gray-300">
            {list.description}
          </p>
        )}
        <p className="mt-3 text-xs text-gray-500">
          Created by Cultivator {list.user_id.slice(0, 8)}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">This list has no novels yet.</p>
      ) : (
        <ol className="space-y-4">
          {items.map((item, index) => {
            const novel = item.novels;
            if (!novel) return null;

            const cover = (novel.cover_image_url || "").trim();
            const hasCover = !!cover && isAssetUrl(cover);

            return (
              <li
                key={item.id}
                className="rounded-lg border border-white/5 bg-white/5 p-4 transition hover:border-indigo-500 hover:bg-white/10"
              >
                <Link href={`/novel/${novel.slug}`} className="block">
                  <div className="flex gap-4">
                    <div className="flex w-10 shrink-0 items-center justify-center text-2xl font-bold text-indigo-300">
                      #{index + 1}
                    </div>

                    <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30">
                      {hasCover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-white">
                        {novel.title}
                      </h2>
                      <p className="text-xs text-gray-400">
                        by {novel.author_name || "Unknown author"}
                      </p>
                      {novel.synopsis && (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-300">
                          {novel.synopsis}
                        </p>
                      )}
                      <div className="mt-2 flex gap-3 text-xs text-gray-400">
                        <span>{novel.view_count ?? 0} views</span>
                        <span>
                          ★{" "}
                          {typeof novel.avg_rating === "number" &&
                          novel.avg_rating > 0
                            ? novel.avg_rating.toFixed(1)
                            : "—"}
                        </span>
                        {novel.primary_genre && <span>{novel.primary_genre}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}