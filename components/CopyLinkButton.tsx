"use client";

import { useEffect, useState } from "react";

type Props = {
  className?: string;
  label?: string;
};

export default function CopyLinkButton({
  className = "",
  label = "Copy link",
}: Props) {
  const [url, setUrl] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    // Safe client-only access
    setUrl(window.location.href);
  }, []);

  async function copy() {
    try {
      if (!url) return;
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1200);
    } catch (e) {
      console.error("CopyLinkButton copy failed:", e);
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 1500);
    }
  }

  const text =
    status === "copied"
      ? "Copied!"
      : status === "error"
      ? "Couldn’t copy"
      : label;

  return (
    <button
      type="button"
      onClick={copy}
      className={
        "inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-white/10 transition " +
        className
      }
      aria-label="Copy chapter link"
    >
      {text}
    </button>
  );
}
