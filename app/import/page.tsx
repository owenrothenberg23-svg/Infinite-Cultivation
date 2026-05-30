// app/import/page.tsx
import Link from "next/link";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const dynamic = "force-dynamic";

export default async function ImportNovelPage() {
  const sb = await supabaseServerClient();
  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">Submit Novel</h1>
        <p className="mt-2 text-sm text-gray-400">
          Log in to submit novels to the import queue.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-gray-100">
      <div className="mb-6">
        <Link href="/library" className="text-sm text-indigo-300 hover:underline">
          ← Back to database
        </Link>
      </div>

      <h1 className="text-3xl font-bold">Submit Novel</h1>
      <p className="mt-2 text-sm text-gray-400">
        Paste a source URL or basic novel info. This goes into an approval queue before entering the database.
      </p>

      <form
        action="/api/import-novel"
        method="post"
        className="mt-6 space-y-5 rounded-xl border border-white/10 bg-white/5 p-5"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-gray-300">Source URL</span>
          <input
            name="source_url"
            placeholder="https://..."
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-gray-300">Title</span>
          <input
            name="raw_title"
            placeholder="Novel title"
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-gray-300">Raw Notes / Copied Metadata</span>
          <textarea
            name="raw_payload"
            rows={8}
            placeholder="Paste synopsis, author, tags, status, chapter count, source notes, etc."
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
          />
        </label>

        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Submit to Queue
        </button>
      </form>
    </main>
  );
}