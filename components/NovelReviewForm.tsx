"use client";

import { useState } from "react";

export default function NovelReviewForm({
  novelId,
  isAuthed,
}: {
  novelId: string;
  isAuthed: boolean;
}) {
  const [title, setTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [containsSpoilers, setContainsSpoilers] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submitReview() {
    if (!isAuthed) {
      setMessage("Please sign in first.");
      return;
    }

    if (!reviewText.trim()) {
      setMessage("Review cannot be empty.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/review-novel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          novelId,
          title,
          reviewText,
          containsSpoilers,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed");
      }

      setMessage("Review submitted.");
      setTitle("");
      setReviewText("");
      setContainsSpoilers(false);

      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      setMessage(err.message || "Failed to submit review.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-lg font-semibold text-white">
        Write a Review
      </h3>

      <div className="mt-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Review title (optional)"
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
        />

        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="What did you think about this novel?"
          rows={6}
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
        />

        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={containsSpoilers}
            onChange={(e) => setContainsSpoilers(e.target.checked)}
          />
          Contains spoilers
        </label>

        <button
          onClick={submitReview}
          disabled={loading}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          {loading ? "Submitting..." : "Submit Review"}
        </button>

        {message && (
          <p className="text-sm text-gray-400">{message}</p>
        )}
      </div>
    </div>
  );
}