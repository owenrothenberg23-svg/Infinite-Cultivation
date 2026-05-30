// app/admin/imports/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const dynamic = "force-dynamic";

type ImportRow = {
  id: number;
  source_url: string | null;
  raw_title: string | null;
  raw_payload: string | null;
  suggested_title: string | null;
  suggested_author: string | null;
  suggested_synopsis: string | null;
  suggested_cover_url: string | null;
  suggested_source_site: string | null;
  suggested_primary_genre: string | null;
  suggested_tags: string[] | null;
  status: string;
  created_by: string | null;
  created_at: string;
};

function isAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return !!email && admins.includes(email.toLowerCase());
}

export default async function AdminImportsPage() {
  const ssr = await supabaseServerClient();
  const { data: userData } = await ssr.auth.getUser();
  const user = userData?.user ?? null;

  if (!isAdmin(user?.email)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">Import Queue</h1>
        <p className="mt-2 text-sm text-gray-400">
          You are not authorized to view this page.
        </p>
      </main>
    );
  }

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("novel_import_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  const rows = (data as ImportRow[] | null) ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-gray-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Import Queue</h1>
          <p className="text-sm text-gray-400">
            Review submitted novels before adding them to the database.
          </p>
        </div>

        <Link
          href="/library"
          className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-indigo-500 hover:text-white"
        >
          Library
        </Link>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-400">Failed to load imports.</p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No pending imports.</p>
      ) : (
        <ul className="space-y-6">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
                    Import #{row.id}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-white">
                    {row.suggested_title || row.raw_title || "Untitled Submission"}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Source: {row.source_url || "No URL"}
                  </p>
                </div>

                <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-medium text-yellow-200">
                  {row.status}
                </span>
              </div>

              <form
                action="/api/approve-import"
                method="post"
                className="grid gap-4 lg:grid-cols-2"
              >
                <input type="hidden" name="import_id" value={row.id} />

                <Field name="title" label="Title" defaultValue={row.suggested_title || row.raw_title || ""} required />
                <Field name="author_name" label="Author" defaultValue={row.suggested_author || ""} />
                <Field name="source_site" label="Source Site" defaultValue={row.suggested_source_site || ""} />
                <Field name="source_url" label="Source URL" defaultValue={row.source_url || ""} />
                <Field name="cover_image_url" label="Cover URL" defaultValue={row.suggested_cover_url || ""} />
                <Field name="primary_genre" label="Primary Genre" defaultValue={row.suggested_primary_genre || ""} />
                <Field name="status" label="Status" defaultValue="unknown" />
                <Field name="translation_status" label="Translation Status" defaultValue="unknown" />
                <Field name="chapters_total" label="Chapters Total" type="number" />
                <Field name="country" label="Country" />

                <label className="block text-sm lg:col-span-2">
                  <span className="mb-1 block text-gray-300">Synopsis</span>
                  <textarea
                    name="synopsis"
                    rows={5}
                    defaultValue={row.suggested_synopsis || ""}
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
                  />
                </label>

                <label className="block text-sm lg:col-span-2">
                  <span className="mb-1 block text-gray-300">Tags comma-separated</span>
                  <input
                    name="tags"
                    defaultValue={(row.suggested_tags || []).join(", ")}
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
                  />
                </label>

                {row.raw_payload && (
                  <div className="lg:col-span-2 rounded-lg border border-white/10 bg-black/30 p-3">
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-gray-500">
                      Raw payload
                    </p>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-gray-300">
                      {row.raw_payload}
                    </pre>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 lg:col-span-2">
                  <button
                    type="submit"
                    name="action"
                    value="approve"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    Approve & Create Novel
                  </button>

                  <button
                    type="submit"
                    name="action"
                    value="duplicate"
                    className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-yellow-500 hover:text-white"
                  >
                    Mark Duplicate
                  </button>

                  <button
                    type="submit"
                    name="action"
                    value="reject"
                    className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-red-500 hover:text-white"
                  >
                    Reject
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Field({
  name,
  label,
  defaultValue = "",
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-300">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
      />
    </label>
  );
}