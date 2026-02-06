// components/animations/QiLoader.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type QiLoaderProps = {
  active: boolean;
  // optional: show a bar under the circle
  showProgress?: boolean;
};

export default function QiLoader({ active, showProgress = true }: QiLoaderProps) {
  const [progress, setProgress] = useState(0);

  // Random-ish message rotation makes 30s feel intentional
  const messages = useMemo(
    () => [
      "Gathering qi…",
      "Aligning meridians…",
      "Consulting the Heavenly Dao…",
      "Tempering the draft…",
      "Condensing a new chapter…",
    ],
    []
  );
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      setMsgIndex(0);
      return;
    }

    // Progress behavior:
    // - quickly to ~60%
    // - slow to ~90%
    // - then creep but never hits 100% until request finishes
    let p = 0;
    setProgress(0);

    const progressTimer = window.setInterval(() => {
      setProgress((curr) => {
        let next = curr;

        if (curr < 60) next = curr + 2.2; // fast early
        else if (curr < 90) next = curr + 0.6; // slow mid
        else next = curr + 0.12; // creep end

        // cap at 96 until finished
        return Math.min(96, next);
      });
    }, 180);

    const msgTimer = window.setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 2800);

    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(msgTimer);
    };
  }, [active, messages.length]);

  if (!active) return null;

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Swirling qi circle */}
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border border-white/15" />
        <div className="absolute inset-0 rounded-full border-t border-white/60 animate-spin" />
        <div className="absolute inset-2 rounded-full border border-white/10" />
        <div className="absolute inset-2 rounded-full border-r border-white/50 animate-[spin_1.6s_linear_infinite]" />
        <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-md" />
      </div>

      {/* Status text */}
      <div className="text-xs text-gray-300 tracking-wide" aria-live="polite">
        {messages[msgIndex]}
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div className="w-full max-w-xs">
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500/80 transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-gray-400 text-center">
            {Math.floor(progress)}%
          </div>
        </div>
      )}
    </div>
  );
}
