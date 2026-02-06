// app/account/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  spirit_stones: number;
  chapter_credits: number;
  current_title: string | null;
  titles: string[] | null;
};

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const sb = supabaseBrowser();

      // 1) Get session
      const { data: sessionData, error: sessionError } =
        await sb.auth.getSession();

      if (sessionError) {
        console.warn("auth.getSession error:", sessionError);
      }

      const session = sessionData?.session;

      // If no session, send to login (no infinite loop)
      if (!session) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      const user = session.user;
      setEmail(user.email ?? null);

      // 2) Try to load profile row
      const { data, error: profileError } = await sb
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle(); // <-- no hard error if not found

      if (profileError) {
        console.warn("profiles select error:", profileError);
        setError("Could not load profile");
        setProfile(null);
        setLoading(false);
        return;
      }

      let row = data;

      // 3) If no row exists yet, create a default one for this user
      if (!row) {
       const usernameFromMeta =
  (user.user_metadata?.username as string | undefined)?.trim() || null;

const usernameFromEmail = user.email
  ? user.email.split("@")[0]
  : null;

const desiredUsername = usernameFromMeta || usernameFromEmail;


        const { data: inserted, error: insertError } = await sb
          .from("profiles")
          .insert({
            id: user.id,
            username: usernameFromEmail,
            display_name: null,
            avatar_url: null,
            bio: null,
            spirit_stones: 0,
            chapter_credits: 0,
          })
          .select("*")
          .single();

        if (insertError || !inserted) {
          console.warn("profile insert error:", insertError);
          setError("Could not load profile");
          setProfile(null);
          setLoading(false);
          return;
        }

        row = inserted;
      }

      // 4) Normalize into our Profile type
      const p: Profile = {
        id: row.id,
        username: row.username ?? null,
        display_name: row.display_name ?? null,
        avatar_url: row.avatar_url ?? null,
        bio: row.bio ?? null,
        spirit_stones: row.spirit_stones ?? 0,
        chapter_credits: row.chapter_credits ?? 0,
        current_title: row.current_title ?? null,
        titles: (row.titles as string[] | null) ?? null,
      };

      setProfile(p);
      setLoading(false);
    };

    // run once on mount – no sb in deps to avoid re-runs/flicker
    // eslint-disable-next-line react-hooks/exhaustive-deps
    load();
  }, [router]);

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto p-8 text-gray-200">
        <p>Loading account…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="max-w-3xl mx-auto p-8 text-gray-200">
        <h1 className="text-2xl font-bold mb-4">Account</h1>
        {error ? <p className="text-red-400 mb-2">{error}</p> : null}
        <p>No profile found for this account.</p>
      </main>
    );
  }

  const displayName =
    profile.display_name || profile.username || email || "Cultivator";

  return (
    <main className="max-w-3xl mx-auto p-8 text-gray-200">
      <h1 className="text-3xl font-bold mb-4">Account</h1>

      {error ? <p className="mb-4 text-red-400">{error}</p> : null}

      {/* Basic info */}
      <section className="mb-6 space-y-1">
        <h2 className="text-lg font-semibold">Basic info</h2>
        <p>
          <span className="font-medium">Email:</span> {email}
        </p>
        <p>
          <span className="font-medium">Username:</span>{" "}
          {profile.username ?? "—"}
        </p>
        <p>
          <span className="font-medium">Display name:</span> {displayName}
        </p>
        {profile.bio ? (
          <p className="text-sm text-gray-300 mt-1">
            <span className="font-medium">Bio:</span> {profile.bio}
          </p>
        ) : null}
      </section>

      {/* Spirit Stones */}
      <section className="mb-6 space-y-1">
        <h2 className="text-lg font-semibold">Spirit Stones</h2>
        <p className="text-2xl font-bold text-emerald-400">
          {profile.spirit_stones}{" "}
          <span className="text-sm font-normal text-gray-300">stones</span>
        </p>
        <p className="text-sm text-gray-400">
          (Later we’ll hook this up to purchases, referrals, and chapter
          unlocks.)
        </p>
      </section>

      {/* Chapter credits */}
      <section className="mb-6 space-y-1">
        <h2 className="text-lg font-semibold">Chapter credits</h2>
        <p className="text-xl font-semibold">
          {profile.chapter_credits}{" "}
          <span className="text-sm font-normal text-gray-300">credits</span>
        </p>
      </section>

      {/* Title */}
      <section className="mb-6 space-y-1">
        <h2 className="text-lg font-semibold">Title</h2>
        <p>
          <span className="font-medium">Equipped title:</span>{" "}
          {profile.current_title ?? "None equipped"}
        </p>
        <button
          onClick={() => router.push("/titles")}
          className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Manage titles
        </button>
      </section>

      <button
        onClick={async () => {
          const sb = supabaseBrowser();
          await sb.auth.signOut();
          router.replace("/login");
        }}
        className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
      >
        Sign out
      </button>
    </main>
  );
}
