// app/list/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const dynamic = "force-dynamic";

type Params = { id: string };

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

type ListItem = {
  id: number;
  novel_id: string;
  novels: {
    id: string;
    slug: string;
    title: string;
    author_name: string | null;
    synopsis: string | null;
    cover_image_url: string | null;
    avg_rating: number | null;
    rating_count: number | null;
    view_count: number | null;
    primary_genre: string | null;
    chapters_total: number | null;
    status: string | null;
  } | null;
};

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

function profileLabel(profile: ProfileMini | null, userId: string) {
  if (profile?.display_name) return profile.display_name;
  if (profile?.username) return `@${profile.username}`;
  return `Cultivator ${userId.slice(0, 8)}`;
}

function pretty(value: string | null | undefined) {
  if (!value) return "Unknown";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function ListPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const p = (await params) as Params;
  const listId = Number(p.id);

  if (!Number.isFinite(listId)) {
    return notFound();
  }

  const admin = supabaseAdmin();

  const { data: listData } = await admin
    .from("novel_lists")
    .select(
      "id, title, description, user_id, is_public, created_at"
    )
    .eq("id", listId)
    .maybeSingle();

  const list = listData as NovelList | null;

  if (!list) {
    return notFound();
  }

  /*
   * Public lists can be viewed by anyone.
   *
   * Private lists can only be viewed by their owner.
   */
  let isOwner = false;

  if (!list.is_public) {
    const sb = await supabaseServerClient();

    const { data: userData } =
      await sb.auth.getUser();

    const user = userData?.user ?? null;

    if (!user || user.id !== list.user_id) {
      return notFound();
    }

    isOwner = true;
  } else {
    /*
     * For public lists, determine ownership too so we can
     * show an owner badge without requiring authentication.
     */
    const sb = await supabaseServerClient();

    const { data: userData } =
      await sb.auth.getUser();

    const user = userData?.user ?? null;

    isOwner = !!user && user.id === list.user_id;
  }

  const { data: profileData } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .eq("id", list.user_id)
    .maybeSingle();

  const profile =
    profileData as ProfileMini | null;

  const { data: itemRows } = await admin
    .from("novel_list_items")
    .select(
      `
      id,
      novel_id,
      novels (
        id,
        slug,
        title,
        author_name,
        synopsis,
        cover_image_url,
        avg_rating,
        rating_count,
        view_count,
        primary_genre,
        chapters_total,
        status
      )
    `
    )
    .eq("list_id", list.id)
    .order("created_at", {
      ascending: true,
    });

  const items =
    (itemRows as ListItem[] | null) ?? [];

  const validItems = items.filter(
    (item) => item.novels
  );

  const totalViews = validItems.reduce(
    (sum, item) =>
      sum + (item.novels?.view_count ?? 0),
    0
  );

  const ratedNovels = validItems.filter(
    (item) =>
      typeof item.novels?.avg_rating ===
        "number" &&
      (item.novels?.avg_rating ?? 0) > 0
  );

  const averageRating =
    ratedNovels.length > 0
      ? ratedNovels.reduce(
          (sum, item) =>
            sum +
            (item.novels?.avg_rating ?? 0),
          0
        ) / ratedNovels.length
      : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-gray-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/lists"
          className="text-sm text-indigo-300 hover:underline"
        >
          ← Back to lists
        </Link>

        <Link
          href="/library"
          className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 hover:border-indigo-500 hover:text-white"
        >
          Browse Library
        </Link>
      </div>

      <header className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
              {list.is_public
                ? "Community List"
                : "Private List"}
            </p>

            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] text-gray-400">
              {validItems.length}{" "}
              {validItems.length === 1
                ? "novel"
                : "novels"}
            </span>

            {!list.is_public && (
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
                Private
              </span>
            )}

            {isOwner && (
              <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2.5 py-1 text-[11px] font-medium text-indigo-200">
                Your list
              </span>
            )}
          </div>

          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            {list.title}
          </h1>

          {list.description ? (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300">
              {list.description}
            </p>
          ) : (
            <p className="mt-3 text-sm italic text-gray-500">
              No description yet.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
            <span>
              Created by{" "}
              {profile?.username ? (
                <Link
                  href={`/user/${encodeURIComponent(
                    profile.username
                  )}`}
                  className="text-indigo-300 hover:underline"
                >
                  {profileLabel(
                    profile,
                    list.user_id
                  )}
                </Link>
              ) : (
                profileLabel(
                  profile,
                  list.user_id
                )
              )}
            </span>

            <span>
              Created{" "}
              {formatDate(list.created_at)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 border-t border-white/10 bg-black/20">
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500">
              Novels
            </p>

            <p className="mt-1 text-lg font-semibold text-white">
              {validItems.length}
            </p>
          </div>

          <div className="border-x border-white/10 p-4 text-center">
            <p className="text-xs text-gray-500">
              Avg. Rating
            </p>

            <p className="mt-1 text-lg font-semibold text-white">
              {averageRating !== null
                ? `★ ${averageRating.toFixed(2)}`
                : "—"}
            </p>
          </div>

          <div className="p-4 text-center">
            <p className="text-xs text-gray-500">
              Combined Views
            </p>

            <p className="mt-1 text-lg font-semibold text-white">
              {totalViews.toLocaleString(
                "en-US"
              )}
            </p>
          </div>
        </div>
      </header>

      {validItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
          <h2 className="text-lg font-semibold text-white">
            This list is empty
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            No novels have been added yet.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {validItems.map(
            (item, index) => {
              const novel = item.novels;

              if (!novel) {
                return null;
              }

              const cover = (
                novel.cover_image_url || ""
              ).trim();

              const hasCover =
                !!cover &&
                isAssetUrl(cover);

              return (
                <li
                  key={item.id}
                  className="group rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-indigo-500/70 hover:bg-white/[0.08]"
                >
                  <Link
                    href={`/novel/${novel.slug}`}
                    className="block"
                  >
                    <div className="flex gap-4">
                      <div className="flex w-10 shrink-0 items-start justify-center pt-2 text-xl font-bold text-indigo-300 sm:text-2xl">
                        #{index + 1}
                      </div>

                      <div className="h-32 w-24 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30 sm:h-36 sm:w-24">
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

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="line-clamp-2 text-lg font-semibold text-white transition group-hover:text-indigo-200">
                              {novel.title}
                            </h2>

                            <p className="mt-0.5 text-xs text-gray-400">
                              by{" "}
                              {novel.author_name ||
                                "Unknown author"}
                            </p>
                          </div>

                          {novel.primary_genre && (
                            <span className="shrink-0 rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] text-indigo-200">
                              {pretty(
                                novel.primary_genre
                              )}
                            </span>
                          )}
                        </div>

                        {novel.synopsis && (
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-300">
                            {novel.synopsis}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                          <span>
                            ★{" "}
                            {typeof novel.avg_rating ===
                              "number" &&
                            novel.avg_rating > 0
                              ? novel.avg_rating.toFixed(
                                  1
                                )
                              : "—"}

                            {novel.rating_count
                              ? ` (${novel.rating_count.toLocaleString(
                                  "en-US"
                                )})`
                              : ""}
                          </span>

                          <span>
                            {(
                              novel.view_count ?? 0
                            ).toLocaleString(
                              "en-US"
                            )}{" "}
                            views
                          </span>

                          <span>
                            {novel.chapters_total ??
                              "?"}{" "}
                            chapters
                          </span>

                          <span>
                            {pretty(
                              novel.status
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="hidden shrink-0 items-center text-xl text-gray-600 transition group-hover:text-indigo-300 sm:flex">
                        →
                      </div>
                    </div>
                  </Link>
                </li>
              );
            }
          )}
        </ol>
      )}
    </main>
  );
}