// app/beta/page.tsx
import Link from "next/link";

export default function BetaGatePage() {
  const discord = process.env.NEXT_PUBLIC_DISCORD_INVITE || "";

  return (
    <main className="min-h-screen bg-[#050816] text-gray-100">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-xs uppercase tracking-[0.25em] text-indigo-400">
          Closed Beta
        </p>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Infinite Cultivation is currently invite-only.
        </h1>

        <p className="mt-4 text-gray-300 leading-relaxed">
          You&apos;re signed in, but your email isn&apos;t on the beta allowlist yet.
          If you have an invite, ask the dev to add your email. If you don&apos;t,
          join the Discord and request access.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-md border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Try again
          </Link>

          <Link
            href="/login"
            className="rounded-md bg-gray-900/70 px-5 py-2.5 text-sm font-semibold text-gray-100 hover:bg-gray-800"
          >
            Switch account
          </Link>

          {discord ? (
            <a
              href={discord}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Join Discord
            </a>
          ) : null}
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
          <p className="font-semibold text-white">For the dev:</p>
          <p className="mt-2">
            Add them via Supabase:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-gray-200">
{`insert into public.beta_allowlist (email, note)
values ('their@email.com', 'discord');`}
          </pre>
        </div>
      </div>
    </main>
  );
}
