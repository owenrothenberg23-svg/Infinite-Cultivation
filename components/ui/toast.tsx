"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  durationMs: number;
};

type ToastContextValue = {
  push: (type: ToastType, message: string, durationMs?: number) => void;
  remove: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string, durationMs = 2800) => {
      const id = uid();
      const item: ToastItem = { id, type, message, durationMs };
      setToasts((prev) => [...prev, item]);

      window.setTimeout(() => remove(id), durationMs);
    },
    [remove]
  );

  const value = useMemo(() => ({ push, remove }), [push, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast stack */}
      <div className="fixed right-4 top-4 z-[9999] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "rounded-xl border px-4 py-3 shadow-lg backdrop-blur",
              "bg-black/70 border-white/10 text-gray-100",
              t.type === "success" ? "ring-1 ring-emerald-500/40" : "",
              t.type === "error" ? "ring-1 ring-red-500/40" : "",
              t.type === "info" ? "ring-1 ring-indigo-500/40" : "",
            ].join(" ")}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm leading-snug">{t.message}</div>
              <button
                onClick={() => remove(t.id)}
                className="text-xs text-gray-300 hover:text-white"
                aria-label="Dismiss notification"
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider />");
  }

  return {
    success: (message: string, durationMs?: number) => ctx.push("success", message, durationMs),
    error: (message: string, durationMs?: number) => ctx.push("error", message, durationMs),
    info: (message: string, durationMs?: number) => ctx.push("info", message, durationMs),
  };
}
