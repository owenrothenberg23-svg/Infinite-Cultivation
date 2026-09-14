"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type AutoApproveResult = {
  success: boolean;
  requested_approvals?: number;
  scan_limit?: number;
  scanned: number;
  eligible: number;
  auto_approved: number;
  created: number;
  merged?: number;
  needs_review?: number;
  ineligible?: number;
  failed?: number;
  next_after_id?: number | null;
  has_more?: boolean;
  message?: string;
};

type AutoTotals = {
  batches: number;
  scanned: number;
  eligible: number;
  autoApproved: number;
  created: number;
  merged: number;
  needsReview: number;
  ineligible: number;
  failed: number;
};

const EMPTY_TOTALS: AutoTotals = {
  batches: 0,
  scanned: 0,
  eligible: 0,
  autoApproved: 0,
  created: 0,
  merged: 0,
  needsReview: 0,
  ineligible: 0,
  failed: 0,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AutoApproveImports() {
  const router = useRouter();
  const stopRequestedRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [result, setResult] = useState<AutoApproveResult | null>(null);
  const [autoTotals, setAutoTotals] = useState<AutoTotals>(EMPTY_TOTALS);
  const [error, setError] = useState("");

  async function requestBatch(
    limit: number,
    afterId?: number | null
  ) {
    const response = await fetch(
      "/api/admin/auto-approve-imports",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit,
          after_id: afterId ?? null,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Auto approval failed."
      );
    }

    return data as AutoApproveResult;
  }

  async function runBatch(limit: number) {
    if (loading || autoProcessing) return;

    setLoading(true);
    setResult(null);
    setError("");
    setAutoTotals(EMPTY_TOTALS);

    try {
      const data = await requestBatch(limit, null);
      setResult(data);
      router.refresh();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Auto approval failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function startAutoApproval() {
    if (loading || autoProcessing) return;

    stopRequestedRef.current = false;

    setAutoProcessing(true);
    setResult(null);
    setError("");
    setAutoTotals(EMPTY_TOTALS);

    let totals: AutoTotals = { ...EMPTY_TOTALS };
    let cursor: number | null = null;

    try {
      while (!stopRequestedRef.current) {
        const data = await requestBatch(25, cursor);

        totals = {
          batches: totals.batches + 1,
          scanned: totals.scanned + data.scanned,
          eligible: totals.eligible + data.eligible,
          autoApproved:
            totals.autoApproved + data.auto_approved,
          created: totals.created + data.created,
          merged: totals.merged + (data.merged ?? 0),
          needsReview:
            totals.needsReview + (data.needs_review ?? 0),
          ineligible:
            totals.ineligible + (data.ineligible ?? 0),
          failed: totals.failed + (data.failed ?? 0),
        };

        setAutoTotals(totals);
        setResult(data);
        router.refresh();

        if (data.scanned === 0) {
          break;
        }

        cursor =
          typeof data.next_after_id === "number"
            ? data.next_after_id
            : null;

        if (!data.has_more || cursor === null) {
          break;
        }

        await sleep(500);
      }
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Automatic approval failed."
      );
    } finally {
      setAutoProcessing(false);
      router.refresh();
    }
  }

  function stopAutoApproval() {
    stopRequestedRef.current = true;
  }

  return (
    <section className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
            Automated Pipeline
          </p>

          <h2 className="mt-1 text-lg font-semibold text-white">
            Safe Auto Approval
          </h2>

          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Automatically create or merge novels that pass the
            eligibility and duplicate checks. Questionable imports
            stay pending for manual review while the automated pass
            continues beyond them.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || autoProcessing}
            onClick={() => runBatch(5)}
            className="rounded-md border border-emerald-500/30 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Running..." : "Run 5"}
          </button>

          <button
            type="button"
            disabled={loading || autoProcessing}
            onClick={() => runBatch(25)}
            className="rounded-md border border-emerald-500/30 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Running..." : "Run 25"}
          </button>

          {!autoProcessing ? (
            <button
              type="button"
              disabled={loading}
              onClick={startAutoApproval}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Auto Approve Safe Queue
            </button>
          ) : (
            <button
              type="button"
              onClick={stopAutoApproval}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              Stop After Current Batch
            </button>
          )}
        </div>
      </div>

      {autoProcessing && (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-black/20 p-4">
          <p className="text-sm font-semibold text-emerald-200">
            Auto approval is running
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Batches" value={autoTotals.batches} />
            <Stat label="Scanned" value={autoTotals.scanned} />
            <Stat
              label="Auto Approved"
              value={autoTotals.autoApproved}
            />
            <Stat
              label="Needs Review"
              value={
                autoTotals.needsReview +
                autoTotals.ineligible +
                autoTotals.failed
              }
            />
          </div>
        </div>
      )}

      {!autoProcessing && autoTotals.batches > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-emerald-200">
            Automatic pass complete
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Batches" value={autoTotals.batches} />
            <Stat label="Scanned" value={autoTotals.scanned} />
            <Stat label="Eligible" value={autoTotals.eligible} />
            <Stat
              label="Auto Approved"
              value={autoTotals.autoApproved}
            />
            <Stat label="Created" value={autoTotals.created} />
            <Stat label="Merged" value={autoTotals.merged} />
            <Stat
              label="Needs Review"
              value={autoTotals.needsReview}
            />
            <Stat
              label="Ineligible"
              value={autoTotals.ineligible}
            />
            <Stat label="Failed" value={autoTotals.failed} />
          </div>
        </div>
      )}

      {!autoProcessing && result && autoTotals.batches === 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-emerald-200">
            Batch complete
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Scanned" value={result.scanned} />
            <Stat label="Eligible" value={result.eligible} />
            <Stat
              label="Auto Approved"
              value={result.auto_approved}
            />
            <Stat label="Created" value={result.created} />

            {result.merged !== undefined && (
              <Stat label="Merged" value={result.merged} />
            )}

            {result.needs_review !== undefined && (
              <Stat
                label="Needs Review"
                value={result.needs_review}
              />
            )}

            {result.ineligible !== undefined && (
              <Stat
                label="Ineligible"
                value={result.ineligible}
              />
            )}

            {result.failed !== undefined && (
              <Stat label="Failed" value={result.failed} />
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}
    </section>
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
      <p className="mt-1 text-xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}