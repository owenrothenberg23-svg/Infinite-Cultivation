// app/login/callback/page.tsx
"use client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const sb = supabaseBrowser();

      const code = params.get("code");
      if (code) {
        await sb.auth.exchangeCodeForSession(window.location.href);
      }

      const { data } = await sb.auth.getSession();
      router.replace(data.session ? "/dashboard" : "/login");
    })();
  }, [params, router]);

  return (
    <main className="max-w-md mx-auto p-8 text-gray-200">
      <p>Signing you in…</p>
    </main>
  );
}
