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

type ProfileMini = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type ListItemPreview = {
  list_id: number;
  novel_id: string;
  novels: {
    id: string;
    slug: string;
    title: string;
    cover_image_url: string | null;
  } | null;
};

function profileLabel(profile: ProfileMini | undefined, userId: string) {
  if (profile?.display_name) return profile.display_name;
  if (profile?.username) return `@${profile.username}`;
  return `Cultivator ${userId.slice(0, 8)}`;
}

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function ListsPage() {
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("novel_lists")
    .select("id, title, description, user_id, is_public, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  const lists = (data as NovelList[] | null) ?? [];
  const listIds = lists.map((list) => list.id);

  const userIds = Array.from(new Set(lists.map((list) => list.user_id)));
  let profilesById = new Map<string, ProfileMini>();

  if (userIds.length > 0) {
    const { data: profileRows } = await admin
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);

    profilesById = new Map(
      ((profileRows as ProfileMini[] | null) ?? []).map((profile) => [
        profile.id,
        profile,
      ])
    );
  }

  const countsByList = new Map<number, number>();
  const previewsByList = new Map<number, ListItemPreview[]>();

  if (listIds.length > 0) {
    const { data: itemRows } = await admin
      .from("novel_list_items")
      .select(
        `
        list_id,
        novel_id,
        novels (
          id,
          slug,
          title,
          cover_image_url
        )
      `
      )
      .in("list_id", listIds)
      .order("created_at", { ascending: true });

    const items = (itemRows as ListItemPreview[] | null) ?? [];

    for (const item of items) {
      countsByList.set(item.list_id, (countsByList.get(item.list_id) ?? 0) + 1);

      const previews = previewsByList.get(item.list_id) ?? [];
      if (previews.length < 4 && item.novels) {
        previews.push(item);
        previewsByList.set(item.list_id, previews);
      }
    }
  }

  const ssr = await supabaseServerClient();
  const { data: userData } = await ssr.auth.getUser();
  const user = userData?.user ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-gray-100">
      <header className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
            Reader Collections
          </p>
          <h1 className="mt-1 text-3xl font-bold text-white">
            Community Lists
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Discover hand-picked cultivation and webnovel collections made by
            readers.
          </p>
        </div>

        <Link
          href={user ? "/create-list" : "/login"}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Create List
        </Link>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-500">Public lists</p>
          <p className="mt-1 text-2xl font-bold text-white">{lists.length}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-500">Novels collected</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {Array.from(countsByList.values()).reduce(
              (total, count) => total + count,
              0
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-500">Built by readers</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {new Set(lists.map((list) => list.user_id)).size}
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          Failed to load lists.
        </p>
      )}

      {lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
          <h2 className="text-lg font-semibold text-white">
            No public lists yet
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Create the first collection and help other readers find their next
            novel.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {lists.map((list) => {
            const profile = profilesById.get(list.user_id);
            const itemCount = countsByList.get(list.id) ?? 0;
            const previews = previewsByList.get(list.id) ?? [];

            return (
              <article
                key={list.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-indigo-500/70 hover:bg-white/[0.07]"
              >
                <Link href={`/list/${list.id}`} className="block p-5">
                  <div className="mb-4 flex min-h-24 items-end gap-2">
                    {previews.length > 0 ? (
                      previews.map((item) => {
                        const novel = item.novels;
                        if (!novel) return null;

                        const cover = (novel.cover_image_url || "").trim();
                        const hasCover = !!cover && isAssetUrl(cover);

                        return (
                          <div
                            key={item.novel_id}
                            className="h-24 w-16 overflow-hidden rounded-md border border-white/10 bg-black/30 shadow-lg"
                            title={novel.title}
                          >
                            {hasCover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={cover}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20" />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 text-xs text-gray-500">
                        No novels added yet
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="line-clamp-1 text-xl font-semibold text-white transition group-hover:text-indigo-200">
                        {list.title}
                      </h2>

                      {list.description ? (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-300">
                          {list.description}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm italic text-gray-500">
                          No description yet.
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs font-medium text-indigo-200">
                      {itemCount} {itemCount === 1 ? "novel" : "novels"}
                    </span>
                  </div>
                </Link>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3 text-xs text-gray-500">
                  <span>
                    Created {formatDate(list.created_at)}
                  </span>

                  <span>
                    by{" "}
                    {profile?.username ? (
                      <Link
                        href={`/user/${encodeURIComponent(profile.username)}`}
                        className="text-indigo-300 hover:underline"
                      >
                        {profileLabel(profile, list.user_id)}
                      </Link>
                    ) : (
                      profileLabel(profile, list.user_id)
                    )}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}