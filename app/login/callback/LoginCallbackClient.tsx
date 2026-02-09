// app/login/callback/LoginCallbackClient.tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginCallbackClient() {
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

  return <p>Signing you in…</p>;
}
