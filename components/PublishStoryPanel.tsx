// components/PublishStoryPanel.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  storyId: string;
  initialSummary: string | null;
  isAlreadyPublic: boolean;
};

export default function PublishStoryPanel({
  storyId,
  initialSummary,
  isAlreadyPublic,
}: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPublish = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/publish-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          publicSummary: summary || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to publish");
      }

      setMessage("Story published to the Library.");
      router.refresh(); // refresh server components so Library/Story page update
    } catch (e: any) {
      setError(e.message || "Failed to publish");
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

      <div className="mt-3 flex items-center gap-3">
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

      {message && (
        <p className="mt-2 text-xs text-emerald-400">{message}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
