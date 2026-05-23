"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NovelCommentForm({
  novelId,
  isAuthed,
}: {
  novelId: string;
  isAuthed: boolean;
}) {
  const router = useRouter();

  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (busy) return;

    const trimmed = content.trim();
    if (!trimmed) {
      setError("Comment cannot be empty.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/comment-novel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId, content: trimmed }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setContent("");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Could not post comment.");
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthed) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Join the discussion</p>
        <p className="mt-1 text-xs text-gray-400">
          Log in to comment on this novel.
        </p>
        <Link
          href="/login"
          className="mt-3 inline-flex rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
        >
          Log in to comment
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-white/10 bg-white/5 p-4"
    >
      <label className="block text-sm font-semibold text-white">
        Add a comment
      </label>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        maxLength={4000}
        placeholder="What did you think of this novel?"
        className="mt-2 w-full rounded-md border border-gray-700 bg-slate-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-500">{content.length}/4000</p>

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-400"
        >
          {busy ? "Posting…" : "Post comment"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </form>
  );
}