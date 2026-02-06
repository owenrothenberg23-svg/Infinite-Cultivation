// app/titles/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { unlockTitleForUser } from "@/lib/unlockTitle";

type TitleRank = "common" | "rare" | "epic" | "legendary" | "mythical";

type TitleRow = {
  id: string;
  slug: string | null;
  label: string | null;
  description: string | null;
  sort_order: number | null;
  rank: string | null;
};

type UserTitleRow = {
  id: string;
  title_id: string;
  is_active: boolean | null;
};

const rankStyles: Record<
  TitleRank,
  { label: string; className: string; auraClass: string; blurb: string }
> = {
  common: {
    label: "Common",
    className: "text-gray-300 bg-gray-900/60 border border-gray-700",
    auraClass: "shadow-[0_0_18px_rgba(148,163,184,0.50)]",
    blurb: "Basic acknowledgements of your path.",
  },
  rare: {
    label: "Rare",
    className: "text-blue-300 bg-blue-900/40 border border-blue-700",
    auraClass: "shadow-[0_0_22px_rgba(59,130,246,0.75)]",
    blurb: "Notable feats that few mortals achieve.",
  },
  epic: {
    label: "Epic",
    className: "text-purple-300 bg-purple-900/40 border border-purple-700",
    auraClass: "shadow-[0_0_26px_rgba(168,85,247,0.85)]",
    blurb: "Marks of cultivators who shake a region.",
  },
  legendary: {
    label: "Legendary",
    className: "text-yellow-300 bg-yellow-900/40 border border-yellow-600",
    auraClass: "shadow-[0_0_30px_rgba(234,179,8,0.9)]",
    blurb: "Names that echo through the cultivation world.",
  },
  mythical: {
    label: "Mythical",
    className: "text-red-300 bg-red-900/40 border border-red-700",
    auraClass: "shadow-[0_0_34px_rgba(248,113,113,1)]",
    blurb: "Ancient beings spoken of in hushed legends.",
  },
};

// Spirit Stone → Wealth Title unlock mapping
const wealthThresholds = [
  { slug: "wealth-touched-mortal", needed: 50 },
  { slug: "wealth-forging-cultivator", needed: 100 },
  { slug: "silk-pants-young-master", needed: 300 },
  { slug: "ever-wealthy-never-paying-sage", needed: 1000 },
];

const FUTURE_PLACEHOLDER_COUNT = 30;

export default function TitlesPage() {
  const router = useRouter();
  const sb = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [activeTitleId, setActiveTitleId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [unlockedTitleIds, setUnlockedTitleIds] = useState<Set<string>>(
    () => new Set()
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [totalStonesEarned, setTotalStonesEarned] = useState(0);

  const [autoUnlockRan, setAutoUnlockRan] = useState(false);
  const [newlyUnlockedTitleLabel, setNewlyUnlockedTitleLabel] =
    useState<string | null>(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      const { data: sessionData } = await sb.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const uid = session.user.id;
      if (!cancelled) setUserId(uid);

      // Titles
      const { data: titlesData } = await sb
        .from("titles")
        .select("id, slug, label, description, sort_order, rank")
        .order("sort_order", { ascending: true });

      // User title rows
      const { data: userTitles } = await sb
        .from("user_titles")
        .select("id, title_id, is_active")
        .eq("user_id", uid);

      // Profile for balance tracking
      const { data: profile } = await sb
        .from("profiles")
        .select("total_spirit_stones_earned")
        .eq("id", uid)
        .maybeSingle();

      const unlockedSet = new Set<string>();
      let activeId: string | null = null;
      for (const row of (userTitles ?? []) as UserTitleRow[]) {
        unlockedSet.add(row.title_id);
        if (row.is_active) activeId = row.title_id;
      }

      if (!cancelled) {
        setTitles(titlesData ?? []);
        setUnlockedTitleIds(unlockedSet);
        setActiveTitleId(activeId);
        setTotalStonesEarned(profile?.total_spirit_stones_earned ?? 0);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, sb]);

  // Auto-unlock base titles + wealth titles
  useEffect(() => {
    if (
      !userId ||
      loading ||
      autoUnlockRan ||
      titles.length === 0
    )
      return;

    let cancelled = false;

    const run = async () => {
      try {
        // Awakened Soul
        const awakened = titles.find((t) => t.slug === "awakened-soul");
        if (awakened && !unlockedTitleIds.has(awakened.id)) {
          const res = await unlockTitleForUser(sb as any, userId, "awakened-soul");
          if (res.ok && (res as any).newlyUnlocked && !cancelled) {
            setUnlockedTitleIds((p) => new Set(p).add(awakened.id));
            setNewlyUnlockedTitleLabel(awakened.label ?? "Awakened Soul");
          }
        }

        // Primeval (First 100)
        const primeval = titles.find((t) => t.slug === "primeval-dao-being");
        if (primeval && !unlockedTitleIds.has(primeval.id)) {
          const { data: firstHundred } = await sb
            .from("profiles")
            .select("id")
            .order("created_at", { ascending: true })
            .limit(100);

          if (firstHundred?.some((p: any) => p.id === userId)) {
            const res = await unlockTitleForUser(sb as any, userId, "primeval-dao-being");
            if (res.ok && (res as any).newlyUnlocked && !cancelled) {
              setUnlockedTitleIds((p) => new Set(p).add(primeval.id));
              setNewlyUnlockedTitleLabel(primeval.label ?? "Primeval Dao Being");
            }
          }
        }

        // Wealth titles
        for (const { slug, needed } of wealthThresholds) {
          if (totalStonesEarned >= needed) {
            const t = titles.find((x) => x.slug === slug);
            if (t && !unlockedTitleIds.has(t.id)) {
              const res = await unlockTitleForUser(sb as any, userId, slug);
              if (res.ok && (res as any).newlyUnlocked && !cancelled) {
                setUnlockedTitleIds((p) => new Set(p).add(t.id));
                setNewlyUnlockedTitleLabel(t.label ?? slug);
              }
            }
          }
        }
      } finally {
        if (!cancelled) setAutoUnlockRan(true);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    userId,
    loading,
    autoUnlockRan,
    titles,
    unlockedTitleIds,
    sb,
    totalStonesEarned,
  ]);

  async function handleSelect(titleId: string) {
    setSavingId(titleId);
    const { data: sessionData } = await sb.auth.getSession();
    const session = sessionData.session;
    if (!session) return router.replace("/login");
    await sb.from("user_titles").update({ is_active: false }).eq("user_id", session.user.id);
    const { data: existing } = await sb
      .from("user_titles")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("title_id", titleId)
      .maybeSingle();
    if (existing)
      await sb.from("user_titles").update({ is_active: true }).eq("id", existing.id);
    else
      await sb.from("user_titles").insert({
        user_id: session.user.id,
        title_id: titleId,
        is_active: true,
      });

    setActiveTitleId(titleId);
    setSavingId(null);
  }

  return (
    <main className="max-w-4xl mx-auto p-8 text-gray-200">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Titles</h1>
        <p className="text-sm text-gray-400">
          Titles appear next to your name across the site and signal your status in the cultivation world.
        </p>
      </header>

      {errorMsg && (
        <div className="mb-4 rounded-md bg-red-900/60 border border-red-500 px-4 py-2 text-sm">
          {errorMsg}
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Your unlocked titles</h2>
        <p className="mb-3 text-xs text-gray-500">
          Visible titles glow with their rank’s aura. Locked ones appear faded until you meet their conditions.
        </p>

        {loading ? (
          <p className="text-sm text-gray-400">Loading titles…</p>
        ) : titles.length === 0 ? (
          <p className="text-sm text-gray-400">No titles available yet.</p>
        ) : (
          <ul className="space-y-3">
            {titles.map((t) => {
              const isActive = t.id === activeTitleId;
              const isUnlocked = unlockedTitleIds.has(t.id);
              const dbRank = (t.rank ?? "common").toLowerCase() as TitleRank;
              const rankStyle = rankStyles[dbRank in rankStyles ? dbRank : "common"];
              const cardClasses = !isUnlocked
                ? "border-gray-800 bg-gray-900/40 opacity-45"
                : isActive
                ? "border-indigo-400/80 bg-slate-900/60 " + rankStyle.auraClass
                : "border-gray-700 bg-slate-900/60";

              return (
                <li key={t.id} className={`flex items-start justify-between rounded-md border px-4 py-3 text-sm ${cardClasses}`}>
                  <div>
                    <div className="font-medium text-white flex items-center gap-2">
                      <span>{t.label}</span>
                      {!isUnlocked && (
                        <span className="rounded-full border border-gray-600/80 bg-gray-900/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-400">
                          Locked
                        </span>
                      )}
                      {isActive && (
                        <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300">
                          Active
                        </span>
                      )}
                    </div>
                    <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${rankStyle.className}`}>
                      {rankStyle.label}
                    </span>
                    {t.description && (
                      <p className="mt-2 text-xs text-gray-400">{t.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSelect(t.id)}
                    disabled={!isUnlocked || isActive}
                    className="ml-3 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-400"
                  >
                    {isActive ? "Selected" : "Use title"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Title ranks</h2>
        <p className="mb-3 text-xs text-gray-500">
          Higher-rank titles are harder to obtain and have stronger visual auras.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(rankStyles) as TitleRank[]).map((r) => (
            <div key={r} className={`rounded-lg px-3 py-2 text-xs ${rankStyles[r].className}`}>
              <div className="font-semibold mb-1">{rankStyles[r].label}</div>
              <p className="text-[11px] text-gray-200/80">{rankStyles[r].blurb}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Future titles</h2>
        <p className="mb-3 text-xs text-gray-500">These hint at upcoming events and achievements.</p>
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: FUTURE_PLACEHOLDER_COUNT }).map((_, idx) => (
            <div key={idx} className="flex flex-col items-center justify-center rounded-md border border-dashed border-gray-700 bg-slate-950/80 px-3 py-4 text-center text-xs text-gray-500">
              <div className="mb-2 h-6 w-24 rounded-full border border-gray-800 bg-gradient-to-r from-slate-800/60 to-slate-900/80" />
              <p className="font-medium text-gray-400">Locked Title</p>
            </div>
          ))}
        </div>
      </section>

      {newlyUnlockedTitleLabel && (
        <div className="fixed bottom-4 right-4 z-40 max-w-xs rounded-md border border-amber-400/70 bg-slate-900/95 px-4 py-3 text-xs shadow-lg">
          <p className="font-semibold text-amber-300">Title unlocked!</p>
          <p className="mt-1 text-gray-100">{newlyUnlockedTitleLabel}</p>
          <button
            type="button"
            onClick={() => setNewlyUnlockedTitleLabel(null)}
            className="mt-2 text-[11px] text-gray-400 hover:text-gray-200"
          >
            Close
          </button>
        </div>
      )}
    </main>
  );
}
