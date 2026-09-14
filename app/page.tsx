// app/page.tsx
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase";

type HomeNovel = {
  id: string;
  slug: string;
  title: string;
  author_name: string | null;
  cover_image_url: string | null;
  primary_genre: string | null;
  source_site: string | null;
  avg_rating: number | null;
  rating_count: number | null;
  view_count: number | null;
  created_at: string | null;
};

function formatLabel(value: string | null) {
  if (!value) return "Webnovel";

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSource(source: string | null) {
  if (!source) return null;

  return source
    .replace(/^www\./, "")
    .replace(/\.com$/, "")
    .replace(/\.me$/, "")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function NovelCard({ novel }: { novel: HomeNovel }) {
  const source = formatSource(novel.source_site);

  return (
    <Link
      href={`/novel/${novel.slug}`}
      className="group min-w-0"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-white/5">
        {novel.cover_image_url ? (
          <img
            src={novel.cover_image_url}
            alt={novel.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-gray-500">
            No cover
          </div>
        )}

        {source ? (
          <div className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded-md bg-black/75 px-2 py-1 text-[10px] font-medium text-gray-200 backdrop-blur">
            {source}
          </div>
        ) : null}
      </div>

      <div className="mt-3 min-w-0">
        <h3 className="truncate text-sm font-semibold text-white transition group-hover:text-indigo-300">
          {novel.title}
        </h3>

        <p className="mt-1 truncate text-xs text-gray-500">
          {novel.author_name || "Unknown author"}
        </p>

        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-400">
          <span className="truncate">
            {formatLabel(novel.primary_genre)}
          </span>

          {novel.avg_rating ? (
            <span className="shrink-0 text-amber-300">
              ★ {Number(novel.avg_rating).toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function NovelRow({
  title,
  description,
  novels,
  href,
}: {
  title: string;
  description: string;
  novels: HomeNovel[];
  href: string;
}) {
  if (!novels.length) return null;

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {title}
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            {description}
          </p>
        </div>

        <Link
          href={href}
          className="shrink-0 text-sm font-semibold text-indigo-300 hover:text-indigo-200"
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
        {novels.map((novel) => (
          <NovelCard key={novel.id} novel={novel} />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const supabase = getSupabaseServer();

  const [
    { count: novelCount },
    { data: popularData },
    { data: topRatedData },
    { data: recentData },
  ] = await Promise.all([
    supabase
      .from("novels")
      .select("id", { count: "exact", head: true }),

    supabase
      .from("novels")
      .select(
        `
          id,
          slug,
          title,
          author_name,
          cover_image_url,
          primary_genre,
          source_site,
          avg_rating,
          rating_count,
          view_count,
          created_at
        `
      )
      .not("cover_image_url", "is", null)
      .order("view_count", { ascending: false })
      .limit(6),

    supabase
      .from("novels")
      .select(
        `
          id,
          slug,
          title,
          author_name,
          cover_image_url,
          primary_genre,
          source_site,
          avg_rating,
          rating_count,
          view_count,
          created_at
        `
      )
      .not("cover_image_url", "is", null)
      .not("avg_rating", "is", null)
      .order("avg_rating", { ascending: false })
      .order("rating_count", { ascending: false })
      .limit(6),

    supabase
      .from("novels")
      .select(
        `
          id,
          slug,
          title,
          author_name,
          cover_image_url,
          primary_genre,
          source_site,
          avg_rating,
          rating_count,
          view_count,
          created_at
        `
      )
      .not("cover_image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const popular = (popularData || []) as HomeNovel[];
  const topRated = (topRatedData || []) as HomeNovel[];
  const recent = (recentData || []) as HomeNovel[];

  const categories = [
    ["Fantasy", "fantasy"],
    ["Xianxia", "xianxia"],
    ["Xuanhuan", "xuanhuan"],
    ["Cultivation", "cultivation"],
    ["Progression Fantasy", "progression-fantasy"],
    ["LitRPG", "litrpg"],
    ["System", "system"],
    ["Romance", "romance"],
    ["Sci-Fi", "sci-fi"],
    ["Mystery", "mystery"],
    ["Horror", "horror"],
    ["Fan Fiction", "fan-fiction"],
  ];

  return (
    <main className="min-h-screen bg-[#050816] text-gray-100">
      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-16">
        <div className="max-w-4xl">
          <p className="text-xs font-medium uppercase tracking-[0.26em] text-indigo-400">
            Webnovel Database · Rankings · Discovery
          </p>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            The database for{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
              webnovels
            </span>{" "}
            across every platform.
          </h1>

          <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-300 sm:text-lg">
            Discover, rank, review, compare, and track webnovels from across
            the internet — all in one place.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/library"
              className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-indigo-500"
            >
              Explore Novels
            </Link>

            <Link
              href="/rankings"
              className="rounded-lg border border-white/10 bg-white/[0.02] px-5 py-3 text-sm font-semibold text-gray-200 transition hover:border-indigo-500 hover:text-white"
            >
              View Rankings
            </Link>

            <Link
              href="/lists"
              className="rounded-lg border border-white/10 bg-white/[0.02] px-5 py-3 text-sm font-semibold text-gray-200 transition hover:border-indigo-500 hover:text-white"
            >
              Browse Lists
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-gray-400">
            <div>
              <span className="font-semibold text-white">
                {novelCount?.toLocaleString() || "Thousands of"}
              </span>{" "}
              novels indexed
            </div>

            <div>
              <span className="font-semibold text-white">
                Multiple platforms
              </span>{" "}
              in one database
            </div>

            <div>
              <span className="font-semibold text-white">
                Community rankings
              </span>{" "}
              and discovery
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-16 px-4 pb-16">
        {/* POPULAR */}
        <NovelRow
          title="Popular Right Now"
          description="Popular webnovels from across the catalog."
          novels={popular}
          href="/rankings?list=popular"
        />

        {/* TOP RATED */}
        <NovelRow
          title="Top Rated"
          description="See what rises to the top across the webnovel database."
          novels={topRated}
          href="/rankings?list=top-rated"
        />

        {/* DISCOVERY */}
        <section>
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.22em] text-indigo-400">
              Discovery
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Explore the webnovel world.
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Browse across genres, formats, and communities without being
              locked to one platform.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {categories.map(([label, slug]) => (
              <Link
                key={slug}
                href={`/library?category=${slug}`}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-indigo-500/60 hover:bg-indigo-500/10 hover:text-white"
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        {/* RECENT */}
        <NovelRow
          title="New to the Database"
          description="Recently indexed novels from across the web."
          novels={recent}
          href="/library?sort=newest"
        />

        {/* COMMUNITY */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.22em] text-indigo-400">
              Community
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              More than a catalog.
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-gray-400 sm:text-base">
              Rate novels, write reviews, save what you want to read, build
              public lists, and discover what other webnovel readers recommend.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/lists"
                className="rounded-lg bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
              >
                Explore Reader Lists
              </Link>

              <Link
                href="/rankings"
                className="rounded-lg bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
              >
                Browse Rankings
              </Link>
            </div>
          </div>
        </section>

        {/* AUTHORS */}
        <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/20 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              Publishing your own webnovel?
            </p>

            <p className="mt-1 text-sm text-gray-400">
              Authors can publish original stories directly on Infinite
              Cultivation alongside novels indexed from across the web.
            </p>
          </div>

          <Link
            href="/new"
            className="shrink-0 text-sm font-semibold text-indigo-300 hover:text-indigo-200"
          >
            Start writing →
          </Link>
        </section>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Infinite Cultivation. Webnovel
              discovery, rankings, reviews, and community.
            </p>

            <div className="flex flex-wrap gap-4 text-xs text-gray-400">
              <Link href="/library" className="hover:text-white">
                Library
              </Link>

              <Link href="/rankings" className="hover:text-white">
                Rankings
              </Link>

              <Link href="/lists" className="hover:text-white">
                Lists
              </Link>

              <Link href="/new" className="hover:text-white">
                Write
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}