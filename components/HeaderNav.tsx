"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import ModeToggle from "@/components/ModeToggle";
import { useMode } from "@/components/ModeProvider";

type ProfileRow = {
  display_name: string | null;
  username: string | null;
};

export default function HeaderNav() {
  const { mode } = useMode();

  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [label, setLabel] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const sb = supabaseBrowser();

    (async () => {
      setLoading(true);

      try {
        const { data: sessionData } = await sb.auth.getSession();
        const user = sessionData.session?.user;

        if (!user) {
          setIsAuthed(false);
          setLabel("");
          return;
        }

        setIsAuthed(true);

        let baseName = user.email ?? "Reader";

        const { data: profileData } = await sb
          .from("profiles")
          .select("display_name, username")
          .eq("id", user.id)
          .maybeSingle();

        const profile = profileData as ProfileRow | null;

        if (profile) {
          baseName =
            profile.display_name ||
            profile.username ||
            baseName;
        }

        let activeTitleLabel: string | null = null;

        const { data: activeUserTitle } = await sb
          .from("user_titles")
          .select("title_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (activeUserTitle?.title_id) {
          const { data: titleRow } = await sb
            .from("titles")
            .select("label")
            .eq("id", activeUserTitle.title_id)
            .maybeSingle();

          activeTitleLabel = titleRow?.label ?? null;
        }

        setLabel(
          activeTitleLabel
            ? `${baseName} (${activeTitleLabel})`
            : baseName
        );
      } catch (error) {
        console.warn(
          "HeaderNav: failed to load session/profile/title",
          error
        );

        setIsAuthed(false);
        setLabel("");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const closeMobile = () => {
    setMobileOpen(false);
  };

  const readerLinks = (
    <>
      <Link
        href="/library"
        onClick={closeMobile}
        className="text-gray-200 transition hover:text-white"
      >
        Library
      </Link>

      <Link
        href="/rankings"
        onClick={closeMobile}
        className="text-gray-200 transition hover:text-white"
      >
        Rankings
      </Link>

      <Link
        href="/lists"
        onClick={closeMobile}
        className="text-gray-300 transition hover:text-white"
      >
        Lists
      </Link>

      <Link
        href="/dashboard?tab=reader"
        onClick={closeMobile}
        className="text-gray-300 transition hover:text-white"
      >
        Saved
      </Link>
    </>
  );

  const creatorLinks = (
    <>
      <Link
        href="/dashboard?tab=creator"
        onClick={closeMobile}
        className="text-gray-200 transition hover:text-white"
      >
        Dashboard
      </Link>

      <Link
        href="/new"
        onClick={closeMobile}
        className="text-gray-300 transition hover:text-white"
      >
        Write
      </Link>

      <Link
        href="/library"
        onClick={closeMobile}
        className="text-gray-300 transition hover:text-white"
      >
        Library
      </Link>

      <Link
        href="/rankings"
        onClick={closeMobile}
        className="text-gray-300 transition hover:text-white"
      >
        Rankings
      </Link>

      <Link
        href="/lists"
        onClick={closeMobile}
        className="text-gray-300 transition hover:text-white"
      >
        Lists
      </Link>
    </>
  );

  return (
    <>
      {/* DESKTOP */}
      <nav className="hidden items-center gap-4 text-sm md:flex">
        <ModeToggle />

        {mode === "reader"
          ? readerLinks
          : creatorLinks}

        <Link
          href="/account"
          className="text-gray-300 transition hover:text-white"
        >
          Account
        </Link>

        {loading ? (
          <span className="text-xs text-gray-500">
            ...
          </span>
        ) : isAuthed ? (
          <span
            className="max-w-[180px] truncate text-xs text-gray-300"
            title={label}
          >
            {label}
          </span>
        ) : (
          <Link
            href="/login"
            className="text-gray-300 transition hover:text-white"
          >
            Login
          </Link>
        )}
      </nav>

      {/* MOBILE */}
      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() =>
            setMobileOpen((open) => !open)
          }
          aria-expanded={mobileOpen}
          aria-label="Open navigation menu"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/[0.08] hover:text-white"
        >
          <span>Menu</span>

          <svg
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className={`h-4 w-4 transition-transform ${
              mobileOpen ? "rotate-180" : ""
            }`}
          >
            <path
              d="M5 7.5 10 12.5 15 7.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {mobileOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#0a0f1d] shadow-2xl shadow-black/40">
            <div className="border-b border-white/10 p-3">
              <ModeToggle />
            </div>

            <nav className="flex flex-col gap-1 p-2 text-sm">
              <div className="flex flex-col">
                {mode === "reader"
                  ? readerLinks
                  : creatorLinks}
              </div>

              <div className="my-1 border-t border-white/10" />

              <Link
                href="/account"
                onClick={closeMobile}
                className="rounded-lg px-3 py-2.5 text-gray-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Account
              </Link>

              {!loading && !isAuthed && (
                <Link
                  href="/login"
                  onClick={closeMobile}
                  className="rounded-lg px-3 py-2.5 text-gray-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Login
                </Link>
              )}
            </nav>

            {loading ? (
              <div className="border-t border-white/10 px-4 py-3 text-xs text-gray-500">
                Loading account…
              </div>
            ) : isAuthed ? (
              <div
                className="truncate border-t border-white/10 px-4 py-3 text-xs text-gray-400"
                title={label}
              >
                {label}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}