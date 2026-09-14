// app/user/[username]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type NovelList = {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
};

type Review = {
  id: number;
  title: string | null;
  review_text: string;
  contains_spoilers: boolean;
  updated_at: string;
  novels: {
    slug: string;
    title: string;
    cover_image_url: string | null;
  } | null;
};

type HostedNovel = {
  id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
  synopsis: string | null;
  primary_genre: string | null;
  chapters_total: number | null;
  avg_rating: number | null;
  view_count: number | null;
  hosted_story_id: string | null;
};

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

function pretty(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }> | { username: string };
}) {
  const p = (await params) as { username: string };
  const username = decodeURIComponent(p.username).trim();

  if (!username) return notFound();

  const sb = supabaseAdmin();

  const { data: profileData } = await sb
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url")
    .eq("username", username)
    .maybeSingle();

  const profile = profileData as Profile | null;

  if (!profile) return notFound();

  const [{ data: listRows }, { data: reviewRows }, { data: storyRows }] =
    await Promise.all([
      sb
        .from("novel_lists")
        .select("id, title, description, created_at")
        .eq("user_id", profile.id)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(12),
      sb
        .from("novel_reviews")
        .select(
          `
            id,
            title,
            review_text,
            contains_spoilers,
            updated_at,
            novels (
              slug,
              title,
              cover_image_url
            )
          `
        )
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(10),
      sb
        .from("stories")
        .select("id")
        .eq("user_id", profile.id)
        .eq("is_public", true),
    ]);

  const lists = (listRows as NovelList[] | null) ?? [];
  const reviews = (reviewRows as Review[] | null) ?? [];

  const publicStoryIds = ((storyRows as { id: string }[] | null) ?? []).map(
    (story) => story.id
  );

  let hostedNovels: HostedNovel[] = [];

  if (publicStoryIds.length > 0) {
    const { data: hostedRows } = await sb
      .from("novels")
      .select(
        "id, slug, title, cover_image_url, synopsis, primary_genre, chapters_total, avg_rating, view_count, hosted_story_id"
      )
      .in("hosted_story_id", publicStoryIds)
      .order("created_at", { ascending: false })
      .limit(12);

    hostedNovels = (hostedRows as HostedNovel[] | null) ?? [];
  }

  const avatar = (profile.avatar_url || "").trim();
  const hasAvatar = !!avatar && isAssetUrl(avatar);

  const displayName =
    profile.display_name ||
    profile.username ||
    `Cultivator ${profile.id.slice(0, 8)}`;

  const isAuthor = hostedNovels.length > 0;
  const totalHostedViews = hostedNovels.reduce(
    (sum, novel) => sum + (novel.view_count ?? 0),
    0
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-gray-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/library" className="text-sm text-indigo-300 hover:underline">
          ← Back to library
        </Link>

        <Link
          href="/lists"
          className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 hover:border-indigo-500 hover:text-white"
        >
          Community Lists
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="p-6 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              {hasAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20 text-3xl font-bold text-gray-300">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
                  Cultivator Profile
                </p>

                {isAuthor && (
                  <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] font-medium text-indigo-200">
                    Author
                  </span>
                )}
              </div>

              <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">
                {displayName}
              </h1>

              {profile.username && (
                <p className="mt-1 text-sm text-gray-400">@{profile.username}</p>
              )}

              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                {profile.bio || "No bio yet."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-white/10 bg-black/20 sm:grid-cols-4">
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500">Public Lists</p>
            <p className="mt-1 text-lg font-semibold text-white">{lists.length}</p>
          </div>

          <div className="border-l border-white/10 p-4 text-center">
            <p className="text-xs text-gray-500">Reviews</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {reviews.length}
            </p>
          </div>

          <div className="border-t border-white/10 p-4 text-center sm:border-l sm:border-t-0">
            <p className="text-xs text-gray-500">Published Novels</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {hostedNovels.length}
            </p>
          </div>

          <div className="border-l border-t border-white/10 p-4 text-center sm:border-t-0">
            <p className="text-xs text-gray-500">Novel Views</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {totalHostedViews.toLocaleString("en-US")}
            </p>
          </div>
        </div>
      </section>

      {isAuthor && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">
              Author Works
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Published Novels
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hostedNovels.map((novel) => {
              const cover = (novel.cover_image_url || "").trim();
              const hasCover = !!cover && isAssetUrl(cover);

              return (
                <Link
                  key={novel.id}
                  href={`/novel/${novel.slug}`}
                  className="group flex gap-3 rounded-xl border border-white/10 bg-black/25 p-3 transition hover:border-indigo-500/70 hover:bg-white/[0.08]"
                >
                  <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30">
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

                  <div className="min-w-0">
                    <h3 className="line-clamp-2 font-semibold text-white group-hover:text-indigo-200">
                      {novel.title}
                    </h3>

                    {novel.primary_genre && (
                      <p className="mt-1 text-xs text-indigo-300">
                        {pretty(novel.primary_genre)}
                      </p>
                    )}

                    <div className="mt-2 space-y-1 text-xs text-gray-500">
                      <p>{novel.chapters_total ?? "?"} chapters</p>
                      <p>
                        ★{" "}
                        {typeof novel.avg_rating === "number" &&
                        novel.avg_rating > 0
                          ? novel.avg_rating.toFixed(1)
                          : "—"}
                      </p>
                      <p>
                        {(novel.view_count ?? 0).toLocaleString("en-US")} views
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Public Lists</h2>
              <p className="text-sm text-gray-400">
                Collections curated by this reader.
              </p>
            </div>

            <Link href="/lists" className="text-xs text-indigo-300 hover:underline">
              Browse all
            </Link>
          </div>

          {lists.length === 0 ? (
            <p className="text-sm text-gray-400">No public lists yet.</p>
          ) : (
            <ul className="space-y-3">
              {lists.map((list) => (
                <li
                  key={list.id}
                  className="rounded-xl border border-white/10 bg-black/25 transition hover:border-indigo-500/70 hover:bg-white/[0.06]"
                >
                  <Link href={`/list/${list.id}`} className="block p-4">
                    <h3 className="font-semibold text-white">{list.title}</h3>

                    {list.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-300">
                        {list.description}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm italic text-gray-500">
                        No description.
                      </p>
                    )}

                    <p className="mt-2 text-xs text-gray-500">
                      {formatDate(list.created_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white">Recent Reviews</h2>
            <p className="text-sm text-gray-400">
              Recent thoughts shared with the community.
            </p>
          </div>

          {reviews.length === 0 ? (
            <p className="text-sm text-gray-400">No reviews yet.</p>
          ) : (
            <ul className="space-y-3">
              {reviews.map((review) => {
                const novel = review.novels;

                return (
                  <li
                    key={review.id}
                    className="rounded-xl border border-white/10 bg-black/25 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        {novel ? (
                          <Link
                            href={`/novel/${novel.slug}`}
                            className="line-clamp-1 text-sm font-semibold text-indigo-300 hover:underline"
                          >
                            {novel.title}
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold text-gray-400">
                            Unknown Novel
                          </p>
                        )}

                        <h3 className="mt-1 font-semibold text-white">
                          {review.title || "Untitled Review"}
                        </h3>
                      </div>

                      {review.contains_spoilers && (
                        <span className="rounded-full bg-red-500/15 px-2 py-1 text-[11px] font-medium text-red-300">
                          Spoilers
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(review.updated_at)}
                    </p>

                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                      {review.review_text}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}