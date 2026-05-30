// app/lists/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const dynamic = "force-dynamic";

type NovelList = {
  id: number;
  title: string;
  description: string | null;
  user_id: string;
  is_public: boolean;
  created_at: string;
};

export default async function ListsPage() {
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("novel_lists")
    .select("id, title, description, user_id, is_public, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  const lists = (data as NovelList[] | null) ?? [];

  const ssr = await supabaseServerClient();
  const { data: userData } = await ssr.auth.getUser();
  const user = userData?.user ?? null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Community Lists</h1>
          <p className="text-sm text-gray-400">
            Curated cultivation and webnovel lists made by readers.
          </p>
        </div>

        <Link
          href={user ? "/create-list" : "/login"}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Create List
        </Link>
      </header>

      {error && (
        <p className="mb-4 text-sm text-red-400">Failed to load lists.</p>
      )}

      {lists.length === 0 ? (
        <p className="text-sm text-gray-400">
          No public lists yet. Create the first one.
        </p>
      ) : (
        <ul className="space-y-4">
          {lists.map((list) => (
            <li
              key={list.id}
              className="rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-indigo-500 hover:bg-white/10"
            >
              <Link href={`/list/${list.id}`} className="block">
                <h2 className="text-lg font-semibold text-white">
                  {list.title}
                </h2>
                {list.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-300">
                    {list.description}
                  </p>
                ) : (
                  <p className="mt-1 text-sm italic text-gray-500">
                    No description yet.
                  </p>
                )}
                <p className="mt-3 text-xs text-gray-500">
                  Cultivator {list.user_id.slice(0, 8)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}