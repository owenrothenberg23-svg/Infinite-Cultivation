"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppMode = "reader" | "author";

type ModeCtx = {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  toggleMode: () => void;
};

const ModeContext = createContext<ModeCtx | null>(null);
const STORAGE_KEY = "ic_mode";

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("reader");

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v === "reader" || v === "author") setModeState(v);
    } catch {}
  }, []);

  const setMode = (m: AppMode) => {
    setModeState(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {}
    // optional cookie (helpful later if you want server components to read it)
    try {
      document.cookie = `ic_mode=${m}; path=/; max-age=31536000`;
    } catch {}
  };

  const toggleMode = () => setMode(mode === "reader" ? "author" : "reader");

  const value = useMemo(() => ({ mode, setMode, toggleMode }), [mode]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within <ModeProvider>");
  return ctx;
}