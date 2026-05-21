// app/add-novel/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AddNovelPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-gray-100">
      <div className="mb-6">
        <Link href="/library" className="text-sm text-indigo-300 hover:underline">
          ← Back to database
        </Link>
      </div>

      <h1 className="text-3xl font-bold">Add Novel</h1>
      <p className="mt-2 text-sm text-gray-400">
        Add an external cultivation/webnovel entry to the database.
      </p>

      <form
        action="/api/add-novel"
        method="post"
        className="mt-6 space-y-5 rounded-xl border border-white/10 bg-white/5 p-5"
      >
        <Field name="title" label="Title" required />
        <Field name="author_name" label="Author" />
        <Field name="source_site" label="Source Site" placeholder="Webnovel, Wuxiaworld, NovelUpdates, etc." />
        <Field name="source_url" label="Source URL" />
        <Field name="cover_image_url" label="Cover Image URL" />

        <label className="block text-sm">
          <span className="block mb-1 text-gray-300">Synopsis</span>
          <textarea
            name="synopsis"
            rows={5}
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
          />
        </label>

        <Field name="primary_genre" label="Primary Genre" placeholder="xianxia" />
        <Field name="tags" label="Tags" placeholder="ruthless_mc, dark, system" />
        <Field name="status" label="Status" placeholder="completed, ongoing, discontinued" />
        <Field name="translation_status" label="Translation Status" placeholder="translated, ongoing, unknown" />
        <Field name="chapters_total" label="Total Chapters" type="number" />
        <Field name="country" label="Country" placeholder="China" />
        <Field name="year_started" label="Year Started" type="number" />
        <Field name="year_completed" label="Year Completed" type="number" />

        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Add Novel
        </button>
      </form>
    </main>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 text-gray-300">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
      />
    </label>
  );
}