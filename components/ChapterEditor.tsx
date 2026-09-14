"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { callEditAssist } from "@/lib/editAssistClient";

type Props = {
  storyId: string;
  chapterNumber: number;
  authorId: string | null;
  initialContent: string;
  initialTitle?: string;
};

type AssistMode = "fix" | "rewrite" | "continue" | "suggest";

function mapMode(
  mode: AssistMode
): "grammar" | "rewrite" | "continue" | "suggest" {
  switch (mode) {
    case "fix":
      return "grammar";
    case "rewrite":
      return "rewrite";
    case "continue":
      return "continue";
    case "suggest":
      return "suggest";
  }
}

function wordCount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

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

  const lastSavedHashRef = useRef("");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showAssist, setShowAssist] = useState(false);
  const [assistMode, setAssistMode] = useState<AssistMode>("fix");
  const [assistInstruction, setAssistInstruction] = useState("");
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistOutput, setAssistOutput] = useState("");
  const [assistError, setAssistError] = useState<string | null>(null);

  const words = wordCount(content);
  const characters = content.length;

  useEffect(() => {
    let cancelled = false;

    if (!authorId) {
      setCanEdit(false);
      return;
    }

    (async () => {
      try {
        const sb = supabaseBrowser();
        const { data } = await sb.auth.getSession();
        const userId = data.session?.user?.id ?? null;

        if (!cancelled) {
          setCanEdit(!!userId && userId === authorId);
        }
      } catch (err) {
        console.error("ChapterEditor session check failed", err);
        if (!cancelled) setCanEdit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authorId]);

  useEffect(() => {
    if (!editing) setContent(initialContent);
  }, [initialContent, editing]);

  useEffect(() => {
    if (!editing) setTitle(initialTitle);
  }, [initialTitle, editing]);

  useEffect(() => {
    if (!editing) return;

    const hash = `${title.trim()}__${content}`;

    if (hash === lastSavedHashRef.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/save-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            storyId,
            chapterNumber,
            title: title.trim() || null,
            content,
          }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || `HTTP ${response.status}`);
        }

        lastSavedHashRef.current = hash;
        setStatus("Draft autosaved.");
        setError(null);
      } catch (err: unknown) {
        console.warn("Chapter autosave failed", err);
        setError(
          err instanceof Error ? err.message : "Autosave failed."
        );
      }
    }, 8000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [editing, title, content, storyId, chapterNumber]);

  if (!canEdit) return null;

  async function saveDraft() {
    const trimmedTitle = title.trim();

    const response = await fetch("/api/save-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        storyId,
        chapterNumber,
        title: trimmedTitle || null,
        content,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    lastSavedHashRef.current = `${trimmedTitle}__${content}`;
  }

  async function handleSaveDraftNow() {
    setError(null);
    setStatus(null);
    setSaving(true);

    try {
      await saveDraft();
      setStatus("Draft saved.");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not save draft."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    setError(null);
    setStatus(null);

    if (!content.trim()) {
      setError("Chapter content cannot be empty.");
      return;
    }

    setFinalizing(true);

    try {
      await saveDraft();

      const response = await fetch("/api/finalize-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ storyId, chapterNumber }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      setStatus("Chapter finalized successfully.");
      setEditing(false);
      setShowAssist(false);
      setAssistOutput("");
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to finalize chapter."
      );
    } finally {
      setFinalizing(false);
    }
  }

  function startEditing() {
    setEditing(true);
    setStatus(null);
    setError(null);
    setAssistOutput("");
    setAssistError(null);
    lastSavedHashRef.current = `${initialTitle.trim()}__${initialContent}`;
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
    setStatus(null);
    setContent(initialContent);
    setTitle(initialTitle);
    setShowAssist(false);
    setAssistOutput("");
    setAssistError(null);
  }

  async function runAssist() {
    setAssistError(null);
    setAssistOutput("");
    setStatus(null);

    const text = content.trim();

    if (!text) {
      setAssistError("Add chapter text before using writing assistance.");
      return;
    }

    setAssistBusy(true);

    try {
      const result = await callEditAssist({
        text,
        mode: mapMode(assistMode),
        instruction: assistInstruction.trim() || undefined,
      });

      const output = String(result || "").trim();

      if (!output) {
        setAssistError("No output was returned.");
        return;
      }

      setAssistOutput(output);
    } catch (err: unknown) {
      setAssistError(
        err instanceof Error ? err.message : "Writing assistance failed."
      );
    } finally {
      setAssistBusy(false);
    }
  }

  function replaceWithAssistOutput() {
    if (!assistOutput.trim()) return;

    setContent(assistOutput);
    setAssistOutput("");
    setAssistError(null);
    setStatus("Suggestion applied to the editor. Save when ready.");
  }

  function appendAssistOutput() {
    if (!assistOutput.trim()) return;

    setContent((previous) => {
      const current = previous.trimEnd();
      return current
        ? `${current}\n\n${assistOutput.trim()}`
        : assistOutput.trim();
    });

    setAssistOutput("");
    setAssistError(null);
    setStatus("Continuation added to the editor. Save when ready.");
  }

  async function copyAssistOutput() {
    try {
      await navigator.clipboard.writeText(assistOutput || "");
      setStatus("Suggestion copied.");
    } catch {
      setAssistError("Could not copy to clipboard.");
    }
  }

  return (
    <div>
      {!editing ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">
                Chapter {chapterNumber}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {words.toLocaleString("en-US")} words ·{" "}
                {characters.toLocaleString("en-US")} characters
              </p>
            </div>

            <button
              type="button"
              onClick={startEditing}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Edit Chapter
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Only you can access editing controls for this chapter.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-gray-500">
              <span>{words.toLocaleString("en-US")} words</span>
              <span className="mx-2 text-gray-700">•</span>
              <span>{characters.toLocaleString("en-US")} characters</span>
              <span className="mx-2 text-gray-700">•</span>
              <span>Autosaves after changes</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving || finalizing || assistBusy}
                className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs font-medium text-gray-300 hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveDraftNow}
                disabled={saving || finalizing || assistBusy}
                className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>

              <button
                type="button"
                onClick={handleFinalize}
                disabled={saving || finalizing || assistBusy}
                className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {finalizing ? "Finalizing..." : "Finalize Chapter"}
              </button>
            </div>
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-gray-500">
              Chapter Title
            </span>

            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={`Chapter ${chapterNumber}`}
              maxLength={120}
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-gray-500">
              Chapter Draft
            </span>

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              spellCheck
              className="mt-2 min-h-[520px] w-full resize-y rounded-xl border border-white/10 bg-slate-950 px-4 py-4 text-[15px] leading-7 text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500"
              placeholder="Write your chapter..."
            />
          </label>

          <div className="rounded-xl border border-white/10 bg-black/20">
            <button
              type="button"
              onClick={() => {
                setShowAssist((value) => !value);
                setAssistError(null);
              }}
              className="flex w-full items-center justify-between gap-4 p-4 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  Optional Writing Assistance
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Grammar, rewriting, continuation, and feedback tools.
                </p>
              </div>

              <span className="text-xs text-indigo-300">
                {showAssist ? "Hide" : "Open"}
              </span>
            </button>

            {showAssist && (
              <div className="border-t border-white/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex-1">
                    <span className="text-xs text-gray-400">Tool</span>

                    <select
                      value={assistMode}
                      onChange={(event) =>
                        setAssistMode(event.target.value as AssistMode)
                      }
                      className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-500"
                    >
                      <option value="fix">Fix grammar & typos</option>
                      <option value="rewrite">Rewrite passage</option>
                      <option value="continue">Draft a continuation</option>
                      <option value="suggest">Give suggestions</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={runAssist}
                    disabled={assistBusy || saving || finalizing}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {assistBusy ? "Working..." : "Generate Preview"}
                  </button>
                </div>

                <label className="mt-4 block">
                  <span className="text-xs text-gray-400">
                    Optional instruction
                  </span>

                  <input
                    value={assistInstruction}
                    onChange={(event) =>
                      setAssistInstruction(event.target.value)
                    }
                    placeholder='Example: "Make the dialogue tighter without changing the characters."'
                    className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500"
                  />
                </label>

                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  Results are previews only. Nothing changes in your chapter
                  unless you explicitly apply it, and applied text is not saved
                  until you save or finalize.
                </p>

                {assistError && (
                  <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                    {assistError}
                  </div>
                )}

                {assistOutput && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-slate-950">
                    <div className="border-b border-white/10 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-indigo-300">
                        Preview
                      </p>
                    </div>

                    <div className="max-h-80 overflow-auto whitespace-pre-wrap px-4 py-4 text-sm leading-6 text-gray-200">
                      {assistOutput}
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-white/10 p-3">
                      {assistMode === "continue" ? (
                        <button
                          type="button"
                          onClick={appendAssistOutput}
                          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          Append to Draft
                        </button>
                      ) : assistMode === "suggest" ? (
                        <span className="inline-flex items-center px-1 text-xs text-gray-500">
                          Suggestions are not applied automatically.
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={replaceWithAssistOutput}
                          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          Replace Draft Text
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={copyAssistOutput}
                        className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white"
                      >
                        Copy
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAssistOutput("");
                          setAssistError(null);
                        }}
                        className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {status && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              {status}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={handleSaveDraftNow}
              disabled={saving || finalizing || assistBusy}
              className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>

            <button
              type="button"
              onClick={handleFinalize}
              disabled={saving || finalizing || assistBusy}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {finalizing ? "Finalizing..." : "Finalize Chapter"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}