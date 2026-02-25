// app/read/[storyId]/import/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ParsedChapter = {
  tempId: string;
  title: string;
  content: string;
};

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
      hits.push({
        idx: i,
        title: t ? `Chapter ${n}: ${t}` : `Chapter ${n}`,
      });
      continue;
    }

    m = line.match(numericRegex);
    if (m) {
      const n = m[1];
      const t = (m[2] || "").trim();
      // Avoid false positives like "2024 - blah" by requiring small-ish chapter numbers
      const num = Number(n);
      if (num >= 1 && num <= 5000) {
        hits.push({
          idx: i,
          title: t ? `Chapter ${n}: ${t}` : `Chapter ${n}`,
        });
      }
    }
  }

  // If we didn't detect headings, treat whole paste as one chapter
  if (hits.length === 0) {
    return [
      {
        tempId: uid(),
        title: "Chapter (imported)",
        content: text,
      },
    ];
  }

  // Build chapter blocks
  const out: ParsedChapter[] = [];
  for (let h = 0; h < hits.length; h++) {
    const startLine = hits[h].idx;
    const endLine = h + 1 < hits.length ? hits[h + 1].idx : lines.length;

    // Content excludes header line itself
    const body = lines.slice(startLine + 1, endLine).join("\n").trim();

    // If body is empty, still keep it but you can delete in preview
    out.push({
      tempId: uid(),
      title: hits[h].title,
      content: body,
    });
  }

  // Filter obvious junk empties (optional)
  return out.filter((c) => c.title.trim());
}

export default function ImportChaptersPage({
  params,
}: {
  params: { storyId: string };
}) {
  const router = useRouter();
  const storyId = params.storyId;

  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedChapter[] | null>(null);
  const [startingNumber, setStartingNumber] = useState<number>(0); // 0 = auto server-side
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const canParse = raw.trim().length > 0;

  const computedPreview = useMemo(() => {
    if (!parsed) return null;

    const base = startingNumber && startingNumber > 0 ? startingNumber : null;
    return parsed.map((c, idx) => ({
      ...c,
      chapter_number: base ? base + idx : null, // server will fill if null
    }));
  }, [parsed, startingNumber]);

  function onParse() {
    setErr(null);
    setOkMsg(null);
    const chunks = splitIntoChapters(raw);

    // Remove totally empty chapters
    const cleaned = chunks
      .map((c) => ({ ...c, content: (c.content || "").trim() }))
      .filter((c) => c.content.length > 0);

    if (cleaned.length === 0) {
      setErr("Couldn’t detect any chapter content. Paste again (include text under headers).");
      setParsed(null);
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
    if (!parsed || parsed.length === 0 || busy) return;

    setBusy(true);
    setErr(null);
    setOkMsg(null);

    try {
      const base = startingNumber && startingNumber > 0 ? startingNumber : null;

      const chapters = parsed.map((c, idx) => ({
        chapter_number: base ? base + idx : idx + 1, // placeholder; server conflict-check will use these
        title: c.title || `Chapter ${idx + 1}`,
        content: c.content,
      }));

      // If startingNumber is 0, we still must send numbers; server will accept them.
      // Recommended usage: set startingNumber to (last+1). If you leave 0, set it to 1.
      // We'll default to 1 here to avoid NaNs.
      if (!base) {
        // keep as 1..n
      }

      const res = await fetch("/api/import-chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          storyId,
          chapters,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(json?.error || "Import failed");
        setBusy(false);
        return;
      }

      setOkMsg(`Imported ${json?.imported ?? chapters.length} chapters.`);
      // send them back to manage story
      router.push(`/read/${storyId}`);
    } catch (e: any) {
      setErr(e?.message || "Import failed");
      setBusy(false);
      return;
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-gray-100">
      <header className="mb-6 space-y-2">
        <Link href={`/read/${storyId}`} className="text-sm text-indigo-300 hover:text-indigo-200">
          ← Back to story
        </Link>
        <h1 className="text-3xl font-bold">Bulk Import Chapters</h1>
        <p className="text-sm text-gray-400">
          Paste multiple chapters. We’ll split them into a preview, then import as drafts.
        </p>
      </header>

      {err && <p className="mb-4 text-sm text-red-400">{err}</p>}
      {okMsg && <p className="mb-4 text-sm text-emerald-300">{okMsg}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
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
            className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
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
              <span className="text-gray-500">(0 = you pick / default)</span>
            </div>
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
              {computedPreview.map((c, idx) => (
                <div key={c.tempId} className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-gray-500">
                        {c.chapter_number ? `Chapter #${c.chapter_number}` : `Chapter (index ${idx + 1})`}
                      </p>
                      <input
                        value={c.title}
                        onChange={(e) => updateTitle(c.tempId, e.target.value)}
                        className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-gray-100"
                      />
                    </div>

                    <button
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
              onClick={doImport}
              disabled={!computedPreview || computedPreview.length === 0 || busy}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-gray-400"
            >
              {busy ? "Importing…" : "Import chapters"}
            </button>

            <Link
              href={`/read/${storyId}`}
              className="text-sm text-gray-300 hover:text-white"
            >
              Cancel
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}