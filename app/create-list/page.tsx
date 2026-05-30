// app/create-list/page.tsx
import Link from "next/link";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const dynamic = "force-dynamic";

export default async function CreateListPage() {
  const sb = await supabaseServerClient();
  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">Create List</h1>
        <p className="mt-2 text-sm text-gray-400">
          Log in to create novel lists.
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
        <Link href="/lists" className="text-sm text-indigo-300 hover:underline">
          ← Back to lists
        </Link>
      </div>

      <h1 className="text-3xl font-bold">Create a Novel List</h1>
      <p className="mt-2 text-sm text-gray-400">
        Make shareable lists like “Best Ruthless MC Novels” or “Beginner Xianxia Reads.”
      </p>

      <form
        action="/api/create-list"
        method="post"
        className="mt-6 space-y-5 rounded-xl border border-white/10 bg-white/5 p-5"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-gray-300">Title</span>
          <input
            name="title"
            required
            placeholder="Best Xianxia for Beginners"
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-gray-300">Description</span>
          <textarea
            name="description"
            rows={5}
            placeholder="A starter list for readers getting into cultivation novels..."
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" name="is_public" defaultChecked />
          Public list
        </label>

        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Create List
        </button>
      </form>
    </main>
  );
}