import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const dynamic = "force-dynamic";

type Novel = {
  id: string;
  title: string;
  slug: string;
  author_name: string | null;
};

function isAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return !!email && admins.includes(email.toLowerCase());
}

export default async function AdminRelationshipsPage() {
  const ssr = await supabaseServerClient();
  const { data: userData } = await ssr.auth.getUser();
  const user = userData?.user ?? null;

  if (!isAdmin(user?.email)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">Novel Relationships</h1>
        <p className="mt-2 text-sm text-gray-400">
          You are not authorized to view this page.
        </p>
      </main>
    );
  }

  const admin = supabaseAdmin();

  const { data } = await admin
    .from("novels")
    .select("id, title, slug, author_name")
    .order("title", { ascending: true })
    .limit(1000);

  const novels = (data as Novel[] | null) ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Novel Relationships</h1>
          <p className="mt-2 text-sm text-gray-400">
            Connect novels so pages can show “Readers Also Enjoyed.”
          </p>
        </div>

        <Link
          href="/library"
          className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-indigo-500 hover:text-white"
        >
          Library
        </Link>
      </div>

      <form
        action="/api/admin/relationships"
        method="post"
        className="rounded-xl border border-white/10 bg-white/5 p-5"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-300">Main Novel</span>
            <select
              name="novel_id"
              required
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
            >
              <option value="">Select novel...</option>
              {novels.map((novel) => (
                <option key={novel.id} value={novel.id}>
                  {novel.title} {novel.author_name ? `— ${novel.author_name}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-300">Related Novel</span>
            <select
              name="related_novel_id"
              required
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
            >
              <option value="">Select related novel...</option>
              {novels.map((novel) => (
                <option key={novel.id} value={novel.id}>
                  {novel.title} {novel.author_name ? `— ${novel.author_name}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-300">Score</span>
            <input
              name="score"
              type="number"
              min="0"
              step="0.1"
              defaultValue="1"
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
            />
          </label>

          <label className="flex items-end gap-2 text-sm text-gray-300">
            <input type="checkbox" name="bidirectional" defaultChecked />
            Add both directions
          </label>
        </div>

        <button
          type="submit"
          className="mt-5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Add Relationship
        </button>
      </form>

      <section className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Tip</h2>
        <p className="mt-2 text-sm text-gray-400">
          Use higher scores for stronger similarity. Example: Reverend Insanity ↔
          Warlock of the Magus World might be stronger than Reverend Insanity ↔
          a generic xianxia.
        </p>
      </section>
    </main>
  );
}