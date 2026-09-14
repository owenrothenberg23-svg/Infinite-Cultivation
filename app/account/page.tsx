"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
}

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const sb = supabaseBrowser();
      const { data: sessionData, error: sessionError } = await sb.auth.getSession();
      if (sessionError) console.warn("Account: auth.getSession error", sessionError);
      const session = sessionData?.session;
      if (!session) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      const user = session.user;
      setEmail(user.email ?? null);
      const { data, error: profileError } = await sb
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.warn("Account: profile select error", profileError);
        setError("Could not load your profile.");
        setLoading(false);
        return;
      }

      let row = data;
      if (!row) {
        const metadataUsername = typeof user.user_metadata?.username === "string"
          ? normalizeUsername(user.user_metadata.username)
          : "";
        const emailUsername = user.email ? normalizeUsername(user.email.split("@")[0]) : "";
        const desiredUsername = metadataUsername || emailUsername || null;

        const { data: inserted, error: insertError } = await sb
          .from("profiles")
          .insert({ id: user.id, username: desiredUsername, display_name: null, avatar_url: null, bio: null })
          .select("id, username, display_name, avatar_url, bio")
          .single();

        if (insertError || !inserted) {
          console.warn("Account: profile insert error", insertError);
          setError("Your account is signed in, but a profile could not be created automatically.");
          setLoading(false);
          return;
        }
        row = inserted;
      }

      const loaded: Profile = {
        id: row.id,
        username: row.username ?? null,
        display_name: row.display_name ?? null,
        avatar_url: row.avatar_url ?? null,
        bio: row.bio ?? null,
      };
      setProfile(loaded);
      setUsername(loaded.username ?? "");
      setDisplayName(loaded.display_name ?? "");
      setBio(loaded.bio ?? "");
      setLoading(false);
    };
    load();
  }, [router]);

  async function handleSave() {
    if (!profile) return;
    setError(null);
    setSuccess(null);
    const cleanedUsername = normalizeUsername(username);
    if (cleanedUsername.length < 3) return setError("Username must be at least 3 characters.");
    if (displayName.trim().length > 60) return setError("Display name must be 60 characters or fewer.");
    if (bio.trim().length > 500) return setError("Bio must be 500 characters or fewer.");

    setSaving(true);
    try {
      const sb = supabaseBrowser();
      const { data: sessionData } = await sb.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: updated, error: updateError } = await sb
        .from("profiles")
        .update({ username: cleanedUsername, display_name: displayName.trim() || null, bio: bio.trim() || null })
        .eq("id", session.user.id)
        .select("id, username, display_name, avatar_url, bio")
        .single();

      if (updateError) {
        console.warn("Account: profile update error", updateError);
        if (updateError.code === "23505" || updateError.message.toLowerCase().includes("duplicate")) {
          setError("That username is already taken.");
        } else {
          setError("Could not save your profile.");
        }
        return;
      }

      const next: Profile = {
        id: updated.id,
        username: updated.username ?? null,
        display_name: updated.display_name ?? null,
        avatar_url: updated.avatar_url ?? null,
        bio: updated.bio ?? null,
      };
      setProfile(next);
      setUsername(next.username ?? "");
      setDisplayName(next.display_name ?? "");
      setBio(next.bio ?? "");
      setSuccess("Profile saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const sb = supabaseBrowser();
    await sb.auth.signOut();
    router.replace("/login");
  }

  if (loading) return <main className="mx-auto max-w-3xl p-8 text-gray-200"><p>Loading account…</p></main>;
  if (!profile) return <main className="mx-auto max-w-3xl p-8 text-gray-200"><h1 className="mb-4 text-2xl font-bold">Account</h1>{error ? <p className="text-red-400">{error}</p> : null}</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-gray-200 sm:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">Your identity</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Account</h1>
          <p className="mt-2 max-w-xl text-sm text-gray-400">Manage the profile readers and authors see across Infinite Cultivation.</p>
        </div>
        {profile.username ? <Link href={`/user/${encodeURIComponent(profile.username)}`} className="rounded-md border border-white/10 bg-black/30 px-4 py-2 text-sm font-medium text-gray-200 hover:border-indigo-500 hover:text-white">View public profile</Link> : null}
      </div>

      {error ? <div className="mb-5 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div> : null}
      {success ? <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">{success}</div> : null}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">Public profile</h2>
          <p className="mt-1 text-sm text-gray-400">Your username is used in your public profile URL. Display name and bio are optional.</p>
        </div>
        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-gray-200">Username</span>
            <input value={username} onChange={(e) => setUsername(normalizeUsername(e.target.value))} autoComplete="username" maxLength={30} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-indigo-500" placeholder="cultivator_name" />
            <span className="mt-1 block text-xs text-gray-500">3–30 characters. Lowercase letters, numbers, and underscores.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-200">Display name</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-indigo-500" placeholder="How your name should appear" />
          </label>
          <label className="block">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-gray-200">Bio</span><span className="text-xs text-gray-500">{bio.length}/500</span></div>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={5} className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-gray-600 focus:border-indigo-500" placeholder="Tell readers a little about yourself." />
          </label>
          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
            <button type="button" onClick={handleSave} disabled={saving} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400">{saving ? "Saving…" : "Save profile"}</button>
            <span className="text-xs text-gray-500">Signed in as {email || "your account"}</span>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
        <h2 className="text-sm font-semibold text-white">Account session</h2>
        <p className="mt-1 text-xs text-gray-500">Signing out ends your current Infinite Cultivation session.</p>
        <button type="button" onClick={handleSignOut} className="mt-4 rounded-md border border-white/10 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">Sign out</button>
      </section>
    </main>
  );
}
