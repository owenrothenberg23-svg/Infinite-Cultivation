"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Props = {
  storyId: string;
  chapterNumber: number;
  authorId: string | null;
  initialContent: string;
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
  const [finalizing, setFinalizing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // autosave
  const lastSavedHashRef = useRef<string>("");
  const autosaveTimerRef = useRef<any>(null);

  // Check if current user is the author
  useEffect(() => {
    let cancelled = false;
    if (!authorId) return;

    (async () => {
      try {
        const sb = supabaseBrowser();
        const { data } = await sb.auth.getSession();
        const userId = data.session?.user?.id ?? null;

        if (!cancelled) setCanEdit(!!userId && userId === authorId);
      } catch (e) {
        console.error("ChapterEditor: session check error", e);
        if (!cancelled) setCanEdit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authorId]);

  // Keep local state in sync when not actively editing
  useEffect(() => {
    if (!editing) setContent(initialContent);
  }, [initialContent, editing]);

  useEffect(() => {
    if (!editing) setTitle(initialTitle);
  }, [initialTitle, editing]);

  // Autosave while editing (every 8s if changed)
  useEffect(() => {
    if (!editing) return;

    const hash = `${title.trim()}__${content}`;
    if (hash === lastSavedHashRef.current) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/save-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId,
            chapterNumber,
            title: title.trim() || null,
            content,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

        lastSavedHashRef.current = hash;
        setStatus("Draft autosaved.");
        setError(null);
      } catch (e: any) {
        console.warn("autosave failed", e);
        setError(e?.message || "Autosave failed");
      }
    }, 8000);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [editing, title, content, storyId, chapterNumber]);

  if (!canEdit) return null;

  async function handleSaveDraftNow() {
    setError(null);
    setStatus(null);
    setSaving(true);

    try {
      const trimmedTitle = title.trim();
      const res = await fetch("/api/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          chapterNumber,
          title: trimmedTitle || null,
          content,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      lastSavedHashRef.current = `${trimmedTitle}__${content}`;
      setStatus("Draft saved.");
    } catch (err: any) {
      setError(err?.message || "Could not save draft.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    setError(null);
    setStatus(null);

    const trimmed = content.trim();
    if (!trimmed) {
      setError("Chapter content cannot be empty.");
      return;
    }

    setFinalizing(true);
    try {
      // ensure latest draft saved first
      await handleSaveDraftNow();

      const res = await fetch("/api/finalize-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, chapterNumber }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setStatus("Finalized! Readers will see the updated chapter.");
      setEditing(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to finalize.");
    } finally {
      setFinalizing(false);
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
      <div className="mb-3 flex items-center justify-between gap-3">
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving || finalizing}
              className="rounded-md border border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveDraftNow}
              disabled={saving || finalizing}
              className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>

            <button
              type="button"
              onClick={handleFinalize}
              disabled={saving || finalizing}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {finalizing ? "Finalizing…" : "Finalize / Publish"}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <>
          <p className="mb-2 text-xs text-gray-400">
            Drafts autosave while you edit. Finalize to publish the updated version.
          </p>

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
            className="mt-1 w-full min-h-[320px] rounded-md border border-gray-700 bg-slate-950 px-3 py-2 text-sm text-gray-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </>
      ) : (
        <p className="text-xs text-gray-500">
          Only you can see this section. Edit drafts, then finalize when ready.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {status && <p className="mt-2 text-xs text-emerald-400">{status}</p>}
    </section>
  );
}