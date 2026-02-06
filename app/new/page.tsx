// app/new/page.tsx
"use client";

import { useState, KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic"; // ✅ don’t force-static on an auth/cookie flow

// Keep this in sync with app/library/page.tsx
const GENRES_FOR_LIBRARY = [
  { value: "", label: "Select a primary genre" },
  { value: "xianxia", label: "Xianxia" },
  { value: "wuxia", label: "Wuxia" },
  { value: "xuanhuan", label: "Xuanhuan" },
  { value: "urban", label: "Urban Cultivation" },
  { value: "sci_fantasy", label: "Sci-Fantasy" },
];

export default function NewStoryPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tag UI state
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const form = e.currentTarget;
      const fd = new FormData(form);

      // make sure tags_json is present and current
      fd.set("tags_json", JSON.stringify(tags));

      const res = await fetch("/api/create-story", {
        method: "POST",
        body: fd,
        credentials: "include", // ✅ ensures cookies go with the request
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        alert(json?.error || "Failed to create story");
        setIsSubmitting(false);
        return;
      }

      const storyId = json?.story?.id;
      if (!storyId) {
        alert("Story created but no id returned");
        setIsSubmitting(false);
        return;
      }

      // ✅ this is what your app is already trying to do (and was 404’ing)
      router.push(`/story/${storyId}`);
    } catch (err: any) {
      alert(err?.message || "Unexpected error");
      setIsSubmitting(false);
    }
  }

  function addTagFromInput() {
    const raw = tagInput.trim();
    if (!raw) return;

    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (!parts.length) return;

    setTags((prev) => {
      const existing = new Set(prev.map((t) => t.toLowerCase()));
      const next = [...prev];
      for (const p of parts) {
        if (!existing.has(p.toLowerCase())) {
          next.push(p);
          existing.add(p.toLowerCase());
        }
      }
      return next;
    });

    setTagInput("");
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTagFromInput();
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  return (
    <>
      <main className="max-w-2xl mx-auto p-8 text-gray-200">
        <h1 className="text-3xl font-bold mb-6">Create a New Story</h1>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-white/5 p-6 rounded-lg border border-white/10"
        >
          {/* Title */}
          <label className="block text-sm">
            <span className="block mb-1 text-gray-300">Title</span>
            <input
              name="title"
              required
              placeholder="Heaven-Splitting Demon Emperor"
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100"
            />
          </label>

          {/* Story pitch */}
          <label className="block text-sm">
            <span className="block mb-1 text-gray-300">
              Story Pitch (what you want this book to be)
            </span>
            <textarea
              name="story_pitch"
              rows={6}
              placeholder="Example: A cunning outer-sect disciple with a hidden body-tempering art seeks revenge via politics, not brute force. Minimal romance, heavy sect intrigue, a living System that sometimes lies."
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100"
            />
            <span className="block mt-1 text-xs text-gray-400">
              Tip: 2–8 sentences. This becomes a permanent north star for the plot.
            </span>
          </label>

          {/* Tone */}
          <label className="block text-sm">
            <span className="block mb-1 text-gray-300">Tone</span>
            <select
              name="tone"
              defaultValue="epic"
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100"
            >
              <option value="epic">Epic / Grand</option>
              <option value="ruthless">Ruthless / Grim</option>
              <option value="arrogant">Arrogant / Comedic</option>
              <option value="enlightened">Calm / Dao-Comprehension</option>
              <option value="schemer">Schemer / Strategist</option>
            </select>
          </label>

          {/* World type */}
          <label className="block text-sm">
            <span className="block mb-1 text-gray-300">World Type</span>
            <select
              name="world_type"
              defaultValue="xianxia_high"
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100"
            >
              <option value="wuxia_low">Wuxia (Low Fantasy)</option>
              <option value="xianxia_high">Xianxia (High Cultivation)</option>
              <option value="xuanhuan">Xuanhuan (Eastern-Western Blend)</option>
              <option value="modern_urban">Modern / Urban Cultivation</option>
              <option value="sci_fantasy">Sci-Fantasy Cultivation</option>
            </select>
          </label>

          {/* MC personality */}
          <label className="block text-sm">
            <span className="block mb-1 text-gray-300">MC Personality</span>
            <select
              name="mc_personality"
              defaultValue="steadfast"
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100"
            >
              <option value="ruthless">Ruthless</option>
              <option value="steadfast">Steadfast / Noble</option>
              <option value="playful">Playful / Troll</option>
              <option value="cunning">Cunning / Planner</option>
              <option value="compassionate">Compassionate</option>
            </select>
          </label>

          {/* OP level */}
          <label className="block text-sm">
            <span className="block mb-1 text-gray-300">OP Level</span>
            <select
              name="op_level"
              defaultValue="balanced"
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100"
            >
              <option value="struggle">Struggle (Underpowered)</option>
              <option value="balanced">Balanced Growth</option>
              <option value="overpowered">Overpowered (OP)</option>
            </select>
          </label>

          {/* Romance level */}
          <label className="block text-sm">
            <span className="block mb-1 text-gray-300">Romance Level</span>
            <select
              name="romance_level"
              defaultValue="subplot"
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100"
            >
              <option value="none">None</option>
              <option value="slow_burn">Slow Burn</option>
              <option value="subplot">Subplot</option>
              <option value="harem_light">Harem-Light</option>
            </select>
          </label>

          {/* Violence level */}
          <label className="block text-sm">
            <span className="block mb-1 text-gray-300">Violence Level</span>
            <select
              name="violence_level"
              defaultValue="balanced"
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100"
            >
              <option value="low">Low</option>
              <option value="balanced">Balanced</option>
              <option value="savage">Savage</option>
            </select>
          </label>

          {/* Power progression */}
          <label className="block text-sm">
            <span className="block mb-1 text-gray-300">Power Progression</span>
            <select
              name="power_progression"
              defaultValue="steady"
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100"
            >
              <option value="slow">Slow</option>
              <option value="steady">Steady</option>
              <option value="fast">Fast</option>
            </select>
          </label>

          {/* Primary Library Genre */}
          <label className="block text-sm">
            <span className="block mb-1 text-gray-300">Primary Library Genre</span>
            <span className="block mb-1 text-xs text-gray-400">
              Used for Library filters so readers can find this saga.
            </span>
            <select
              name="primary_genre"
              defaultValue=""
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100"
            >
              {GENRES_FOR_LIBRARY.map((g) => (
                <option key={g.value || "none"} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>

          {/* Genres / Themes */}
          <fieldset className="border border-gray-700 rounded p-3">
            <legend className="text-sm text-gray-300 px-1">
              Genres / Themes (choose a few)
            </legend>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="genres" value="revenge" />
                <span>Revenge</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="genres" value="sect_politics" />
                <span>Sect politics</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="genres" value="system" />
                <span>System / Status Screen</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="genres" value="face_slapping" />
                <span>Face-slapping</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="genres" value="slow_cultivation" />
                <span>Slow cultivation</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="genres" value="comedy" />
                <span>Comedy</span>
              </label>
            </div>
          </fieldset>

          {/* Tags */}
          <fieldset className="border border-gray-700 rounded p-3">
            <legend className="text-sm text-gray-300 px-1">Tags</legend>

            <div className="flex flex-wrap gap-2 rounded-md bg-gray-900 border border-gray-700 px-2 py-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-gray-100"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-gray-400 hover:text-red-300"
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length === 0 ? "Add a tag…" : ""}
                className="flex-1 min-w-[120px] bg-transparent border-none px-1 py-0.5 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none"
              />
            </div>
          </fieldset>

          {/* Optional flags */}
          <fieldset className="border border-gray-700 rounded p-3">
            <legend className="text-sm text-gray-300 px-1">Optional Tropes</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="flag_system_cheats" value="1" />
              <span>System / Cheats</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="flag_transmigration" value="1" />
              <span>Transmigration / Reincarnation</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="flag_comedy" value="1" />
              <span>Comedy Emphasis</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="flag_grimdark" value="1" />
              <span>Grimdark Undertones</span>
            </label>
          </fieldset>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-gray-400"
          >
            {isSubmitting ? "Channeling Qi…" : "Create Story"}
          </button>
        </form>

        <div className="mt-6">
          <Link href="/" className="text-gray-400 hover:text-white">
            ← Back
          </Link>
        </div>
      </main>

      {isSubmitting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative max-w-sm rounded-2xl border border-indigo-500/70 bg-slate-950/95 px-6 py-5 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
              Channeling Qi
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">
              Weaving your destiny…
            </h2>
            <p className="mt-1 text-sm text-gray-300">
              Summoning the heavens to forge your new cultivation saga.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
