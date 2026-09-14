// app/admin/catalog-jobs/page.tsx

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";
import CatalogJobControls from "@/components/CatalogJobControls";

export const dynamic = "force-dynamic";

type CatalogJob = {
  id: number;
  name: string;
  source_site: string | null;
  import_method: string;
  status: string;

  total_discovered: number;
  total_pending: number;
  total_processing: number;
  total_completed: number;
  total_failed: number;
  total_skipped: number;

  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

function isAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(
    email &&
      admins.includes(email.toLowerCase())
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function prettyStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function statusClasses(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-200";

    case "completed_with_errors":
      return "bg-yellow-500/15 text-yellow-200";

    case "processing":
    case "discovering":
      return "bg-sky-500/15 text-sky-200";

    case "failed":
    case "cancelled":
      return "bg-red-500/15 text-red-200";

    default:
      return "bg-white/10 text-gray-300";
  }
}

export default async function CatalogJobsPage() {
  const ssr = await supabaseServerClient();
  const { data: userData } = await ssr.auth.getUser();
  const user = userData?.user ?? null;

  if (!isAdmin(user?.email)) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-gray-100">
        <h1 className="text-3xl font-bold">
          Catalog Jobs
        </h1>

        <p className="mt-2 text-sm text-gray-400">
          You are not authorized to view this page.
        </p>
      </main>
    );
  }

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("catalog_import_jobs")
    .select(
      `
        id,
        name,
        source_site,
        import_method,
        status,
        total_discovered,
        total_pending,
        total_processing,
        total_completed,
        total_failed,
        total_skipped,
        created_at,
        started_at,
        completed_at
      `
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(100);

  const jobs = (data as CatalogJob[] | null) ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-gray-100">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
            Admin Tool
          </p>

          <h1 className="mt-1 text-3xl font-bold text-white">
            Catalog Jobs
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            Track URL catalog imports and process their pending metadata batches.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/catalog-import"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            New Catalog Job
          </Link>

          <Link
            href="/admin/imports"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Approval Queue
          </Link>
        </div>
      </header>

      {error && (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-200">
            Failed to load catalog jobs: {error.message}
          </p>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-gray-400">
            No catalog jobs have been created yet.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {jobs.map((job) => (
            <article
              key={job.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">
                    Job #{job.id}
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-white">
                    {job.name}
                  </h2>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>
                      Source: {job.source_site || "Unknown"}
                    </span>

                    <span>
                      Method: {prettyStatus(job.import_method)}
                    </span>

                    <span>
                      Created: {formatDate(job.created_at)}
                    </span>
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(
                    job.status
                  )}`}
                >
                  {prettyStatus(job.status)}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Stat
                  label="Discovered"
                  value={job.total_discovered}
                />

                <Stat
                  label="Pending"
                  value={job.total_pending}
                />

                <Stat
                  label="Processing"
                  value={job.total_processing}
                />

                <Stat
                  label="Completed"
                  value={job.total_completed}
                />

                <Stat
                  label="Failed"
                  value={job.total_failed}
                />

                <Stat
                  label="Skipped"
                  value={job.total_skipped}
                />
              </div>

              <div className="mt-5">
                <CatalogJobControls
                  jobId={job.id}
                  pendingCount={job.total_pending}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}