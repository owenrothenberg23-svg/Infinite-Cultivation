// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    let cancelled = false;

    (async () => {
      const { data, error } = await sb.auth.getSession();

      if (cancelled) return;

      if (error) {
        console.error("getSession error:", error);
        setLoading(false);
        return;
      }

      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      setEmail(session.user.email ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function signOut() {
    const sb = supabaseBrowser();
    await sb.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto p-8 text-gray-200">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-400">Loading your account…</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-8 text-gray-200">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="mb-6">Signed in as {email ?? "Unknown user"}</p>

      <div className="flex flex-wrap gap-3">
        <a
          href="/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Create new story
        </a>
        <a
          href="/account"
          className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
        >
          Account info
        </a>
        <a
          href="/titles"
          className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
        >
          Titles
        </a>
        <button
          onClick={signOut}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 ml-auto"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
