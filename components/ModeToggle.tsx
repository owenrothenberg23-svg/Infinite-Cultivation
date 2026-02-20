"use client";

import { useMode } from "@/components/ModeProvider";

export default function ModeToggle() {
  const { mode, setMode } = useMode();

  return (
    <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-1 text-xs">
      <button
        type="button"
        onClick={() => setMode("reader")}
        className={`rounded-full px-3 py-1 font-medium transition ${
          mode === "reader"
            ? "bg-indigo-600 text-white"
            : "text-gray-300 hover:text-white"
        }`}
      >
        Reader
      </button>
      <button
        type="button"
        onClick={() => setMode("author")}
        className={`rounded-full px-3 py-1 font-medium transition ${
          mode === "author"
            ? "bg-indigo-600 text-white"
            : "text-gray-300 hover:text-white"
        }`}
      >
        Author
      </button>
    </div>
  );
}