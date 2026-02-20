// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050816] text-gray-100">
      {/* Top nav (simple, no new dependencies) */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#050816]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm font-bold">
              IC
            </span>
            <span className="font-semibold tracking-tight">Infinite Cultivation</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-gray-300 sm:flex">
            <Link href="/library" className="hover:text-white">
              Library
            </Link>
            <Link href="/dashboard" className="hover:text-white">
              Dashboard
            </Link>
            <Link href="/new" className="hover:text-white">
              New Story
            </Link>
            <Link href="/login" className="hover:text-white">
              Sign in
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/library"
              className="rounded-md border border-white/10 px-4 py-2 text-xs font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
            >
              Enter Library
            </Link>
            <Link
              href="/library"
              className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500"
            >
              Read featured
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          {/* Left: hero copy */}
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-400">
              Progression Fantasy · Xianxia · Cultivation
            </p>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Discover{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
                cultivation sagas
              </span>{" "}
              worth binging.
            </h1>

            <p className="max-w-xl text-sm text-gray-300 sm:text-base leading-relaxed">
              Infinite Cultivation is a home for long-form progression fantasy—built
              for readers, and powered with modern tools for creators. Titles, spirit
              stones, and a growing library of sagas designed to scale.
            </p>

            <div className="flex flex-wrap gap-4">
              {/* Primary CTA = Read featured */}
              <Link
                href="/library"
                className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500"
              >
                Read featured
              </Link>
              <Link
                href="/library"
                className="rounded-md border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
              >
                Enter the Library
              </Link>
              <Link
                href="/new"
                className="rounded-md border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
              >
                Start writing
              </Link>
            </div>

            {/* Quick highlights (reader-first, AI not front-and-center) */}
            <dl className="mt-6 grid gap-4 text-xs text-gray-300 sm:grid-cols-3 sm:text-sm">
              <div>
                <dt className="font-semibold text-white">Titles & ranks</dt>
                <dd className="text-gray-400">
                  Earn cultivation titles and display them beside your name as you
                  read and publish.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-white">Spirit stones</dt>
                <dd className="text-gray-400">
                  An in-world economy for perks, progression, and supporting creators.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-white">Built for sagas</dt>
                <dd className="text-gray-400">
                  Stories, chapters, and features designed for hundreds of chapters—
                  not one-shots.
                </dd>
              </div>
            </dl>
          </div>

          {/* Right: 3 featured “cards” (covers) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-100">Featured right now</h2>
              <Link href="/library" className="text-xs text-indigo-400 hover:underline">
                View all →
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {/* Card 1 */}
              <Link
                href="/library"
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg hover:border-indigo-500"
              >
                <div className="relative h-36 w-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/40 via-sky-500/20 to-emerald-500/20" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_45%)]" />
                  <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-indigo-200">
                    Xianxia · 143 ch
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-sm font-semibold text-white group-hover:text-white">
                    The Jade Tyrant’s Ascension
                  </div>
                  <div className="mt-1 text-xs text-gray-400">by Founding Author</div>
                  <p className="mt-2 text-xs text-gray-300 line-clamp-2">
                    Betrayed by his sect, he inherits a forbidden scripture—and the world
                    begins to remember his name.
                  </p>
                </div>
              </Link>

              {/* Card 2 */}
              <Link
                href="/library"
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg hover:border-indigo-500"
              >
                <div className="relative h-36 w-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/30 via-indigo-500/20 to-cyan-500/20" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.16),transparent_48%)]" />
                  <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-indigo-200">
                    System · 97 ch
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-sm font-semibold text-white">Heavenly System: Iron Oath</div>
                  <div className="mt-1 text-xs text-gray-400">by Founding Author</div>
                  <p className="mt-2 text-xs text-gray-300 line-clamp-2">
                    A ruthless progression system, impossible quests, and a protagonist who refuses
                    to kneel—ever.
                  </p>
                </div>
              </Link>

              {/* Card 3 */}
              <Link
                href="/library"
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg hover:border-indigo-500"
              >
                <div className="relative h-36 w-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/25 via-sky-500/15 to-indigo-500/25" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_60%,rgba(255,255,255,0.14),transparent_52%)]" />
                  <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-indigo-200">
                    Grimdark · 212 ch
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-sm font-semibold text-white">The Sects Will Burn</div>
                  <div className="mt-1 text-xs text-gray-400">by Founding Author</div>
                  <p className="mt-2 text-xs text-gray-300 line-clamp-2">
                    Every betrayal has a price. Every technique has a cost. The Dao is cruel—and so
                    is he.
                  </p>
                </div>
              </Link>
            </div>

            {/* Small helper CTA */}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Want to publish here?</p>
                  <p className="text-xs text-gray-400">
                    Founding beta perks + permanent titles for early creators.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/new"
                    className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    Apply / start writing
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-md border border-white/10 px-4 py-2 text-xs font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
                  >
                    Creator dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reader-first platform features */}
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white">A reader progression loop</h3>
            <p className="mt-2 text-sm text-gray-300 leading-relaxed">
              Gain titles, earn spirit stones, and build reputation as you binge and
              support the sagas you love.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white">Built for long stories</h3>
            <p className="mt-2 text-sm text-gray-300 leading-relaxed">
              Covers, chapters, dashboards, publishing, and discovery—designed for
              hundreds of chapters and ongoing arcs.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white">Creator tools (optional)</h3>
            <p className="mt-2 text-sm text-gray-300 leading-relaxed">
              Authors can draft faster with assistance like outlines, refinement, and
              continuity support—while staying fully in control.
            </p>
          </div>
        </div>
      </section>

      {/* For Authors (AI mentioned but not the headline) */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-black/20 p-6">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
                For Authors
              </p>
              <h2 className="text-2xl font-bold text-white">
                Write faster. Stay in control.
              </h2>
              <p className="text-sm text-gray-300 leading-relaxed">
                Publish chapters, manage covers, build an audience, and unlock platform
                progression. Creator assistance tools are available, but never required.
              </p>

              <ul className="mt-4 space-y-2 text-sm text-gray-300">
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  Better author-first terms (vs. legacy platforms)
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  Dashboard to continue, edit, and publish
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  Continuity + refinement helpers (optional)
                </li>
              </ul>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/new"
                  className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  Start a story
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-md border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
                >
                  Open dashboard
                </Link>
              </div>
            </div>

            {/* “How it works” (kept, but reframed so AI isn’t the hook) */}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-gray-100">How it works</h3>
              <ol className="mt-3 space-y-3 text-sm text-gray-300">
                <li>
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                    1
                  </span>
                  Create an account and start a story.
                </li>
                <li>
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                    2
                  </span>
                  Write chapters normally—or use optional drafting/refinement tools.
                </li>
                <li>
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                    3
                  </span>
                  Manage everything from your{" "}
                  <span className="font-semibold">Dashboard</span>.
                </li>
                <li>
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                    4
                  </span>
                  Publish to the{" "}
                  <span className="font-semibold">Library</span> so other cultivators
                  can read and follow.
                </li>
              </ol>

              <div className="mt-5 flex flex-wrap gap-3 text-xs">
                <Link
                  href="/login"
                  className="rounded-md bg-gray-900/70 px-4 py-2 font-medium text-gray-100 hover:bg-gray-800"
                >
                  Log in
                </Link>
                <Link
                  href="/library"
                  className="rounded-md border border-white/10 px-4 py-2 font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
                >
                  Browse stories
                </Link>
              </div>
            </div>
          </div>

          {/* tiny beta note */}
          <p className="mt-6 text-xs text-gray-500">
            Closed beta: early cultivators receive permanent founding titles and can shape the
            platform’s progression systems.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Infinite Cultivation. A progression fantasy platform for
              readers and creators.
            </p>
            <div className="flex gap-4 text-xs text-gray-400">
              <Link href="/library" className="hover:text-white">
                Library
              </Link>
              <Link href="/dashboard" className="hover:text-white">
                Dashboard
              </Link>
              <Link href="/new" className="hover:text-white">
                Start writing
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}