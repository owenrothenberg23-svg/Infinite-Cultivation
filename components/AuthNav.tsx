// components/AuthNav.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type SessionUser = {
  id: string;
  email?: string;
};

export default function AuthNav() {
  const sb = supabaseBrowser();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb.auth.getSession();
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? undefined } : null);
      setLoading(false);
    })();
  }, [sb]);

  if (loading) {
    // simple placeholder so layout doesn't jump
    return (
      <span className="text-xs text-gray-400">
        …
      </span>
    );
  }

  if (!user) {
    // Not logged in → show Login link
    return (
      <Link href="/login" className="text-gray-300 hover:text-white text-sm">
        Login
      </Link>
    );
  }

  // Logged in → show Account + quick link to "My stories"
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/dashboard" className="text-gray-300 hover:text-white">
        My stories
      </Link>
      <Link href="/account" className="text-gray-300 hover:text-white">
        Account
      </Link>
    </div>
  );
}
