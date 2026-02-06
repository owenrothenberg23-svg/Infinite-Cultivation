// components/ChapterEditor.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Props = {
  storyId: string;
  chapterNumber: number;
  authorId: string | null;
  initialContent: string;

  // ✅ NEW
  initialTitle?: string;
};

export default function ChapterEditor({
  storyId,
  chapterNumber,
  authorId,
  initialContent,
  initialTitle = "",
}: Props) {
  const router = useRouter();
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState(false);

  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Check if current user is the author
  useEffect(() => {
    let cancelled = false;
    if (!authorId) return;

    (async () => {
      try {
        const sb = supabaseBrowser();
        const { data } = await sb.auth.getSession();
        const userId = data.session?.user?.id ?? null;

        if (!cancelled) {
          setCanEdit(!!userId && userId === authorId);
        }
      } catch (e) {
        console.error("ChapterEditor: session check error", e);
        if (!cancelled) setCanEdit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authorId]);

  // Keep local state in sync if server content/title changes and user is not actively editing
  useEffect(() => {
    if (!editing) setContent(initialContent);
  }, [initialContent, editing]);

  useEffect(() => {
    if (!editing) setTitle(initialTitle);
  }, [initialTitle, editing]);

  if (!canEdit) return null; // non-authors see nothing

  async function handleSave() {
    setError(null);
    setStatus(null);

    const trimmedContent = content.trim();
    const trimmedTitle = title.trim();

    if (!trimmedContent) {
      setError("Chapter content cannot be empty.");
      return;
    }

    // Keep titles reasonable but flexible
    if (trimmedTitle.length > 120) {
      setError("Title is too long (max 120 characters).");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/edit-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          chapterNumber,
          content: trimmedContent,

          // ✅ NEW: send title (optional)
          title: trimmedTitle || null, // allow clearing -> fallback display
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      setStatus("Chapter updated. Continuity memory refreshed.");
      setEditing(false);
      router.refresh();
    } catch (err: any) {
      console.error("ChapterEditor: save error", err);
      setError(err?.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
    setStatus(null);
    setContent(initialContent);
    setTitle(initialTitle);
  }

  return (
    <section className="mt-10 border-t border-white/10 pt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-200">Author tools</h3>

        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setStatus(null);
              setError(null);
            }}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            Edit chapter
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded-md border border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <>
          <p className="mb-2 text-xs text-gray-400">
            Edit the chapter title + text. On save, continuity memories for this
            chapter will be regenerated so future AI chapters respect your edits.
          </p>

          {/* ✅ NEW: title input */}
          <div className="mb-3">
            <label className="block text-xs uppercase tracking-[0.2em] text-gray-400">
              Chapter title
            </label>
            <input
              className="mt-1 w-full rounded-md border border-gray-700 bg-slate-950 px-3 py-2 text-sm text-gray-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Chapter ${chapterNumber}`}
              maxLength={120}
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Leave blank to fall back to “Chapter {chapterNumber}”.
            </p>
          </div>

          <textarea
            className="mt-1 w-full min-h-[280px] rounded-md border border-gray-700 bg-slate-950 px-3 py-2 text-sm text-gray-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </>
      ) : (
        <p className="text-xs text-gray-500">
          Only you can see this section. Use it to fix typos or reshape scenes
          without breaking continuity.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {status && <p className="mt-2 text-xs text-emerald-400">{status}</p>}
    </section>
  );
}
