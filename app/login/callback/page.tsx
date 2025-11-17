// app/login/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginCallbackPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    (async () => {
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
  }, [params, router, sb]);

  return (
    <main className="max-w-md mx-auto p-8 text-gray-200">
      <p>Signing you in…</p>
    </main>
  );
}
