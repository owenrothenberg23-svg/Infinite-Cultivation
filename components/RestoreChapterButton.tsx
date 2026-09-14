"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  storyId: string;
  chapterNumber: number;
};

export default function RestoreChapterButton({
  storyId,
  chapterNumber,
}: Props) {
  const router = useRouter();

  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    setRestoring(true);
    setError(null);

    try {
      const response = await fetch("/api/restore-chapter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          storyId,
          chapterNumber,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || `HTTP ${response.status}`
        );
      }

      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not restore chapter."
      );
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRestore}
        disabled={restoring}
        className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {restoring ? "Restoring..." : "Restore"}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}