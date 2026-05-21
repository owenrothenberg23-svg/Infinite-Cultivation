// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050816] text-gray-100">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#050816]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm font-bold">
              IC
            </span>
            <span className="font-semibold tracking-tight">
              Infinite Cultivation
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-gray-300 sm:flex">
            <Link href="/library" className="hover:text-white">Library</Link>
            <Link href="/rankings" className="hover:text-white">Rankings</Link>
            <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
            <Link href="/new" className="hover:text-white">Create</Link>
            <Link href="/login" className="hover:text-white">Sign in</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/library"
              className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500"
            >
              Explore Novels
            </Link>
          </div>
        </div>
      </header>

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
              reading lists, power systems, recommendations, and community-built
              novel pages.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/library"
                className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500"
              >
                Browse the Database
              </Link>
              <Link
                href="/rankings"
                className="rounded-md border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
              >
                View Rankings
              </Link>
              <Link
                href="/new"
                className="rounded-md border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
              >
                Add / Create a Story
              </Link>
            </div>

            <dl className="mt-6 grid gap-4 text-xs text-gray-300 sm:grid-cols-3 sm:text-sm">
              <div>
                <dt className="font-semibold text-white">Rank everything</dt>
                <dd className="text-gray-400">
                  Best MCs, best power systems, best completed novels, darkest
                  stories, smartest protagonists, and more.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-white">Find your next binge</dt>
                <dd className="text-gray-400">
                  Filter by tropes, tags, tone, pacing, romance, darkness,
                  completion status, and reader ratings.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-white">Community profiles</dt>
                <dd className="text-gray-400">
                  Save novels, review stories, earn titles, and build your
                  reader identity.
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
                Coming next
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">
                Novel pages, rankings, and recommendation lists.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                We’re expanding beyond hosted stories into a full webnovel index:
                external novel pages, community ratings, trope filters, similar
                reads, cultivation systems, and ranked lists.
              </p>

              <div className="mt-5 grid gap-3 text-sm text-gray-300">
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <b className="text-white">Top 100 Cultivation Novels</b>
                  <p className="mt-1 text-xs text-gray-400">
                    Community-driven rankings for the genre.
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <b className="text-white">Trope & Tag Discovery</b>
                  <p className="mt-1 text-xs text-gray-400">
                    Find ruthless MC, regression, sect building, alchemy, system,
                    kingdom building, and more.
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <b className="text-white">Reader Lists</b>
                  <p className="mt-1 text-xs text-gray-400">
                    Track what you’ve read, save future reads, and share lists.
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
                  href="/dashboard?tab=reader"
                  className="rounded-md border border-white/10 px-4 py-2 text-xs font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
                >
                  My Saves
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm font-semibold text-white">
                Authors still have a home here.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Hosted originals, creator dashboards, analytics, and optional AI
                editing tools remain part of the platform — just no longer the
                entire identity.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white">
              For readers
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              Discover, rank, review, save, and compare cultivation novels across
              the entire webnovel ecosystem.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white">
              For authors
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              Publish hosted originals, track analytics, receive support, and use
              optional editing tools to improve chapter quality.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white">
              For the genre
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              A dedicated home for xianxia, cultivation, progression fantasy,
              power systems, sects, realms, and immortal ascension.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-black/20 p-6">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
                The pivot
              </p>
              <h2 className="text-2xl font-bold text-white">
                From story generator to cultivation discovery engine.
              </h2>
              <p className="text-sm leading-relaxed text-gray-300">
                The future of Infinite Cultivation is a living database: novel
                pages, rankings, tags, reviews, reader profiles, author tools,
                and community-powered recommendations.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/library"
                  className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  Browse novels
                </Link>
                <Link
                  href="/new"
                  className="rounded-md border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
                >
                  Add a story
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-gray-100">
                Roadmap
              </h3>
              <ol className="mt-3 space-y-3 text-sm text-gray-300">
                <li>
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                    1
                  </span>
                  Build universal novel pages.
                </li>
                <li>
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                    2
                  </span>
                  Add rankings and advanced filters.
                </li>
                <li>
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                    3
                  </span>
                  Add reader lists, reviews, and profiles.
                </li>
                <li>
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                    4
                  </span>
                  Use AI for summaries, tags, recommendations, and author tools.
                </li>
              </ol>
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
              <Link href="/library" className="hover:text-white">
                Library
              </Link>
              <Link href="/rankings" className="hover:text-white">
                Rankings
              </Link>
              <Link href="/dashboard" className="hover:text-white">
                Dashboard
              </Link>
              <Link href="/new" className="hover:text-white">
                Create
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}