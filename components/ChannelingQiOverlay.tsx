// components/ChannelingQiOverlay.tsx
"use client";

type ChannelingQiOverlayProps = {
  visible: boolean;
  label?: string;
  sublabel?: string;
};

export function ChannelingQiOverlay({
  visible,
  label = "Channeling Qi…",
  sublabel = "The Dao is weaving your next chapter.",
}: ChannelingQiOverlayProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-indigo-500/70 bg-slate-950/95 px-6 py-6 shadow-[0_0_40px_rgba(79,70,229,0.9)]">
        {/* subtle aura glows */}
        <div className="pointer-events-none absolute -left-6 -top-6 h-20 w-20 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-4 bottom-0 h-16 w-16 rounded-full bg-violet-500/30 blur-2xl" />

        {/* header */}
        <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">
          Heavenly Forge
        </p>
        <h2 className="mt-2 text-xl font-bold text-white">{label}</h2>
        <p className="mt-1 text-sm text-gray-300">{sublabel}</p>

        {/* spinner / “core” */}
        <div className="mt-5 flex items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border border-indigo-400/60" />
            <div className="absolute inset-1 rounded-full border-t-transparent border-2 border-indigo-300/80 animate-spin" />
            <div className="absolute inset-3 rounded-full bg-indigo-500/60 blur-[2px]" />
          </div>
          <div className="flex flex-col text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 animate-ping rounded-full bg-indigo-300" />
              Condensing narrative Qi…
            </span>
            <span>Do not refresh or close this page.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
