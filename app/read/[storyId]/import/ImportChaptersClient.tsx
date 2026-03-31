"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ParsedChapter = {
  tempId: string;
  title: string;
  content: string;
};

type Props = {
  storyId: string;
  suggestedStart: number; // usually last_chapter_number + 1
};

type ImportMode = "reject" | "skip" | "overwrite";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function normalizeNewlines(s: string) {
  return (s || "").replace(/\r\n/g, "\n");
}

/**
 * Splits a big paste into chapters using common headings.
 * Supported headings:
 * - Chapter 12
 * - CHAPTER 12: Title
 * - Chapter 12 - Title
 * - 12. Title
 * - 12 - Title
 */
function splitIntoChapters(raw: string): ParsedChapter[] {
  const text = normalizeNewlines(raw).trim();
  if (!text) return [];

  const lines = text.split("\n");

  const headerRegex =
    /^\s*(?:chapter|ch)\s*(\d{1,5})\s*(?:[:.\-–—]\s*(.*))?\s*$/i;
  const numericRegex =
    /^\s*(\d{1,5})\s*(?:[.)\-–—:]\s*(.*))\s*$/;

  type Hit = { idx: number; title: string };
  const hits: Hit[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || "").trim();
    if (!line) continue;

    let m = line.match(headerRegex);
    if (m) {
      const n = m[1];
      const t = (m[2] || "").trim();
      hits.push({ idx: i, title: t ? `Chapter ${n}: ${t}` : `Chapter ${n}` });
      continue;
    }

    m = line.match(numericRegex);
    if (m) {
      const n = m[1];
      const t = (m[2] || "").trim();
      const num = Number(n);
      if (num >= 1 && num <= 5000) {
        hits.push({ idx: i, title: t ? `Chapter ${n}: ${t}` : `Chapter ${n}` });
      }
    }
  }

  if (hits.length === 0) {
    return [{ tempId: uid(), title: "Chapter (imported)", content: text }];
  }

  const out: ParsedChapter[] = [];
  for (let h = 0; h < hits.length; h++) {
    const startLine = hits[h].idx;
    const endLine = h + 1 < hits.length ? hits[h + 1].idx : lines.length;
    const body = lines.slice(startLine + 1, endLine).join("\n").trim();

    out.push({
      tempId: uid(),
      title: hits[h].title,
      content: body,
    });
  }

  return out.filter((c) => c.title.trim());
}

export default function ImportChaptersClient({ storyId, suggestedStart }: Props) {
  const router = useRouter();

  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedChapter[] | null>(null);

  // 0 means "use suggestedStart"
  const [startingNumber, setStartingNumber] = useState<number>(0);

  // ✅ NEW: conflict behavior
  const [mode, setMode] = useState<ImportMode>("reject");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canParse = raw.trim().length > 0;

  const computedPreview = useMemo(() => {
    if (!parsed) return null;

    const base =
      startingNumber && startingNumber > 0
        ? startingNumber
        : suggestedStart && suggestedStart > 0
        ? suggestedStart
        : 1;

    return parsed.map((c, idx) => ({
      ...c,
      chapter_number: base + idx,
    }));
  }, [parsed, startingNumber, suggestedStart]);

  function onParse() {
    setErr(null);
    setOk(null);

    const chunks = splitIntoChapters(raw);

    const cleaned = chunks
      .map((c) => ({
        ...c,
        title: (c.title || "").trim(),
        content: (c.content || "").trim(),
      }))
      .filter((c) => c.content.length > 0);

    if (cleaned.length === 0) {
      setParsed(null);
      setErr(
        "Couldn’t detect any chapter content. Paste again (include text under headers)."
      );
      return;
    }

    setParsed(cleaned);
  }

  function updateTitle(tempId: string, title: string) {
    setParsed((prev) =>
      prev ? prev.map((c) => (c.tempId === tempId ? { ...c, title } : c)) : prev
    );
  }

  function removeChapter(tempId: string) {
    setParsed((prev) => (prev ? prev.filter((c) => c.tempId !== tempId) : prev));
  }

  async function doImport() {
    if (!computedPreview || computedPreview.length === 0 || busy) return;

    setBusy(true);
    setErr(null);
    setOk(null);

    try {
      const chapters = computedPreview.map((c, idx) => ({
        chapter_number: Number(c.chapter_number ?? idx + 1),
        title: (c.title || `Chapter ${idx + 1}`).trim(),
        content: c.content,
      }));

      const res = await fetch("/api/import-chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          storyId,
          chapters,
          mode, // ✅ NEW
        }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        setBusy(false);
        setErr(json?.error || "Import failed");
        return;
      }

      const imported = Number(json?.imported ?? 0);
      const skipped = Number(json?.skipped ?? 0);

      // show local success too (helpful if router push fails)
      setOk(
        `Imported ${imported} chapter${imported === 1 ? "" : "s"}${
          skipped ? ` (skipped ${skipped})` : ""
        } using mode: ${mode}.`
      );

      // send them back to manage story with banner
      router.push(`/read/${storyId}?imported=${imported}`);
    } catch (e: any) {
      setBusy(false);
      setErr(e?.message || "Import failed");
    }
  }

  const effectiveStart =
    startingNumber && startingNumber > 0 ? startingNumber : suggestedStart;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {err && (
        <div className="lg:col-span-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {ok && (
        <div className="lg:col-span-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {ok}
        </div>
      )}

      {/* Paste */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-white">1) Paste</h2>
        <p className="mt-1 text-xs text-gray-400">
          Best results if your paste includes headings like “Chapter 12: Title”.
        </p>

        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={18}
          placeholder={`Chapter 1: The Awakening\n...\n\nChapter 2: ...\n...`}
          className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onParse}
            disabled={!canParse}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-gray-400"
          >
            Create preview
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span className="text-gray-400">Starting chapter #</span>
            <input
              type="number"
              min={0}
              value={startingNumber}
              onChange={(e) => setStartingNumber(Number(e.target.value))}
              className="w-24 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-gray-100"
            />
            <span className="text-gray-500">(0 = suggested {effectiveStart})</span>
          </div>
        </div>

        {/* ✅ NEW: conflict handling */}
        <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">
            If chapters already exist…
          </p>

          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ImportMode)}
            className="mt-2 w-full rounded-md border border-gray-700 bg-slate-950 px-3 py-2 text-sm text-gray-100"
          >
            <option value="reject">Reject (error if conflicts)</option>
            <option value="skip">Skip existing (import the rest)</option>
            <option value="overwrite">Overwrite existing (replace conflicts)</option>
          </select>

          <p className="mt-2 text-xs text-gray-500">
            Recommended: <b>Skip</b> for “resume importing”, <b>Overwrite</b> for
            re-importing corrected chapters.
          </p>
        </div>
      </section>

      {/* Preview */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-white">2) Preview</h2>
        <p className="mt-1 text-xs text-gray-400">
          Edit titles, remove mistakes, then import.
        </p>

        {!computedPreview ? (
          <div className="mt-6 rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-gray-400">
            Generate a preview to see chapters here.
          </div>
        ) : (
          <div className="mt-3 space-y-3 max-h-[520px] overflow-auto pr-2">
            {computedPreview.map((c) => (
              <div
                key={c.tempId}
                className="rounded-lg border border-white/10 bg-black/30 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-gray-500">
                      Chapter #{c.chapter_number}
                    </p>

                    <input
                      value={c.title}
                      onChange={(e) => updateTitle(c.tempId, e.target.value)}
                      className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-gray-100"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeChapter(c.tempId)}
                    className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-200 hover:border-red-400 hover:text-red-200"
                  >
                    Remove
                  </button>
                </div>

                <p className="mt-2 text-xs text-gray-400 line-clamp-3 whitespace-pre-wrap">
                  {c.content.slice(0, 240)}
                  {c.content.length > 240 ? "…" : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={doImport}
            disabled={!computedPreview || computedPreview.length === 0 || busy}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-gray-400"
          >
            {busy ? "Importing…" : "Import chapters"}
          </button>

          <Link href={`/read/${storyId}`} className="text-sm text-gray-300 hover:text-white">
            Cancel
          </Link>
        </div>
      </section>
    </div>
  );
}