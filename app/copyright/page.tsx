// app/copyright/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Copyright | Infinite Cultivation",
  description:
    "Copyright information and content-removal procedures for Infinite Cultivation.",
};

export default function CopyrightPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl sm:p-10">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-amber-300">
          Legal
        </p>

        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Copyright Information
        </h1>

        <p className="mt-3 text-sm text-gray-400">
          Last updated: September 14, 2026
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-7 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white">
              About the catalog
            </h2>

            <p className="mt-3">
              Infinite Cultivation is a discovery and catalog platform for
              cultivation and progression-fantasy fiction. Catalog pages may
              contain descriptive information such as titles, author names,
              summaries, genres, tags, ratings, links, and cover images
              associated with works available through third-party sources.
            </p>

            <p className="mt-3">
              The presence of a work in the catalog does not imply ownership,
              sponsorship, endorsement, or affiliation between its rights
              holder and Infinite Cultivation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">
              Ownership of works
            </h2>

            <p className="mt-3">
              Authors, publishers, artists, and other applicable rights holders
              retain their rights in their novels, cover artwork, and related
              materials. Infinite Cultivation does not claim ownership of
              third-party works merely because information about them appears
              in the catalog.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">
              Corrections and removal requests
            </h2>

            <p className="mt-3">
              If you are an author, publisher, artist, or authorized
              representative and believe catalog information or imagery should
              be corrected or removed, contact us at{" "}
              <a
                href="mailto:infinitecultivation1@gmail.com"
                className="font-medium text-amber-300 underline decoration-amber-300/40 underline-offset-4 hover:text-amber-200"
              >
                infinitecultivation1@gmail.com
              </a>
              .
            </p>

            <p className="mt-3">
              Please identify the relevant work and page, explain your
              relationship to the material, describe the requested action, and
              provide reliable contact information. We may request additional
              information when reasonably necessary to evaluate the request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">
              Copyright notices
            </h2>

            <p className="mt-3">
              For a formal copyright-infringement notice, please review our{" "}
              <Link
                href="/dmca"
                className="font-medium text-amber-300 underline decoration-amber-300/40 underline-offset-4 hover:text-amber-200"
              >
                DMCA notice procedure
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}