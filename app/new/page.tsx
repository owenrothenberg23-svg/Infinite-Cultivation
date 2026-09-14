"use client";

import { KeyboardEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export const dynamic = "force-dynamic";

const PRIMARY_GENRES = [
  { value: "", label: "Select a primary genre" },
  { value: "cultivation", label: "Cultivation" },
  { value: "xianxia", label: "Xianxia" },
  { value: "xuanhuan", label: "Xuanhuan" },
  { value: "wuxia", label: "Wuxia" },
  { value: "eastern_fantasy", label: "Eastern Fantasy" },
  { value: "progression_fantasy", label: "Progression Fantasy" },
  { value: "litrpg", label: "LitRPG" },
  { value: "fantasy", label: "Fantasy" },
  { value: "sci_fi_fantasy", label: "Sci-Fi / Fantasy" },
  { value: "urban_fantasy", label: "Urban Fantasy" },
  { value: "romance", label: "Romance" },
  { value: "mystery", label: "Mystery" },
  { value: "historical", label: "Historical" },
  { value: "horror", label: "Horror" },
  { value: "fan_fiction", label: "Fan Fiction" },
  { value: "action_adventure", label: "Action / Adventure" },
];

const SUGGESTED_TAGS = [
  "Reincarnation",
  "Transmigration",
  "System",
  "Sect",
  "Academy",
  "Revenge",
  "Alchemy",
  "Martial Arts",
  "Kingdom Building",
  "Weak to Strong",
  "Overpowered Protagonist",
  "Slow Burn",
];

export default function NewStoryPage() {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function addTags(values: string[]) {
    const cleaned = values.map((value) => value.trim()).filter(Boolean);

    if (!cleaned.length) return;

    setTags((previous) => {
      const existing = new Set(previous.map((tag) => tag.toLowerCase()));
      const next = [...previous];

      for (const tag of cleaned) {
        if (!existing.has(tag.toLowerCase())) {
          next.push(tag);
          existing.add(tag.toLowerCase());
        }
      }

      return next;
    });
  }

  function addTagFromInput() {
    const raw = tagInput.trim();
    if (!raw) return;

    addTags(raw.split(","));
    setTagInput("");
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTagFromInput();
    }
  }

  function removeTag(tag: string) {
    setTags((previous) => previous.filter((value) => value !== tag));
  }

  function toggleSuggestedTag(tag: string) {
    const exists = tags.some(
      (current) => current.toLowerCase() === tag.toLowerCase()
    );

    if (exists) {
      removeTag(
        tags.find((current) => current.toLowerCase() === tag.toLowerCase()) ||
          tag
      );
      return;
    }

    addTags([tag]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);

      formData.set("tags_json", JSON.stringify(tags));

      const sb = supabaseBrowser();
      const { data: sessionData, error: sessionError } =
        await sb.auth.getSession();

      if (sessionError) {
        throw new Error("Could not verify your login.");
      }

      const session = sessionData.session;

      if (!session) {
        router.replace("/login");
        throw new Error("You must be logged in to create a story.");
      }

      const response = await fetch("/api/create-story-manual", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const json = await response.json().catch(() => ({} as any));

      if (!response.ok) {
        throw new Error(json?.error || "Failed to create story.");
      }

      const storyId = json?.story?.id;

      if (!storyId) {
        throw new Error("Story created, but no story ID was returned.");
      }

      router.push(`/read/${storyId}`);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Unexpected error creating story."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <main className="mx-auto max-w-4xl px-4 py-8 text-gray-100 sm:px-6">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
              Author Studio
            </p>

            <h1 className="mt-1 text-3xl font-bold text-white">
              Create a New Story
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
              Start a private draft, add your first chapter if you’re ready, and
              publish to the Infinite Cultivation catalog when you choose.
            </p>
          </div>

          <Link
            href="/dashboard?tab=creator"
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Creator Dashboard
          </Link>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Step number="1" title="Create" text="Set up your story and metadata." />
          <Step number="2" title="Write" text="Add and manage your chapters." />
          <Step
            number="3"
            title="Publish"
            text="Join the public catalog when you’re ready."
          />
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
        >
          <section className="border-b border-white/10 p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">
              Story Details
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              The essentials
            </h2>

            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-gray-200">Title</span>
                <span className="ml-1 text-xs text-red-300">*</span>

                <input
                  name="title"
                  required
                  maxLength={200}
                  placeholder="Your story title"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-200">
                  Story pitch
                </span>

                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Your private creative north star. Use this to keep the premise,
                  protagonist, conflict, and direction clear while writing.
                </p>

                <textarea
                  name="story_pitch"
                  rows={5}
                  placeholder="A disgraced outer-sect disciple discovers..."
                  className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-sm leading-relaxed text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-200">
                  Primary genre
                </span>

                <p className="mt-1 text-xs text-gray-500">
                  Helps categorize the story when it is eventually published.
                </p>

                <select
                  name="primary_genre"
                  defaultValue=""
                  className="mt-2 w-full rounded-lg border border-white/10 bg-gray-950 px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-indigo-500"
                >
                  {PRIMARY_GENRES.map((genre) => (
                    <option key={genre.value || "none"} value={genre.value}>
                      {genre.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="border-b border-white/10 p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">
              Discovery Metadata
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Tags & themes
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Add useful themes, tropes, and story elements. These can help
              readers understand what your story offers after publication.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTED_TAGS.map((tag) => {
                const selected = tags.some(
                  (current) => current.toLowerCase() === tag.toLowerCase()
                );

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleSuggestedTag(tag)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      selected
                        ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-200"
                        : "border-white/10 bg-black/25 text-gray-400 hover:border-white/20 hover:text-gray-200"
                    }`}
                  >
                    {selected ? "✓ " : "+ "}
                    {tag}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-gray-200"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-gray-500 hover:text-red-300"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}

                <input
                  type="text"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={addTagFromInput}
                  placeholder={
                    tags.length === 0
                      ? "Add custom tags, separated by commas..."
                      : "Add another tag..."
                  }
                  className="min-w-[190px] flex-1 bg-transparent px-1 py-1 text-sm text-gray-100 outline-none placeholder:text-gray-600"
                />
              </div>
            </div>
          </section>

          <section className="p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">
              Start Writing
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Chapter 1
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Optional. You can create the story first and write the opening
              chapter later.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-200">
                  Chapter title
                </span>

                <input
                  name="initial_chapter_title"
                  placeholder="Chapter 1 title"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-200">
                  Chapter draft
                </span>

                <textarea
                  name="initial_chapter_content"
                  rows={12}
                  placeholder="Begin your story..."
                  className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-sm leading-relaxed text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500"
                />
              </label>
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">
                This creates a private draft.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                Nothing is added to the public Library yet. From Story
                Management, you can continue writing, import chapters, add your
                public summary and cover, and publish when the story is ready.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Creating Story..." : "Create Private Draft"}
              </button>

              <Link
                href="/dashboard?tab=creator"
                className="rounded-md border border-white/10 bg-black/30 px-5 py-2.5 text-sm font-medium text-gray-300 hover:border-white/20 hover:text-white"
              >
                Cancel
              </Link>
            </div>
          </section>
        </form>

        <section className="mt-6 rounded-xl border border-indigo-500/15 bg-indigo-500/[0.06] p-4">
          <p className="text-sm font-semibold text-indigo-100">
            Optional writing tools come later.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            Infinite Cultivation can offer optional assistance inside the
            writing workflow without requiring it during story creation. Your
            story begins as your draft, not as an AI-generated product.
          </p>
        </section>
      </main>

      {isSubmitting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-indigo-500/40 bg-slate-950/95 px-6 py-6 text-center shadow-2xl">
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
              Creating Draft
            </p>

            <h2 className="mt-2 text-xl font-bold text-white">
              Setting up your story...
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              Preparing your private writing workspace.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function Step({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-300">
          {number}
        </span>
        <p className="text-sm font-semibold text-white">{title}</p>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-gray-500">{text}</p>
    </div>
  );
}