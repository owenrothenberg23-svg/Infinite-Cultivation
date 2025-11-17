// app/titles/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type TitleRow = {
  id: string;
  slug: string | null;
  label: string | null;
  description: string | null;
  sort_order: number | null;
};

type UserTitleRow = {
  id: string;
  title_id: string;
  is_active: boolean | null;
};

export default function TitlesPage() {
  const router = useRouter();

  // IMPORTANT: make the client stable so useEffect doesn't loop
  const sb = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [activeTitleId, setActiveTitleId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErrorMsg(null);

      // 1) Check session
      const { data: sessionData, error: sessionError } = await sb.auth.getSession();
      if (sessionError) {
        console.error(sessionError);
        if (!cancelled) {
          setErrorMsg("Could not check session.");
          setLoading(false);
        }
        return;
      }

      const session = sessionData.session;
      if (!session) {
        // Not logged in – send them to login once, no flicker.
        if (!cancelled) router.replace("/login");
        return;
      }
      const userId = session.user.id;

      // 2) Load titles
      const {
        data: titlesData,
        error: titlesError,
      } = await sb
        .from("titles")
        .select("id, slug, label, description, sort_order")
        .order("sort_order", { ascending: true });

      if (titlesError) {
        console.error(titlesError);
        if (!cancelled) {
          setErrorMsg("Could not load titles.");
          setLoading(false);
        }
        return;
      }

      // 3) Load user’s titles to see which is active
      const {
        data: userTitles,
        error: userTitlesError,
      } = await sb
        .from("user_titles")
        .select("id, title_id, is_active")
        .eq("user_id", userId);

      if (userTitlesError) {
        console.error(userTitlesError);
        if (!cancelled) {
          setErrorMsg("Could not load your titles.");
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setTitles(titlesData ?? []);
        const active = (userTitles as UserTitleRow[] | null)?.find(
          (row) => row.is_active
        );
        setActiveTitleId(active?.title_id ?? null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, sb]);

  async function handleSelect(titleId: string) {
    try {
      setSavingId(titleId);
      setErrorMsg(null);

      const { data: sessionData } = await sb.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      const userId = session.user.id;

      // 1) Set all user's titles inactive
      const { error: clearErr } = await sb
        .from("user_titles")
        .update({ is_active: false })
        .eq("user_id", userId);

      if (clearErr) {
        console.error(clearErr);
        setErrorMsg("Could not update title.");
        return;
      }

      // 2) Upsert the chosen title as active
      const { data: existing, error: existingErr } = await sb
        .from("user_titles")
        .select("id")
        .eq("user_id", userId)
        .eq("title_id", titleId)
        .maybeSingle();

      if (existingErr && existingErr.code !== "PGRST116") {
        // PGRST116 = no rows found; ignore that.
        console.error(existingErr);
        setErrorMsg("Could not update title.");
        return;
      }

      if (existing) {
        const { error: updateErr } = await sb
          .from("user_titles")
          .update({ is_active: true })
          .eq("id", existing.id);

        if (updateErr) {
          console.error(updateErr);
          setErrorMsg("Could not update title.");
          return;
        }
      } else {
        const { error: insertErr } = await sb.from("user_titles").insert({
          user_id: userId,
          title_id: titleId,
          is_active: true,
        });

        if (insertErr) {
          console.error(insertErr);
          setErrorMsg("Could not update title.");
          return;
        }
      }

      setActiveTitleId(titleId);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-8 text-gray-200">
      <h1 className="text-2xl font-bold mb-2">Titles</h1>
      <p className="mb-4 text-sm text-gray-400">
        Select which title should appear next to your name across the site.
      </p>

      {errorMsg && (
        <div className="mb-4 rounded-md bg-red-900/60 border border-red-500 px-4 py-2 text-sm">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading titles…</p>
      ) : titles.length === 0 ? (
        <p className="text-sm text-gray-400">No titles available yet.</p>
      ) : (
        <ul className="space-y-3">
          {titles.map((t) => {
            const id = t.id;
            const isActive = id === activeTitleId;
            const isSaving = id === savingId;

            return (
              <li
                key={id}
                className={`flex items-start justify-between rounded-md border px-4 py-3 text-sm transition
                  ${
                    isActive
                      ? "border-indigo-400 bg-indigo-500/10"
                      : "border-gray-700 bg-gray-900/40 hover:border-indigo-400"
                  }`}
              >
                <div>
                  <div className="font-medium">
                    {t.label ?? "Untitled"}
                    {isActive && (
                      <span className="ml-2 rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
                        Active
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="mt-1 text-xs text-gray-400">
                      {t.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleSelect(id)}
                  disabled={isActive || isSaving}
                  className="ml-3 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-700"
                >
                  {isActive ? "Selected" : isSaving ? "Saving…" : "Use title"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
