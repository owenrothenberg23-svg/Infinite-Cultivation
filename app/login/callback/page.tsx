// app/login/callback/page.tsx
import { Suspense } from "react";
import LoginCallbackClient from "./LoginCallbackClient";

export const dynamic = "force-dynamic";

export default function LoginCallbackPage() {
  return (
    <main className="max-w-md mx-auto p-8 text-gray-200">
      <Suspense fallback={<p>Signing you in…</p>}>
        <LoginCallbackClient />
      </Suspense>
    </main>
  );
}
