"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type WorkerResult = {
  success: boolean;
  selected: number;
  completed: number;
  skipped: number;
  retried: number;
  failed: number;
  pending_remaining?: number;
  ready_remaining?: number;
  waiting_for_retry?: boolean;
  has_ready_work?: boolean;
  message?: string;
};

type AutoTotals = {
  batches: number;
  selected: number;
  completed: number;
  skipped: number;
  retried: number;
  failed: number;
};

const EMPTY_TOTALS: AutoTotals = {
  batches: 0,
  selected: 0,
  completed: 0,
  skipped: 0,
  retried: 0,
  failed: 0,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function CatalogJobControls({
  jobId,
  pendingCount,
}: {
  jobId: number;
  pendingCount: number;
}) {
  const router = useRouter();
  const stopRequestedRef = useRef(false);

  const [batchSize, setBatchSize] = useState(
    Math.min(Math.max(pendingCount, 1), 25)
  );

  const [loading, setLoading] = useState(false);
  const [autoProcessing, setAutoProcessing] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [autoTotals, setAutoTotals] =
    useState<AutoTotals>(EMPTY_TOTALS);

  const [remainingPending, setRemainingPending] =
    useState<number | null>(null);

  const [remainingReady, setRemainingReady] =
    useState<number | null>(null);

  const [waitingForRetry, setWaitingForRetry] =
    useState(false);

  async function runWorkerBatch(): Promise<WorkerResult> {
    const response = await fetch(
      "/api/admin/catalog-worker",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: jobId,
          batch_size: batchSize,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Batch processing failed."
      );
    }

    return data as WorkerResult;
  }

  function applyWorkerState(result: WorkerResult) {
    setRemainingPending(
      typeof result.pending_remaining === "number"
        ? result.pending_remaining
        : null
    );

    setRemainingReady(
      typeof result.ready_remaining === "number"
        ? result.ready_remaining
        : null
    );

    setWaitingForRetry(
      Boolean(result.waiting_for_retry)
    );
  }

  async function processBatch() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const result = await runWorkerBatch();

      applyWorkerState(result);

      setMessage(
        [
          `Selected ${result.selected}`,
          `completed ${result.completed}`,
          `skipped ${result.skipped}`,
          `retrying ${result.retried}`,
          `failed ${result.failed}`,
        ].join(", ")
      );

      router.refresh();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Batch processing failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function startAutoProcessing() {
    if (autoProcessing || loading) return;

    stopRequestedRef.current = false;

    setAutoProcessing(true);
    setMessage("");
    setError("");
    setRemainingPending(null);
    setRemainingReady(null);
    setWaitingForRetry(false);
    setAutoTotals(EMPTY_TOTALS);

    let totals: AutoTotals = { ...EMPTY_TOTALS };
    let finalResult: WorkerResult | null = null;

    try {
      while (!stopRequestedRef.current) {
        const result = await runWorkerBatch();
        finalResult = result;

        applyWorkerState(result);

        totals = {
          batches: totals.batches + 1,
          selected: totals.selected + result.selected,
          completed: totals.completed + result.completed,
          skipped: totals.skipped + result.skipped,
          retried: totals.retried + result.retried,
          failed: totals.failed + result.failed,
        };

        setAutoTotals(totals);

        setMessage(
          [
            `Auto batches ${totals.batches}`,
            `completed ${totals.completed}`,
            `skipped ${totals.skipped}`,
            `retrying ${totals.retried}`,
            `failed ${totals.failed}`,
          ].join(", ")
        );

        router.refresh();

        if (result.selected === 0) {
          break;
        }

        if (result.waiting_for_retry) {
          break;
        }

        if (result.has_ready_work === false) {
          break;
        }

        await sleep(750);
      }

      if (stopRequestedRef.current) {
        setMessage(
          [
            `Stopped after ${totals.batches} batches`,
            `completed ${totals.completed}`,
            `skipped ${totals.skipped}`,
            `retrying ${totals.retried}`,
            `failed ${totals.failed}`,
          ].join(", ")
        );
      } else if (finalResult?.waiting_for_retry) {
        setMessage(
          [
            "Auto processing paused for retry windows",
            `completed ${totals.completed}`,
            `retrying ${totals.retried}`,
            `failed ${totals.failed}`,
          ].join(", ")
        );
      } else {
        setMessage(
          [
            "Auto processing finished",
            `completed ${totals.completed}`,
            `skipped ${totals.skipped}`,
            `retrying ${totals.retried}`,
            `failed ${totals.failed}`,
          ].join(", ")
        );
      }
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Auto processing failed."
      );
    } finally {
      setAutoProcessing(false);
      router.refresh();
    }
  }

  function stopAutoProcessing() {
    stopRequestedRef.current = true;
  }

  const controlsDisabled = loading || autoProcessing;

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-gray-300">
            Batch size
          </span>

          <input
            type="number"
            min={1}
            max={25}
            value={batchSize}
            disabled={
              controlsDisabled || pendingCount === 0
            }
            onChange={(event) => {
              const value = Number(event.target.value);

              setBatchSize(
                Number.isFinite(value)
                  ? Math.max(
                      1,
                      Math.min(
                        25,
                        Math.floor(value)
                      )
                    )
                  : 1
              );
            }}
            className="w-24 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 disabled:opacity-50"
          />
        </label>

        <button
          type="button"
          onClick={processBatch}
          disabled={
            controlsDisabled || pendingCount === 0
          }
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Processing..."
            : pendingCount > 0
              ? "Process One Batch"
              : "Job Finished"}
        </button>

        {!autoProcessing ? (
          <button
            type="button"
            onClick={startAutoProcessing}
            disabled={loading || pendingCount === 0}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Auto Processing
          </button>
        ) : (
          <button
            type="button"
            onClick={stopAutoProcessing}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            Stop After Current Batch
          </button>
        )}
      </div>

      {autoProcessing && (
        <div className="mt-4 rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3">
          <p className="text-sm font-medium text-indigo-100">
            Auto processing is running.
          </p>

          <div className="mt-2 grid gap-2 text-xs text-gray-300 sm:grid-cols-3">
            <span>
              Batches this run: {autoTotals.batches}
            </span>

            <span>
              Completed this run: {autoTotals.completed}
            </span>

            <span>
              Failed this run: {autoTotals.failed}
            </span>
          </div>
        </div>
      )}

      {(remainingPending !== null ||
        remainingReady !== null ||
        waitingForRetry) && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
          {remainingPending !== null && (
            <span>
              Pending remaining: {remainingPending}
            </span>
          )}

          {remainingReady !== null && (
            <span>
              Ready now: {remainingReady}
            </span>
          )}

          {waitingForRetry && (
            <span className="text-yellow-300">
              Pending rows are waiting for their retry window.
            </span>
          )}
        </div>
      )}

      {message && (
        <p className="mt-3 text-sm text-emerald-300">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}