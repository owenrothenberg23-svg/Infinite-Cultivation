// components/GenerateButton.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Props = {
  storyId: string;
  nextNumber: number;
};

type ProfileRow = {
  id: string;
  spirit_stones: number | null;
};

export default function GenerateButton({ storyId, nextNumber }: Props) {
  const router = useRouter();
  const sb = useMemo(() => supabaseBrowser(), []);

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- NEW: loader UX state ---
  const [progress, setProgress] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [showLongWaitHint, setShowLongWaitHint] = useState(false);

  const loadingMessages = useMemo(
    () => [
      "Gathering qi…",
      "Aligning meridians…",
      "Consulting the Heavenly Dao…",
      "Condensing a new chapter…",
      "Tempering the draft…",
      "Carving the final hook…",
    ],
    []
  );

  // Drive progress + message rotation while loading
  useEffect(() => {
    if (!loading) {
      setProgress(0);
      setMsgIndex(0);
      setShowLongWaitHint(false);
      return;
    }

    const start = Date.now();

    const progressTimer = window.setInterval(() => {
      setProgress((curr) => {
        let next = curr;

        // fast early, slow later, never hits 100% until request finishes
        if (curr < 60) next = curr + 2.2;
        else if (curr < 90) next = curr + 0.6;
        else next = curr + 0.12;

        return Math.min(96, next);
      });

      if (Date.now() - start > 20000) setShowLongWaitHint(true);
    }, 180);

    const msgTimer = window.setInterval(() => {
      setMsgIndex((i) => (i + 1) % loadingMessages.length);
    }, 2800);

    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(msgTimer);
    };
  }, [loading, loadingMessages.length]);

  // Load session + profile (for spirit_stones)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setChecking(true);
      setErrorMsg(null);

      try {
        const { data: sessionData, error: sessionErr } =
          await sb.auth.getSession();

        if (sessionErr) {
          console.error("GenerateButton session error:", sessionErr);
          if (!cancelled) setErrorMsg("Could not check login.");
          return;
        }

        const user = sessionData.session?.user;
        if (!user) {
          if (!cancelled) setProfile(null);
          return;
        }

        const { data: prof, error: profErr } = await sb
          .from("profiles")
          .select("id, spirit_stones")
          .eq("id", user.id)
          .maybeSingle();

        if (profErr) {
          console.error("GenerateButton profile load error:", profErr);
          if (!cancelled) setErrorMsg("Could not load your Spirit Stones.");
          return;
        }

        if (!cancelled) {
          setProfile({
            id: prof?.id ?? user.id,
            spirit_stones: prof?.spirit_stones ?? 0,
          });
        }
      } catch (e) {
        console.error("GenerateButton fatal load error:", e);
        if (!cancelled) setErrorMsg("Something went wrong checking your balance.");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sb]);

  const balance = profile?.spirit_stones ?? 0;
  const isLoggedIn = !!profile;
  const hasEnoughStones = balance >= 1;

  async function handleClick() {
    if (!storyId) {
      console.error("❌ GenerateButton missing storyId");
      return;
    }

    setErrorMsg(null);

    // Always re-check session right before calling the API
    const { data: sessionData, error: sessionErr } = await sb.auth.getSession();

    if (sessionErr) {
      console.error("GenerateButton session error (click):", sessionErr);
      setErrorMsg("Could not verify login.");
      return;
    }

    const session = sessionData.session;
    if (!session?.user) {
      setErrorMsg("Please log in to generate chapters.");
      return;
    }

    if (!hasEnoughStones) {
      setErrorMsg("Not enough Spirit Stones.");
      return;
    }

    const accessToken = session.access_token;

    setLoading(true);
    try {
      // 1) Call the chapter-generation API (include bearer so server can auth reliably)
      const res = await fetch("/api/next-chapter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ storyId }),
      });

      // NEW: safer parsing (handles non-JSON errors)
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const chapterNum =
        data?.chapter?.chapter_number ?? data?.chapter_number ?? nextNumber;

      // Finish the progress bar nicely right before navigation
      setProgress(100);

      // 2) Update local balance optimistically (DO NOT update Supabase here)
      setProfile((prev) =>
        prev
          ? { ...prev, spirit_stones: Math.max((prev.spirit_stones ?? 0) - 1, 0) }
          : prev
      );

      // 3) Navigate to the new chapter
      router.push(`/read/${storyId}/chapter/${chapterNum}`);
    } catch (err: any) {
      console.error("Generate failed:", err);
      setErrorMsg(err?.message || "Couldn't generate chapter.");
    } finally {
      setLoading(false);
    }
  }

  const disabled = checking || loading || !isLoggedIn || !hasEnoughStones;

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={disabled}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                   hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
                   transition"
      >
        {loading ? "Channeling next chapter…" : "Generate Next Chapter"}
      </button>

      <p className="text-xs text-gray-400">Cost: 1 Spirit Stone</p>

      {checking && (
        <p className="text-xs text-gray-500">Checking your balance…</p>
      )}

      {!checking && !isLoggedIn && (
        <p className="text-xs text-red-400">Please log in to generate chapters.</p>
      )}

      {!checking && isLoggedIn && !hasEnoughStones && (
        <p className="text-xs text-red-400">
          Not enough Spirit Stones. Visit the Store to top up.
        </p>
      )}

      {!checking && isLoggedIn && hasEnoughStones && (
        <p className="text-xs text-emerald-400">
          You have {balance.toLocaleString()} Spirit Stones.
        </p>
      )}

      {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}

      {/* --- NEW: Swirling Qi loader + progress bar --- */}
      {loading && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-4">
            {/* swirl */}
            <div className="relative h-14 w-14 shrink-0">
              <div className="absolute inset-0 rounded-full border border-white/15" />
              <div className="absolute inset-0 rounded-full border-t border-white/60 animate-spin" />
              <div className="absolute inset-2 rounded-full border border-white/10" />
              <div className="absolute inset-2 rounded-full border-r border-white/50 animate-[spin_1.6s_linear_infinite]" />
              <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-md" />
            </div>

            <div className="w-full">
              <p className="text-sm text-gray-200" aria-live="polite">
                {loadingMessages[msgIndex]}
              </p>

              <div className="mt-2 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500/80 transition-[width] duration-200"
                  style={{ width: `${Math.floor(progress)}%` }}
                />
              </div>

              <div className="mt-1 flex items-center justify-between">
                <p className="text-[11px] text-gray-400">
                  {Math.floor(progress)}%
                </p>
                {showLongWaitHint && (
                  <p className="text-[11px] text-gray-400">
                    Still working — this can take ~30 seconds.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
