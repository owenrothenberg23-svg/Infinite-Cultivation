"use client";

import Link from "next/link";
import { useState } from "react";

export default function NovelBookmarkButton({
  novelId,
  initialSaved,
  isAuthed,
}: {
  novelId: string;
  initialSaved: boolean;
  isAuthed: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (busy) return;

    if (!isAuthed) return;

    setBusy(true);
    setError(null);

    try {
      const endpoint = saved ? "/api/novel-unbookmark" : "/api/novel-bookmark";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setSaved((v) => !v);
    } catch (err: any) {
      setError(err?.message || "Could not update save.");
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthed) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
      >
        Save
      </Link>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`inline-flex items-center rounded-md px-3 py-2 text-xs font-medium border ${
          saved
            ? "bg-emerald-600/20 text-emerald-200 border-emerald-500/40 hover:bg-emerald-600/25"
            : "bg-black/40 text-gray-200 border-white/10 hover:border-indigo-500 hover:text-white"
        } disabled:opacity-60`}
      >
        {busy ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>

      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}