"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Props = {
  storyId: string;
  initialSummary: string | null;
  initialCoverUrl?: string | null;
  isAlreadyPublic: boolean;
};

type PublishResponse = {
  error?: string;
  novel?: {
    id?: string;
    slug?: string;
  };
  novelId?: string;
  novelSlug?: string;
};

function isHttpUrl(value: string) {
  if (!value.trim()) return true;

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function PublishStoryPanel({
  storyId,
  initialSummary,
  initialCoverUrl,
  isAlreadyPublic,
}: Props) {
  const router = useRouter();

  const [summary, setSummary] = useState(initialSummary ?? "");
  const [coverUrl, setCoverUrl] = useState((initialCoverUrl ?? "").trim());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);

  const trimmedSummary = summary.trim();
  const trimmedCoverUrl = coverUrl.trim();

  const summaryCount = trimmedSummary.length;
  const coverIsValid = useMemo(() => isHttpUrl(trimmedCoverUrl), [trimmedCoverUrl]);

  const hasSummary = summaryCount > 0;
  const canSubmit = !loading && hasSummary && coverIsValid;

  const onPublish = async () => {
    if (!hasSummary) {
      setError("Add a public summary before publishing.");
      return;
    }

    if (!coverIsValid) {
      setError("Cover image must use a valid http:// or https:// URL.");
      return;
    }

    setError(null);
    setMessage(null);
    setPublishedSlug(null);
    setLoading(true);

    try {
      const sb = supabaseBrowser();
      const { data: sessionData, error: sessionError } =
        await sb.auth.getSession();

      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please log in to continue.");
      }

      const response = await fetch("/api/publish-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          storyId,
          summary: trimmedSummary,
          coverImageUrl: trimmedCoverUrl || null,
        }),
      });

      let json: PublishResponse = {};

      try {
        json = (await response.json()) as PublishResponse;
      } catch {
        // Keep the fallback error below if the API did not return JSON.
      }

      if (!response.ok) {
        throw new Error(json?.error || "Failed to publish story.");
      }

      const slug = json?.novel?.slug || json?.novelSlug || null;

      setPublishedSlug(slug);
      setMessage(
        isAlreadyPublic
          ? "Public listing updated successfully."
          : "Story published and synced to the Library."
      );

      router.refresh();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to publish story."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">
            Publication
          </p>

          <h2 className="mt-1 text-xl font-semibold text-white">
            {isAlreadyPublic ? "Manage Public Listing" : "Publish Story"}
          </h2>

          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">
            {isAlreadyPublic
              ? "Update the information readers see on this story’s Infinite Cultivation catalog page."
              : "Publish this story to Infinite Cultivation and create its reader-facing catalog listing."}
          </p>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-[11px] ${
            isAlreadyPublic
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-white/10 text-gray-400"
          }`}
        >
          {isAlreadyPublic ? "Published" : "Draft"}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_180px]">
        <div>
          <label
            htmlFor={`summary-${storyId}`}
            className="block text-sm font-medium text-gray-200"
          >
            Public summary
          </label>

          <p className="mt-1 text-xs text-gray-500">
            Give readers a clear hook and premise. This appears on the public
            novel listing.
          </p>

          <textarea
            id={`summary-${storyId}`}
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              if (error) setError(null);
            }}
            rows={6}
            className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-sm leading-relaxed text-gray-100 outline-none transition placeholder:text-gray-600 focus:border-indigo-500"
            placeholder="Introduce the protagonist, central conflict, and what makes this story worth following..."
          />

          <div className="mt-1 flex items-center justify-between gap-3 text-xs">
            <span className={hasSummary ? "text-gray-500" : "text-amber-300"}>
              {hasSummary
                ? "Used as the public synopsis."
                : "A summary is required to publish."}
            </span>

            <span className="text-gray-600">
              {summaryCount.toLocaleString("en-US")} characters
            </span>
          </div>

          <label
            htmlFor={`cover-${storyId}`}
            className="mt-5 block text-sm font-medium text-gray-200"
          >
            Cover image URL
          </label>

          <p className="mt-1 text-xs text-gray-500">
            Optional. Use an image you own or have permission to use.
          </p>

          <input
            id={`cover-${storyId}`}
            value={coverUrl}
            onChange={(e) => {
              setCoverUrl(e.target.value);
              if (error) setError(null);
            }}
            inputMode="url"
            className={`mt-2 w-full rounded-lg border bg-black/40 px-3 py-2.5 text-sm text-gray-100 outline-none transition placeholder:text-gray-600 ${
              coverIsValid
                ? "border-white/10 focus:border-indigo-500"
                : "border-red-500/50 focus:border-red-400"
            }`}
            placeholder="https://example.com/cover.jpg"
          />

          {!coverIsValid && (
            <p className="mt-1 text-xs text-red-400">
              Enter a valid http:// or https:// image URL.
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.16em] text-gray-500">
            Cover Preview
          </p>

          <div className="aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-black/30">
            {trimmedCoverUrl && coverIsValid ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trimmedCoverUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-500/20 via-sky-500/10 to-emerald-500/10 px-5 text-center text-xs leading-relaxed text-gray-500">
                {trimmedCoverUrl
                  ? "Enter a valid cover URL to preview it."
                  : "No cover selected."}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
        <h3 className="text-sm font-semibold text-white">
          {isAlreadyPublic ? "Updating this listing" : "What happens when you publish"}
        </h3>

        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          {isAlreadyPublic
            ? "Your public story information and its linked catalog entry will be synced with these changes."
            : "Your story becomes public and a canonical Infinite Cultivation novel entry is created for Library, Search, Rankings, ratings, reviews, bookmarks, lists, and reader discovery."}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onPublish}
          disabled={!canSubmit}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? isAlreadyPublic
              ? "Updating..."
              : "Publishing..."
            : isAlreadyPublic
              ? "Update Public Listing"
              : "Publish to Infinite Cultivation"}
        </button>

        {publishedSlug && (
          <button
            type="button"
            onClick={() => router.push(`/novel/${publishedSlug}`)}
            className="rounded-md border border-white/10 bg-black/30 px-4 py-2 text-sm font-medium text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            View Public Novel Page
          </button>
        )}
      </div>

      {message && (
        <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </section>
  );
}