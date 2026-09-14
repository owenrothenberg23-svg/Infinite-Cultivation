"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  storyId: string;
  chapterNumber: number;
};

export default function DeleteChapterButton({
  storyId,
  chapterNumber,
}: Props) {
  const router = useRouter();

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete Chapter ${chapterNumber}?\n\nThis will remove it from readers, but the chapter can be restored later.`
    );

    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/delete-chapter", {
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

      router.push(`/read/${storyId}`);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete chapter."
      );

      setDeleting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Delete Chapter"}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}