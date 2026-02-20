"use client";

import Link from "next/link";
import { useState } from "react";

export default function StoryBookmarkButton({
  storyId,
  initialSaved,
  isAuthed,
}: {
  storyId: string;
  initialSaved: boolean;
  isAuthed: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    // ✅ prevent clicking the card link
    e.preventDefault();
    e.stopPropagation();

    if (busy) return;

    // If not logged in, don’t call API — send to login
    if (!isAuthed) return;

    setBusy(true);
    try {
      const endpoint = saved ? "/api/unbookmark" : "/api/bookmark";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setSaved(!saved);
    } catch (err) {
      console.error("bookmark toggle error", err);
      // fail silently for now (or add toast later)
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthed) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
        title="Log in to save stories"
        onClick={(e) => {
          // don’t navigate to story when clicking this inside the card
          e.stopPropagation();
        }}
      >
        Save
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border ${
        saved
          ? "bg-emerald-600/20 text-emerald-200 border-emerald-500/40 hover:bg-emerald-600/25"
          : "bg-black/40 text-gray-200 border-white/10 hover:border-indigo-500 hover:text-white"
      } disabled:opacity-60`}
      title={saved ? "Saved" : "Save story"}
    >
      {saved ? "Saved ✓" : "Save"}
    </button>
  );
}