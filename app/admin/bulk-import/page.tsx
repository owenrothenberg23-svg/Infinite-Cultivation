"use client";

import Link from "next/link";
import { useState } from "react";

const EXAMPLE = `Reverend Insanity | Gu Zhen Ren | xianxia | discontinued | 2334 | ruthless_mc,dark,antihero,scheming | https://example.com | https://example.com/cover.jpg
Lord of the Mysteries | Cuttlefish That Loves Diving | xuanhuan | completed | 1432 | mystery,transmigration,power_system,dark | https://example.com | https://example.com/cover.jpg`;

export default function BulkImportPage() {
  const [text, setText] = useState(EXAMPLE);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleImport() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/bulk-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setMessage(
        `Imported ${data.inserted} novels. Skipped ${data.skipped} duplicates/invalid rows.`
      );
    } catch (err: any) {
      setMessage(err.message || "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Bulk Novel Import</h1>
          <p className="mt-2 text-sm text-gray-400">
            Admin-only tool. Paste one novel per line using pipe separators.
          </p>
        </div>

        <Link
          href="/admin/imports"
          className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-indigo-500 hover:text-white"
        >
          Import Queue
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Format</p>
        <pre className="mt-3 overflow-auto rounded bg-black/30 p-3 text-xs text-gray-300">
{`Title | Author | Genre | Status | Chapters | Tags | Source URL | Cover URL`}
        </pre>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={18}
          className="mt-4 w-full rounded-md border border-gray-700 bg-gray-900 p-3 text-sm text-gray-100"
        />

        <button
          onClick={handleImport}
          disabled={loading}
          className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? "Importing..." : "Import Novels"}
        </button>

        {message && <p className="mt-4 text-sm text-gray-300">{message}</p>}
      </div>
    </main>
  );
}