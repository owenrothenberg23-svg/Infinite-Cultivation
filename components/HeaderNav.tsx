"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import ModeToggle from "@/components/ModeToggle"; // ✅ NEW
import { useMode } from "@/components/ModeProvider"; // ✅ NEW

type ProfileRow = {
  display_name: string | null;
  username: string | null;
};

export default function HeaderNav() {
  const { mode } = useMode(); // ✅ NEW

  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [label, setLabel] = useState<string>("");

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

        // ----- base name: display_name → username → email -----
        let baseName = user.email ?? "Cultivator";

        const { data: profileData } = await sb
          .from("profiles")
          .select("display_name, username")
          .eq("id", user.id)
          .maybeSingle();

        const p = profileData as ProfileRow | null;
        if (p) {
          baseName = p.display_name || p.username || baseName;
        }

        // ----- active title from user_titles + titles -----
        let activeTitleLabel: string | null = null;

        const { data: activeUserTitle, error: activeErr } = await sb
          .from("user_titles")
          .select("title_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (!activeErr && activeUserTitle?.title_id) {
          const { data: titleRow, error: titleErr } = await sb
            .from("titles")
            .select("label")
            .eq("id", activeUserTitle.title_id)
            .maybeSingle();

          if (!titleErr && titleRow) {
            activeTitleLabel = titleRow.label ?? null;
          }
        }

        // Final label: "Username (Title)" or just "Username"
        const finalLabel = activeTitleLabel
          ? `${baseName} (${activeTitleLabel})`
          : baseName;

        setLabel(finalLabel);
      } catch (e) {
        console.warn("HeaderNav: failed to load session/profile/title", e);
        setIsAuthed(false);
        setLabel("");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <nav className="flex items-center gap-4 text-sm">
      {/* ✅ Mode toggle always visible */}
      <ModeToggle />

      {/* ✅ Mode-aware nav ordering / emphasis */}
      {mode === "reader" ? (
        <>
          <Link href="/library" className="text-gray-200 hover:text-white">
            Library
          </Link>
          <Link href="/titles" className="text-gray-300 hover:text-white">
            Titles
          </Link>
          <Link href="/store" className="text-gray-300 hover:text-white">
            Store
          </Link>
          <Link href="/dashboard" className="text-gray-300 hover:text-white">
            Dashboard
          </Link>
          <Link href="/new" className="text-gray-300 hover:text-white">
            New Story
          </Link>
        </>
      ) : (
        <>
          <Link href="/dashboard" className="text-gray-200 hover:text-white">
            Dashboard
          </Link>
          <Link href="/new" className="text-gray-300 hover:text-white">
            New Story
          </Link>
          <Link href="/library" className="text-gray-300 hover:text-white">
            Library
          </Link>
          <Link href="/titles" className="text-gray-300 hover:text-white">
            Titles
          </Link>
          <Link href="/store" className="text-gray-300 hover:text-white">
            Store
          </Link>
        </>
      )}

      <Link href="/account" className="text-gray-300 hover:text-white">
        Account
      </Link>

      {loading ? (
        <span className="text-xs text-gray-500">...</span>
      ) : isAuthed ? (
        <span
          className="max-w-[220px] truncate text-xs text-gray-300"
          title={label}
        >
          {label}
        </span>
      ) : (
        <Link href="/login" className="text-gray-300 hover:text-white">
          Login
        </Link>
      )}
    </nav>
  );
}