// app/login/callback/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const sb = supabaseBrowser(); // ✅ create only in the browser effect

      // If it's an OAuth flow (?code=...), exchange it
      const hasCode = !!params.get("code");
      if (hasCode) {
        await sb.auth.exchangeCodeForSession(window.location.href);
      }

      // In either case, once a session exists, head to dashboard
      const { data } = await sb.auth.getSession();
      if (data.session) router.replace("/dashboard");
      else router.replace("/login"); // fallback
    })();
  }, [params, router]);

  return (
    <main className="max-w-md mx-auto p-8 text-gray-200">
      <p>Signing you in…</p>
    </main>
  );
}
