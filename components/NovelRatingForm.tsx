"use client";

import Link from "next/link";
import { useState } from "react";

export default function NovelRatingForm({
  novelId,
  initialRating,
  isAuthed,
}: {
  novelId: string;
  initialRating: number | null;
  isAuthed: boolean;
}) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(nextRating: number) {
    if (busy) return;

    setRating(nextRating);
    setBusy(true);
    setStatus(null);
    setError(null);

    try {
      const res = await fetch("/api/rate-novel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId, rating: nextRating }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setStatus("Rating saved.");
    } catch (err: any) {
      setError(err?.message || "Could not save rating.");
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthed) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Rate this novel</p>
        <p className="mt-1 text-xs text-gray-400">
          Log in to rate and personalize rankings.
        </p>
        <Link
          href="/login"
          className="mt-3 inline-flex rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
        >
          Log in to rate
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">Your rating</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => submit(n)}
            disabled={busy}
            className={`rounded-md border px-3 py-2 text-sm font-semibold ${
              rating === n
                ? "border-yellow-400/60 bg-yellow-400/15 text-yellow-200"
                : "border-white/10 bg-black/30 text-gray-300 hover:border-indigo-500 hover:text-white"
            } disabled:opacity-60`}
          >
            ★ {n}
          </button>
        ))}
      </div>

      {busy && <p className="mt-2 text-xs text-gray-400">Saving rating…</p>}
      {status && <p className="mt-2 text-xs text-emerald-400">{status}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}