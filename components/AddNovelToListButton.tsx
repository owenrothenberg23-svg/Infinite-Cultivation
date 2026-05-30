"use client";

import { useState } from "react";

type ListOption = {
  id: number;
  title: string;
};

export default function AddNovelToListButton({
  novelId,
  lists,
  isAuthed,
}: {
  novelId: string;
  lists: ListOption[];
  isAuthed: boolean;
}) {
  const [selected, setSelected] = useState(lists[0]?.id?.toString() || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function addToList() {
    if (!isAuthed) {
      setMessage("Log in to add novels to lists.");
      return;
    }

    if (!selected) {
      setMessage("Create a list first.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch("/api/add-novel-to-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId, listId: Number(selected) }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setMessage("Added to list.");
    } catch (e: any) {
      setMessage(e?.message || "Failed to add.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">Add to List</p>

      {lists.length === 0 ? (
        <p className="mt-2 text-xs text-gray-400">
          Create a list first from the Lists page.
        </p>
      ) : (
        <>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-3 w-full rounded-md border border-gray-700 bg-slate-950 px-3 py-2 text-sm text-gray-100"
          >
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={addToList}
            disabled={busy}
            className="mt-3 w-full rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add Novel"}
          </button>
        </>
      )}

      {message && <p className="mt-2 text-xs text-gray-400">{message}</p>}
    </div>
  );
}