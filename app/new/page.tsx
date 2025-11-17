// app/new/page.tsx
import Link from "next/link";

export const dynamic = "force-static";

export default function NewStoryPage() {
  return (
    <main className="max-w-2xl mx-auto p-8 text-gray-200">
      <h1 className="text-3xl font-bold mb-6">Create a New Story</h1>

      <form
        action="/api/create-story"
        method="post"
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

        {/* Story pitch (NEW) */}
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
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Create Story
        </button>
      </form>

      <div className="mt-6">
        <Link href="/" className="text-gray-400 hover:text-white">
          ← Back
        </Link>
      </div>
    </main>
  );
}
