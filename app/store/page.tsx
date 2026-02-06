// app/store/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type ProfileRow = {
  id: string;
  spirit_stones: number | null;
};

type PackTag = "popular" | "value";

type Pack = {
  id: string;
  label: string;
  subtitle: string;
  stones: number;
  bonus: number;
  price: string; // display string, e.g. "$9.99"
  tag?: PackTag;
};

const PACKS: Pack[] = [
  {
    id: "handful",
    label: "Handful of Spirit Stones",
    subtitle: "A small handful to test the Dao of Wealth-touching.",
    stones: 10,
    bonus: 0,
    price: "$2.99",
  },
  {
    // NOTE: id changed from "small-pile" -> "small_pile" to match API / Stripe metadata
    id: "small_pile",
    label: "Small Pile of Spirit Stones",
    subtitle: "Enough stones for a short cultivation session.",
    stones: 20,
    bonus: 0,
    price: "$4.99",
  },
  {
    id: "pouch",
    label: "Pouch of Spirit Stones",
    subtitle: "Enough qi to launch a fresh saga.",
    stones: 50,
    bonus: 0,
    price: "$9.99",
    tag: "popular",
  },
  {
    id: "chest",
    label: "Treasure Chest of Spirit Stones",
    subtitle: "For cultivators who binge-read their own story.",
    stones: 110,
    bonus: 0,
    price: "$19.99",
  },
  {
    id: "vault",
    label: "Immortal’s Spatial Vault",
    subtitle: "A deep reservoir for long arcs and side stories.",
    stones: 300,
    bonus: 0,
    price: "$49.99",
    tag: "value",
  },
];

// helper to estimate price per stone
function pricePerStone(pack: Pack): string {
  const num = parseFloat(pack.price.replace(/[^\d.]/g, ""));
  if (!num || !pack.stones) return "";
  const per = num / pack.stones;
  return `$${per.toFixed(2)} per stone`;
}

export default function StorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sb = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  async function refreshProfileBalance(userId: string) {
    const { data, error: profErr } = await sb
      .from("profiles")
      .select("id, spirit_stones")
      .eq("id", userId)
      .maybeSingle();

    if (profErr) {
      console.error("Store: profile refresh error", profErr);
      throw profErr;
    }

    setProfile({
      id: data?.id ?? userId,
      spirit_stones: data?.spirit_stones ?? 0,
    });
  }

  // Load session + profile for Spirit Stone balance
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: sessionData, error: sessionError } =
          await sb.auth.getSession();

        if (sessionError) {
          console.error("Store: session error", sessionError);
          if (!cancelled) {
            setError("Could not check login.");
            setLoading(false);
          }
          return;
        }

        const session = sessionData.session;
        if (!session) {
          if (!cancelled) {
            router.replace("/login");
          }
          return;
        }

        const userId = session.user.id;

        if (!cancelled) {
          await refreshProfileBalance(userId);
          setLoading(false);
        }
      } catch (e) {
        console.error("Store: fatal load error", e);
        if (!cancelled) {
          setError("Something went wrong loading the Store.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, sb]);

  // Handle Stripe return params & clear stale error
  useEffect(() => {
    // If you came back from Stripe, show a friendly banner and clear old errors.
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled") || searchParams.get("cancelled");

    if (success === "1") {
      setError(null);
      setBanner("✅ Payment complete. If your Spirit Stones don’t update in ~5 seconds, refresh.");
    } else if (canceled === "1") {
      setError(null);
      setBanner("⚠️ Payment canceled.");
    }
  }, [searchParams]);

  // After returning from Stripe, re-fetch balance (webhook may take a moment)
  useEffect(() => {
    let cancelled = false;

    const success = searchParams.get("success");
    if (success !== "1") return;

    (async () => {
      try {
        const { data: sessionData } = await sb.auth.getSession();
        const session = sessionData.session;
        if (!session) return;

        const userId = session.user.id;

        // Try a couple times because webhook crediting can be slightly delayed.
        for (let i = 0; i < 3; i++) {
          if (cancelled) return;
          await refreshProfileBalance(userId);
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch (e) {
        console.error("Store: post-success refresh failed", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, sb]);

  const balance = profile?.spirit_stones ?? 0;

  async function handlePurchase(pack: Pack) {
    setError(null);

    try {
      setPurchasingId(pack.id);

      // include the Supabase access token so the server can know who is logged in
      const { data: sessionData, error: sessionError } =
        await sb.auth.getSession();

      if (sessionError) {
        console.error("Store: session error (purchase)", sessionError);
        setError("Could not verify login.");
        return;
      }

      const session = sessionData.session;
      if (!session) {
        setError("Not logged in.");
        router.replace("/login");
        return;
      }

      const accessToken = session.access_token;

      // Hit our Checkout endpoint, which creates a Stripe Checkout Session
      const res = await fetch("/api/purchase/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ packId: pack.id }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.url) {
        const msg =
          data?.error ||
          `Purchase failed (HTTP ${res.status}) – please try again.`;
        setError(msg);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url as string;
    } catch (e: any) {
      console.error("Store: purchase error", e);
      setError(e?.message || "Could not start purchase.");
    } finally {
      setPurchasingId(null);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 text-gray-200">
      {/* Hero / banner */}
      <section className="relative mb-8 overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-6 sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 -bottom-10 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300">
              Heavenly Treasury
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Spirit Stone Store
            </h1>
            <p className="mt-2 text-sm text-gray-300 max-w-xl">
              Stockpile Spirit Stones to generate chapters, experiment with wild
              arcs, and let your inner author go full young master.
            </p>
          </div>

          <div className="relative mt-2 flex flex-col items-start rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm sm:mt-0 sm:min-w-[220px]">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">
              Current balance
            </p>
            {loading ? (
              <p className="mt-1 text-lg font-semibold text-gray-300">
                Checking…
              </p>
            ) : (
              <p className="mt-1 text-2xl font-semibold text-emerald-300">
                {balance.toLocaleString()}{" "}
                <span className="text-sm font-medium text-emerald-200">
                  Spirit Stones
                </span>
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-500">
              1 Spirit Stone = 1 generated chapter.
            </p>
          </div>
        </div>
      </section>

      {banner && (
        <div className="mb-4 flex items-start justify-between gap-4 rounded-md bg-indigo-900/40 border border-indigo-400/40 px-4 py-2 text-sm">
          <span>{banner}</span>
          <button
            type="button"
            className="text-xs text-indigo-200 hover:text-white"
            onClick={() => setBanner(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start justify-between gap-4 rounded-md bg-red-900/60 border border-red-500 px-4 py-2 text-sm">
          <span>{error}</span>
          <button
            type="button"
            className="text-xs text-red-200 hover:text-white"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Packs */}
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">
              Choose your stash
            </h2>
            <p className="text-xs text-gray-500">
              Larger stashes lower your cost per chapter. All packs are one-time
              purchases.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PACKS.map((pack) => {
            const totalStones = pack.stones + pack.bonus;
            const isBuying = purchasingId === pack.id;
            const approxChapters = totalStones;

            return (
              <article
                key={pack.id}
                className="group relative flex flex-col rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 shadow-sm transition hover:border-indigo-400/80 hover:shadow-[0_0_28px_rgba(79,70,229,0.55)]"
              >
                {/* floating glow */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 group-hover:bg-gradient-to-br from-indigo-500/5 to-purple-500/5 transition" />

                {/* Tag badge */}
                {pack.tag && (
                  <div
                    className={`absolute -top-2 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      pack.tag === "popular"
                        ? "bg-indigo-600 text-white"
                        : "bg-amber-400 text-slate-950"
                    }`}
                  >
                    {pack.tag === "popular" ? "Most Popular" : "Best Value"}
                  </div>
                )}

                {/* Icon-ish header */}
                <div className="relative mb-2 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/80 border border-indigo-500/40 text-indigo-300 text-lg">
                    {pack.id === "handful" && "🪙"}
                    {pack.id === "small_pile" && "💠"}
                    {pack.id === "pouch" && "⛰️"}
                    {pack.id === "chest" && "💰"}
                    {pack.id === "vault" && "🌀"}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {pack.label}
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      {pack.subtitle}
                    </p>
                  </div>
                </div>

                {/* Stones */}
                <div className="relative mt-2 space-y-1 text-sm">
                  <p className="text-emerald-300 font-semibold">
                    {totalStones.toLocaleString()} Spirit Stones
                  </p>
                  <p className="text-[11px] text-gray-500">
                    ~{approxChapters.toLocaleString()} chapters of generation
                  </p>
                  {pack.bonus > 0 && (
                    <p className="text-[11px] text-emerald-400">
                      Includes +{pack.bonus.toLocaleString()} bonus stones
                    </p>
                  )}
                </div>

                {/* Price + button */}
                <div className="relative mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-xl font-bold text-white">{pack.price}</p>
                    <p className="text-[11px] text-gray-500">
                      {pricePerStone(pack)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePurchase(pack)}
                    disabled={isBuying || loading}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {isBuying ? "Opening vault…" : "Buy now"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Footer note */}
      <section className="mt-8 text-[11px] text-gray-500 space-y-1">
        <p>
          Spirit Stones are a virtual currency used only within Infinite
          Cultivation and have no cash value.
        </p>
        <p>
          Using Spirit Stones to generate chapters may help unlock special
          titles and cosmetic rewards in future updates.
        </p>
      </section>
    </main>
  );
}
