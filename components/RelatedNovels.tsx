// components/RelatedNovels.tsx
import Link from "next/link";

export type RelatedNovel = {
  id: string;
  slug: string;
  title: string;
  author_name: string | null;
  cover_image_url: string | null;
  avg_rating: number | null;
};

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

export default function RelatedNovels({
  novels,
}: {
  novels: RelatedNovel[];
}) {
  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-xl font-semibold text-white">Similar Novels</h2>
      <p className="mt-1 text-sm text-gray-400">
        Readers may also enjoy these related series.
      </p>

      {novels.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">
          No similar novels added yet.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {novels.map((novel) => {
            const cover = (novel.cover_image_url || "").trim();
            const hasCover = !!cover && isAssetUrl(cover);

            return (
              <Link
                key={novel.id}
                href={`/novel/${novel.slug}`}
                className="rounded-xl border border-white/10 bg-black/30 p-3 transition hover:border-indigo-500 hover:bg-white/10"
              >
                <div className="h-40 overflow-hidden rounded-md border border-white/10 bg-black/40">
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

                <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-white">
                  {novel.title}
                </h3>

                <p className="mt-1 line-clamp-1 text-xs text-gray-400">
                  {novel.author_name || "Unknown author"}
                </p>

                <p className="mt-2 text-xs text-gray-500">
                  ★{" "}
                  {typeof novel.avg_rating === "number" && novel.avg_rating > 0
                    ? novel.avg_rating.toFixed(1)
                    : "—"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}