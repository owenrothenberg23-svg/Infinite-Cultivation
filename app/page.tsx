// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050816] text-gray-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16 lg:flex-row lg:items-center">
        {/* Hero text */}
        <section className="flex-1 space-y-6">
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-400">
            AI-Driven Cultivation Stories
          </p>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Forge {" "}
            <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
              endless sagas
            </span>{" "}
            with a single click.
             </h1>
<p className="mt-4 text-gray-300 leading-relaxed">
  What if the 1,000 chapter cultivation novel never had to end?
  Binge endless sagas as a reader - or craft, edit, and expand your own as an author, with AI as your assistant.
</p>
          <p className="max-w-xl text-sm text-gray-300 sm:text-base">
            Infinite Cultivation is a dedicated story engine for high-level
            Xianxia and fantasy writing. Describe the kind of journey you want,
            set a few preferences, and let a prose-focused AI craft chapters
            with coherent plots, rich worldbuilding, and polished narration
            all under your own account.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/new"
              className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500"
            >
              Start a new saga
            </Link>
            <Link
              href="/library"
              className="rounded-md border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
            >
              Browse public stories
            </Link>
          </div>

          {/* Quick highlights */}
          <dl className="mt-6 grid gap-4 text-xs text-gray-300 sm:grid-cols-3 sm:text-sm">
            <div>
              <dt className="font-semibold text-white">High-level AI prose</dt>
              <dd className="text-gray-400">
                Chapters are generated to read like refined web-novel writing,
                not rough drafts or outlines.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-white">Spirit stones</dt>
              <dd className="text-gray-400">
                A simple in-world currency to power generation and unlock extra
                features. (1 Spirit Stone = 1 Chapter Generated)
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-white">
                Titles & reputation
              </dt>
              <dd className="text-gray-400">
                Earn sect titles and display them beside your name as you
                publish and grow your legend.
              </dd>
            </div>
          </dl>
        </section>

        {/* Right-hand “card” with current core loop */}
        <section className="flex-1">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg">
            <h2 className="text-sm font-semibold text-gray-100">
              How it works
            </h2>
            <ol className="mt-3 space-y-3 text-sm text-gray-300">
              <li>
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                  1
                </span>
                Sign up or log in with your email.
              </li>
              <li>
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                  2
                </span>
                Go to <span className="font-semibold">New Story</span> and give
                the AI a premise, tone, and a few preferences.
              </li>
              <li>
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                  3
                </span>
                Generate chapters from your{" "}
                <span className="font-semibold">Dashboard</span> and guide the
                direction over time.
              </li>
              <li>
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                  4
                </span>
                Publish to the{" "}
                <span className="font-semibold">Library</span> so other
                cultivators can read, rate, and comment.
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
                href="/dashboard"
                className="rounded-md border border-white/10 px-4 py-2 font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
              >
                Go to dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
