"use client";

import Link from "next/link";
import { useState } from "react";

const EXAMPLE = `https://www.novelupdates.com/series/reverend-insanity/
https://www.royalroad.com/fiction/example
https://www.webnovel.com/book/example`;

export default function AdminUrlImportPage() {
  const [urls, setUrls] = useState(EXAMPLE);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleImport() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/url-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "URL import failed");

      setMessage(
        `Queued ${data.queued} imports. Skipped ${data.skipped}. Failed ${data.failed}.`
      );
    } catch (err: any) {
      setMessage(err?.message || "URL import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">URL Novel Import</h1>
          <p className="mt-2 text-sm text-gray-400">
            Paste novel page URLs. Metadata will be extracted into the approval queue.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/imports"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Import Queue
          </Link>
          <Link
            href="/admin/bulk-import"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Bulk Rows
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-semibold text-white">One URL per line</p>

        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={14}
          className="mt-4 w-full rounded-md border border-gray-700 bg-gray-900 p-3 text-sm text-gray-100"
        />

        <button
          onClick={handleImport}
          disabled={loading}
          className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? "Importing..." : "Extract to Queue"}
        </button>

        {message && <p className="mt-4 text-sm text-gray-300">{message}</p>}
      </div>
    </main>
  );
}