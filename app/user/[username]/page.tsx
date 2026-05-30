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

function isAssetUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
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

  const { data: listRows } = await sb
    .from("novel_lists")
    .select("id, title, description, created_at")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(12);

  const lists = (listRows as NovelList[] | null) ?? [];

  const { data: reviewRows } = await sb
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
    .limit(10);

  const reviews = (reviewRows as Review[] | null) ?? [];

  const avatar = (profile.avatar_url || "").trim();
  const hasAvatar = !!avatar && isAssetUrl(avatar);

  const displayName =
    profile.display_name || profile.username || `Cultivator ${profile.id.slice(0, 8)}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <div className="mb-6">
        <Link href="/library" className="text-sm text-indigo-300 hover:underline">
          ← Back to database
        </Link>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            {hasAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/20 text-xl font-bold text-gray-300">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
              Cultivator Profile
            </p>
            <h1 className="mt-1 text-3xl font-bold text-white">{displayName}</h1>
            {profile.username && (
              <p className="mt-1 text-sm text-gray-400">@{profile.username}</p>
            )}

            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
              {profile.bio || "No bio yet."}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Public Lists</h2>
              <p className="text-sm text-gray-400">
                Curated novel lists from this cultivator.
              </p>
            </div>
            <Link
              href="/lists"
              className="text-xs text-indigo-300 hover:underline"
            >
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
                  className="rounded-lg border border-white/10 bg-black/30 p-4 hover:border-indigo-500"
                >
                  <Link href={`/list/${list.id}`} className="block">
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

        <aside className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-semibold text-white">Profile Stats</h2>

          <div className="mt-4 grid gap-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <p className="text-xs text-gray-400">Public Lists</p>
              <p className="mt-1 text-lg font-semibold text-white">{lists.length}</p>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <p className="text-xs text-gray-400">Recent Reviews</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {reviews.length}
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-semibold text-white">Recent Reviews</h2>

        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">No reviews yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {reviews.map((review) => {
              const novel = review.novels;

              return (
                <li
                  key={review.id}
                  className="rounded-lg border border-white/10 bg-black/30 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {novel ? (
                        <Link
                          href={`/novel/${novel.slug}`}
                          className="text-sm font-semibold text-indigo-300 hover:underline"
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

                      <p className="text-xs text-gray-500">
                        {formatDate(review.updated_at)}
                      </p>
                    </div>

                    {review.contains_spoilers && (
                      <span className="rounded-full bg-red-500/15 px-2 py-1 text-[11px] font-medium text-red-300">
                        Spoilers
                      </span>
                    )}
                  </div>

                  <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                    {review.review_text}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}