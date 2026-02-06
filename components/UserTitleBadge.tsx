// components/UserTitleBadge.tsx
"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type ActiveTitle = {
  label: string | null;
  rank: string | null;
};

const rankClassMap: Record<string, string> = {
  common:
    "border-gray-600 text-gray-300 bg-gray-900/40 shadow-[0_0_12px_rgba(148,163,184,0.45)]",
  rare:
    "border-blue-500 text-blue-300 bg-blue-900/30 shadow-[0_0_14px_rgba(59,130,246,0.75)]",
  epic:
    "border-purple-500 text-purple-300 bg-purple-900/30 shadow-[0_0_16px_rgba(168,85,247,0.85)]",
  legendary:
    "border-yellow-400 text-yellow-300 bg-yellow-900/30 shadow-[0_0_18px_rgba(234,179,8,0.90)]",
  mythical:
    "border-red-500 text-red-300 bg-red-900/30 shadow-[0_0_20px_rgba(248,113,113,1)]",
};

export function UserTitleBadge() {
  const sb = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [activeTitle, setActiveTitle] = useState<ActiveTitle | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        // 1) Get current session
        const { data: sessionData } = await sb.auth.getSession();
        const user = sessionData.session?.user;
        if (!user || cancelled) {
          setLoading(false);
          return;
        }

        // 2) Find the user's active title_id
        const { data: userTitleRow, error: utErr } = await sb
          .from("user_titles")
          .select("title_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (utErr || !userTitleRow?.title_id || cancelled) {
          setLoading(false);
          return;
        }

        // 3) Load the title details
        const { data: titleRow, error: tErr } = await sb
          .from("titles")
          .select("label, rank")
          .eq("id", userTitleRow.title_id)
          .maybeSingle();

        if (!cancelled && !tErr && titleRow) {
          setActiveTitle({
            label: titleRow.label,
            rank: titleRow.rank,
          });
        }
      } catch (err) {
        console.error("UserTitleBadge: error loading active title", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sb]);

  if (loading || !activeTitle?.label) {
    return null;
  }

  const rankKey = (activeTitle.rank ?? "common").toLowerCase();
  const rankClasses =
    rankClassMap[rankKey] ?? rankClassMap["common"];

  return (
    <span
      className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${rankClasses}`}
    >
      {activeTitle.label}
    </span>
  );
}
