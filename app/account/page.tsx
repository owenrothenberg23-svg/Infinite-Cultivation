// app/account/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  spirit_stones: number;
  current_title: string | null;
  titles: string[] | null;
};

export default function AccountPage() {
  const sb = supabaseBrowser();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      const { data: sessionData } = await sb.auth.getSession();

      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      const user = sessionData.session.user;
      setEmail(user.email ?? null);

      const { data, error } = await sb
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(error);
        setError("Could not load profile");
      } else {
        const p = data as any;
        setProfile({
          id: p.id,
          username: p.username ?? null,
          display_name: p.display_name ?? null,
          spirit_stones: p.spirit_stones ?? 0,
          current_title: p.current_title ?? null,
          titles: (p.titles as string[]) ?? [],
        });
      }

      setLoading(false);
    })();
  }, [router, sb]);

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
        {error ? <p className="text-red-400">{error}</p> : null}
        <p>No profile found.</p>
      </main>
    );
  }

  const displayName =
    profile.display_name || profile.username || email || "Cultivator";

  return (
    <main className="max-w-3xl mx-auto p-8 text-gray-200">
      <h1 className="text-3xl font-bold mb-4">Account</h1>

      {error ? <p className="mb-4 text-red-400">{error}</p> : null}

      <section className="mb-6 space-y-1">
        <h2 className="text-lg font-semibold">Basic info</h2>
        <p>
          <span className="font-medium">Display name:</span> {displayName}
        </p>
        <p>
          <span className="font-medium">Email:</span> {email}
        </p>
        <p>
          <span className="font-medium">Username:</span>{" "}
          {profile.username ?? "—"}
        </p>
      </section>

      <section className="mb-6 space-y-1">
        <h2 className="text-lg font-semibold">Spirit Stones</h2>
        <p className="text-2xl font-bold text-emerald-400">
          {profile.spirit_stones ?? 0} <span className="text-sm">stones</span>
        </p>
        <p className="text-sm text-gray-400">
          (Later we’ll hook this up to purchases, referrals, and chapter
          unlocks.)
        </p>
      </section>

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
