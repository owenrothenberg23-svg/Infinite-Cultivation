// app/store/page.tsx
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import StoreClient from "./StoreClient";

export default function StorePage() {
  return (
    <Suspense fallback={<main className="max-w-5xl mx-auto px-6 py-10 text-gray-200">Loading store…</main>}>
      <StoreClient />
    </Suspense>
  );
}
