// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050816] text-gray-100">
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-400">
              Cultivation · Xianxia · Progression Fantasy · Webnovels
            </p>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              The database for{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
                cultivation novels
              </span>{" "}
              worth reading.
            </h1>

            <p className="max-w-xl text-sm leading-relaxed text-gray-300 sm:text-base">
              Infinite Cultivation is becoming the discovery hub for xianxia,
              progression fantasy, and webnovels — rankings, reviews, tags,
              reading lists, recommendations, and community-built novel pages.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/library"
                className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500"
              >
                Browse Database
              </Link>
              <Link
                href="/rankings"
                className="rounded-md border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
              >
                View Rankings
              </Link>
              <Link
                href="/add-novel"
                className="rounded-md border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
              >
                Add a Novel
              </Link>
            </div>

            <dl className="mt-6 grid gap-4 text-xs text-gray-300 sm:grid-cols-3 sm:text-sm">
              <div>
                <dt className="font-semibold text-white">Rank everything</dt>
                <dd className="text-gray-400">
                  Best MCs, power systems, completed novels, dark stories, and more.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-white">Find your next binge</dt>
                <dd className="text-gray-400">
                  Filter by tropes, tags, tone, pacing, status, and reader ratings.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-white">Build your profile</dt>
                <dd className="text-gray-400">
                  Save novels, review stories, make lists, and earn titles.
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
                Discovery Hub
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">
                Rankings, reviews, tags, and reader-made lists.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                A full webnovel index for cultivation readers: external novel pages,
                community ratings, trope filters, similar reads, and ranked lists.
              </p>

              <div className="mt-5 grid gap-3 text-sm text-gray-300">
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <b className="text-white">Top Cultivation Novels</b>
                  <p className="mt-1 text-xs text-gray-400">
                    Community-driven rankings for the genre.
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <b className="text-white">Trope & Tag Discovery</b>
                  <p className="mt-1 text-xs text-gray-400">
                    Find ruthless MC, regression, sect building, alchemy, system, and more.
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <b className="text-white">Reader Lists</b>
                  <p className="mt-1 text-xs text-gray-400">
                    Save future reads and share curated recommendation lists.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/library"
                  className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Explore Library
                </Link>
                <Link
                  href="/lists"
                  className="rounded-md border border-white/10 px-4 py-2 text-xs font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
                >
                  Browse Lists
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm font-semibold text-white">
                Authors still have a home here.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Hosted originals, creator dashboards, analytics, and optional AI
                editing tools remain part of the platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Infinite Cultivation. A cultivation
              novel database, ranking hub, and creator platform.
            </p>
            <div className="flex gap-4 text-xs text-gray-400">
              <Link href="/library" className="hover:text-white">Library</Link>
              <Link href="/rankings" className="hover:text-white">Rankings</Link>
              <Link href="/lists" className="hover:text-white">Lists</Link>
              <Link href="/add-novel" className="hover:text-white">Add Novel</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}