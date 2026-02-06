"use client";

import { useEffect } from "react";

export type TitleRank = "common" | "rare" | "epic" | "legendary" | "mythical";

type Props = {
  title: string;
  rank: TitleRank;
  onClose: () => void;
};

const rankAura: Record<TitleRank, { glow: string; colorText: string }> = {
  common: {
    glow: "shadow-[0_0_20px_rgba(148,163,184,0.5)]",
    colorText: "text-gray-300",
  },
  rare: {
    glow: "shadow-[0_0_28px_rgba(59,130,246,0.8)]",
    colorText: "text-blue-300",
  },
  epic: {
    glow: "shadow-[0_0_30px_rgba(168,85,247,0.85)]",
    colorText: "text-purple-300",
  },
  legendary: {
    glow: "shadow-[0_0_38px_rgba(234,179,8,0.9)]",
    colorText: "text-yellow-300",
  },
  mythical: {
    glow: "shadow-[0_0_45px_rgba(248,113,113,1)]",
    colorText: "text-red-300",
  },
};

export default function TitleUnlockToast({ title, rank, onClose }: Props) {
  // auto-hide
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);

  const aura = rankAura[rank];

  return (
    <div className="fixed top-4 inset-x-0 z-[500] flex justify-center pointer-events-none">
      <div
        className={`pointer-events-auto flex items-center gap-3 rounded-xl border border-white/20 bg-black/70 backdrop-blur-lg px-5 py-3 text-sm shadow-xl ${aura.glow}`}
      >
        <span className={`font-semibold ${aura.colorText}`}>
          ✦ Title Unlocked:
        </span>
        <span className="text-gray-200 font-medium">{title}</span>
      </div>
    </div>
  );
}
