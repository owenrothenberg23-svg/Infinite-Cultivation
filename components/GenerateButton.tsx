"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateButton({
  storyId,
  nextNumber,
}: {
  storyId: string;
  nextNumber: number;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (!storyId) {
      console.error("❌ GenerateButton missing storyId");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/next-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const chapterNum =
        data?.chapter?.chapter_number ??
        data?.chapter_number ??
        nextNumber;

      router.push(`/read/${storyId}/chapter/${chapterNum}`);
    } catch (err: any) {
      console.error("Generate failed:", err);
      alert(`Couldn't generate: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
                 transition"
    >
      {loading ? "Generating…" : "Generate Next Chapter"}
    </button>
  );
}
