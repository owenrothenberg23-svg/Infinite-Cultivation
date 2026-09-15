// app/store/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Spirit Stone Store | Infinite Cultivation",
  description: "Spirit Stone purchases are not currently available.",
};

export default function StorePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-16 sm:py-24">
      <section className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center shadow-xl sm:p-10">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-300">
          Spirit Stone Store
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Purchases are not currently available
        </h1>

        <p className="mx-auto mt-4 max-w-xl leading-7 text-gray-300">
          The Spirit Stone Store is inactive during the current beta. No
          purchases can be made at this time.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-amber-400 px-5 py-3 font-semibold text-gray-950 transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-[#0B1220]"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
