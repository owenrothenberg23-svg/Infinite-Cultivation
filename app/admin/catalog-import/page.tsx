"use client";

import Link from "next/link";
import { useRef, useState } from "react";

const EXAMPLE_URLS = `https://www.royalroad.com/fiction/21220/mother-of-learning
https://www.royalroad.com/fiction/41618/mark-of-the-fool
https://www.royalroad.com/fiction/63759/super-supportive`;

type InputMode = "paste" | "file";

type ImportResult = {
  success: boolean;
  job_id: number;
  submitted: number;
  unique_valid?: number;
  queued: number;
  skipped: number;
  invalid: number;
  import_method?: string;
};

type WorkerItemResult = {
  crawl_queue_id: number;
  source_url: string;
  status: "completed" | "skipped" | "retrying" | "failed";
  extraction_status?: "success" | "failed";
  extraction_method?: string;
  error?: string;
};

type WorkerResult = {
  success: boolean;
  selected: number;
  completed: number;
  skipped: number;
  retried: number;
  failed: number;
  message?: string;
  results?: WorkerItemResult[];
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function CatalogImportPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [inputMode, setInputMode] = useState<InputMode>("paste");
  const [name, setName] = useState("Royal Road Catalog Import");
  const [urls, setUrls] = useState(EXAMPLE_URLS);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrlCount, setFileUrlCount] = useState<number | null>(null);

  const [creatingJob, setCreatingJob] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");

  const [batchSize, setBatchSize] = useState(3);
  const [processingBatch, setProcessingBatch] = useState(false);
  const [workerResult, setWorkerResult] = useState<WorkerResult | null>(null);
  const [workerError, setWorkerError] = useState("");

  async function inspectFile(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("The file must be 5 MB or smaller.");
    }

    const allowedExtensions = [".txt", ".csv"];
    const lowerName = file.name.toLowerCase();

    if (!allowedExtensions.some((extension) => lowerName.endsWith(extension))) {
      throw new Error("Only .txt and .csv files are supported.");
    }

    const text = await file.text();

    const likelyUrls = text
      .split(/\r?\n/)
      .flatMap((line) => line.split(","))
      .map((value) => value.trim().replace(/^["']|["']$/g, ""))
      .filter((value) => /^https?:\/\//i.test(value));

    setFileUrlCount(likelyUrls.length);
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] ?? null;

    setSelectedFile(null);
    setFileUrlCount(null);
    setImportError("");
    setImportResult(null);

    if (!file) return;

    try {
      await inspectFile(file);
      setSelectedFile(file);

      if (
        !name.trim() ||
        name === "Royal Road Catalog Import" ||
        name === "Catalog File Import"
      ) {
        setName(file.name.replace(/\.(csv|txt)$/i, ""));
      }
    } catch (error: unknown) {
      event.target.value = "";

      setImportError(
        error instanceof Error ? error.message : "Could not read the file."
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setCreatingJob(true);
    setImportResult(null);
    setImportError("");

    try {
      let response: Response;

      if (inputMode === "file") {
        if (!selectedFile) {
          throw new Error("Choose a CSV or TXT file first.");
        }

        const formData = new FormData();
        formData.append("name", name);
        formData.append("file", selectedFile);

        response = await fetch("/api/admin/catalog-import", {
          method: "POST",
          body: formData,
        });
      } else {
        if (!urls.trim()) {
          throw new Error("Paste at least one URL.");
        }

        response = await fetch("/api/admin/catalog-import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            urls,
          }),
        });
      }

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const text = await response.text();

        throw new Error(
          text.includes("/login")
            ? "Your admin session was not recognized. Refresh and sign in again."
            : "The catalog importer returned an unexpected response."
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Catalog import failed.");
      }

      setImportResult(data as ImportResult);
    } catch (caughtError: unknown) {
      setImportError(
        caughtError instanceof Error
          ? caughtError.message
          : "Catalog import failed."
      );
    } finally {
      setCreatingJob(false);
    }
  }

  async function handleProcessBatch() {
    setProcessingBatch(true);
    setWorkerResult(null);
    setWorkerError("");

    try {
      const response = await fetch("/api/admin/catalog-worker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batch_size: batchSize,
          job_id: importResult?.job_id,
        }),
      });

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const text = await response.text();

        throw new Error(
          text.includes("/login")
            ? "Your admin session was not recognized. Refresh and sign in again."
            : "The worker returned an unexpected response."
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Batch processing failed.");
      }

      setWorkerResult(data as WorkerResult);
    } catch (caughtError: unknown) {
      setWorkerError(
        caughtError instanceof Error
          ? caughtError.message
          : "Batch processing failed."
      );
    } finally {
      setProcessingBatch(false);
    }
  }

  function switchMode(mode: InputMode) {
    setInputMode(mode);
    setImportResult(null);
    setImportError("");

    if (mode === "file" && name === "Royal Road Catalog Import") {
      setName("Catalog File Import");
    }

    if (mode === "paste" && name === "Catalog File Import") {
      setName("Royal Road Catalog Import");
    }
  }

  function clearFile() {
    setSelectedFile(null);
    setFileUrlCount(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
            Admin Tool
          </p>

          <h1 className="mt-1 text-3xl font-bold text-white">
            Catalog Import
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
            Create persistent catalog jobs from pasted URLs or CSV and TXT
            files, then process them through the source-specific metadata
            parsers.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/catalog-jobs"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Catalog Jobs
          </Link>

          <Link
            href="/admin/imports"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Approval Queue
          </Link>

          <Link
            href="/admin/url-import"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Single URL Tool
          </Link>

          <Link
            href="/library"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-indigo-500 hover:text-white"
          >
            Library
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">
            Step 1
          </p>

          <h2 className="mt-1 text-xl font-semibold text-white">
            Create a catalog job
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Paste URLs directly or upload a CSV or TXT file containing novel
            listing URLs.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            onClick={() => switchMode("paste")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              inputMode === "paste"
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Paste URLs
          </button>

          <button
            type="button"
            onClick={() => switchMode("file")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              inputMode === "file"
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Upload CSV / TXT
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-200">
              Import job name
            </span>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={120}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
              placeholder="Royal Road initial catalog"
            />
          </label>

          {inputMode === "paste" ? (
            <label className="mt-5 block text-sm">
              <span className="mb-1 block font-medium text-gray-200">
                Novel URLs
              </span>

              <span className="mb-2 block text-xs text-gray-500">
                Paste one URL per line. Duplicate and invalid URLs will be
                skipped.
              </span>

              <textarea
                value={urls}
                onChange={(event) => setUrls(event.target.value)}
                rows={16}
                required
                className="w-full rounded-md border border-gray-700 bg-gray-900 p-3 font-mono text-xs leading-relaxed text-gray-100"
              />
            </label>
          ) : (
            <div className="mt-5">
              <p className="mb-1 text-sm font-medium text-gray-200">
                Catalog file
              </p>

              <p className="mb-3 text-xs leading-relaxed text-gray-500">
                Supports TXT files with one URL per line and CSV files
                containing URLs in any column. Maximum file size: 5 MB.
              </p>

              <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500"
                />

                {selectedFile && (
                  <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {selectedFile.name}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                          {fileUrlCount !== null
                            ? ` · approximately ${fileUrlCount.toLocaleString()} URL entries found`
                            : ""}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={clearFile}
                        className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:border-red-400 hover:text-white"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Example CSV
                </p>

                <pre className="mt-2 overflow-auto text-xs leading-relaxed text-gray-400">
{`source_url
https://example.com/novel/1
https://example.com/novel/2`}
                </pre>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={
              creatingJob ||
              (inputMode === "file" && !selectedFile) ||
              (inputMode === "paste" && !urls.trim())
            }
            className="mt-5 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creatingJob ? "Creating catalog job..." : "Create Catalog Job"}
          </button>
        </form>

        {importError && (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-200">{importError}</p>
          </div>
        )}

        {importResult && (
          <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="font-semibold text-emerald-200">
              Catalog job #{importResult.job_id} created
            </p>

            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
              <Stat label="Submitted" value={importResult.submitted} />
              <Stat label="Queued" value={importResult.queued} />
              <Stat label="Skipped" value={importResult.skipped} />
              <Stat label="Invalid" value={importResult.invalid} />
            </div>

            <p className="mt-3 text-xs text-emerald-100/70">
              The URLs are stored in the crawl queue and are ready to be
              processed.
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">
            Step 2
          </p>

          <h2 className="mt-1 text-xl font-semibold text-white">
            Process a metadata batch
          </h2>

          <p className="mt-1 text-sm leading-relaxed text-gray-400">
            The worker fetches pending URLs, runs the appropriate parser, and
            sends extracted novels into the approval queue.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-200">
              Batch size
            </span>

            <input
              type="number"
              min={1}
              max={25}
              value={batchSize}
              onChange={(event) => {
                const nextValue = Number(event.target.value);

                setBatchSize(
                  Number.isFinite(nextValue)
                    ? Math.max(1, Math.min(25, Math.floor(nextValue)))
                    : 1
                );
              }}
              className="w-28 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
            />
          </label>

          <button
            type="button"
            onClick={handleProcessBatch}
            disabled={processingBatch}
            className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processingBatch ? "Processing batch..." : "Process Batch"}
          </button>

          {importResult ? (
            <p className="pb-2 text-xs text-gray-500">
              Processing catalog job #{importResult.job_id}
            </p>
          ) : (
            <p className="pb-2 text-xs text-gray-500">
              The worker will process the oldest pending URLs from any catalog
              job.
            </p>
          )}
        </div>

        {workerError && (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-200">{workerError}</p>
          </div>
        )}

        {workerResult && (
          <div className="mt-5 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
            <p className="font-semibold text-sky-200">
              Batch processing finished
            </p>

            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-5">
              <Stat label="Selected" value={workerResult.selected} />
              <Stat label="Completed" value={workerResult.completed} />
              <Stat label="Skipped" value={workerResult.skipped} />
              <Stat label="Retrying" value={workerResult.retried} />
              <Stat label="Failed" value={workerResult.failed} />
            </div>

            {workerResult.message && (
              <p className="mt-3 text-sm text-sky-100/80">
                {workerResult.message}
              </p>
            )}

            {workerResult.results && workerResult.results.length > 0 && (
              <div className="mt-4 space-y-2">
                {workerResult.results.map((item) => (
                  <div
                    key={item.crawl_queue_id}
                    className="rounded-lg border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 break-all text-xs text-gray-300">
                        {item.source_url}
                      </p>

                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                          item.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-200"
                            : item.status === "skipped"
                              ? "bg-yellow-500/15 text-yellow-200"
                              : item.status === "retrying"
                                ? "bg-sky-500/15 text-sky-200"
                                : "bg-red-500/15 text-red-200"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500">
                      {item.extraction_status && (
                        <span>Extraction: {item.extraction_status}</span>
                      )}

                      {item.extraction_method && (
                        <span>Parser: {item.extraction_method}</span>
                      )}
                    </div>

                    {item.error && (
                      <p className="mt-2 text-xs text-red-300">{item.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {workerResult.completed > 0 && (
              <Link
                href="/admin/imports"
                className="mt-4 inline-flex rounded-md border border-sky-400/30 px-4 py-2 text-sm font-semibold text-sky-100 hover:border-sky-300 hover:text-white"
              >
                Review Extracted Novels
              </Link>
            )}
          </div>
        )}
      </section>
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
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}