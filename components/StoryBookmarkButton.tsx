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
    e.preventDefault();
    e.stopPropagation();

    if (busy) return;
    if (!isAuthed) return;

    const nextSaved = !saved;

    // 🔥 Optimistic UI update
    setSaved(nextSaved);
    setBusy(true);

    try {
      const endpoint = nextSaved ? "/api/bookmark" : "/api/unbookmark";

      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include", // ✅ IMPORTANT
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("Bookmark toggle error:", err);

      // ❌ Rollback if API failed
      setSaved(!nextSaved);
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthed) {
    return (
      <Link
        href="/login"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
        title="Log in to save stories"
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
      className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border transition ${
        saved
          ? "bg-emerald-600/20 text-emerald-200 border-emerald-500/40 hover:bg-emerald-600/30"
          : "bg-black/40 text-gray-200 border-white/10 hover:border-indigo-500 hover:text-white"
      } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
      title={saved ? "Saved" : "Save story"}
    >
      {saved ? "Saved ✓" : "Save"}
    </button>
  );
}