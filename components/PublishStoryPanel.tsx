// components/PublishStoryPanel.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Props = {
  storyId: string;
  initialSummary: string | null;
  initialCoverUrl?: string | null; // ✅ NEW (optional, won't break callers)
  isAlreadyPublic: boolean;
};

export default function PublishStoryPanel({
  storyId,
  initialSummary,
  initialCoverUrl,
  isAlreadyPublic,
}: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [coverUrl, setCoverUrl] = useState((initialCoverUrl ?? "").trim()); // ✅ NEW
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPublish = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      // ✅ Get access token (required by your publish-story API)
      const sb = supabaseBrowser();
      const { data: sess, error: sessErr } = await sb.auth.getSession();
      if (sessErr) throw sessErr;

      const accessToken = sess.session?.access_token;
      if (!accessToken) {
        throw new Error("Please log in to continue");
      }

      const res = await fetch("/api/publish-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          storyId,
          summary: summary || null, // ✅ matches your API route
          coverImageUrl: coverUrl || null, // ✅ NEW
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to publish");
      }

      setMessage("Story published to the Library.");
      router.refresh(); // refresh server components so Library/Story page update
    } catch (e: any) {
      setError(e?.message || "Failed to publish");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-10 rounded-lg border border-white/10 bg-white/5 p-4">
      <h2 className="text-lg font-semibold">Publish to Library</h2>
      <p className="mt-1 text-sm text-gray-400">
        Add a short hook and publish this saga to the public Library so other
        cultivators can read it.
      </p>

      <label className="mt-3 block text-sm font-medium text-gray-200">
        Public summary
      </label>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-500"
        placeholder="A betrayed disciple falls into another realm and inherits a forbidden artifact..."
      />

      {/* ✅ NEW: cover URL */}
      <label className="mt-4 block text-sm font-medium text-gray-200">
        Cover image URL (optional)
      </label>
      <input
        value={coverUrl}
        onChange={(e) => setCoverUrl(e.target.value)}
        className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-500"
        placeholder="https://…"
      />
      {coverUrl.trim() ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl.trim()}
            alt=""
            className="h-40 w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onPublish}
          disabled={loading}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading
            ? "Publishing..."
            : isAlreadyPublic
            ? "Update public summary"
            : "Publish story"}
        </button>

        {isAlreadyPublic && (
          <span className="text-xs text-emerald-400">
            Already visible in the Library.
          </span>
        )}
      </div>

      {message && <p className="mt-2 text-xs text-emerald-400">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
