// app/dmca/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DMCA | Infinite Cultivation",
  description:
    "How to submit a copyright-infringement notice to Infinite Cultivation.",
};

export default function DmcaPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl sm:p-10">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-amber-300">
          Legal
        </p>

        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Copyright and DMCA Notices
        </h1>

        <p className="mt-3 text-sm text-gray-400">
          Last updated: September 14, 2026
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-7 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white">
              Reporting copyright infringement
            </h2>

            <p className="mt-3">
              Infinite Cultivation respects intellectual-property rights. If
              you believe material displayed or linked through the platform
              infringes a copyright you own or are authorized to enforce, you
              may send us a written notice requesting that we remove or disable
              access to the material.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">
              What your notice should contain
            </h2>

            <p className="mt-3">
              To help us evaluate and respond to your notice, please include:
            </p>

            <ol className="mt-4 list-decimal space-y-3 pl-6">
              <li>
                Identification of the copyrighted work you claim has been
                infringed, or a representative list if the notice covers
                multiple works.
              </li>

              <li>
                Identification of the allegedly infringing material and enough
                information for us to locate it, including the relevant
                Infinite Cultivation URL.
              </li>

              <li>
                Your name, mailing address, telephone number, and email
                address.
              </li>

              <li>
                A statement that you have a good-faith belief that the disputed
                use is not authorized by the copyright owner, its agent, or
                applicable law.
              </li>

              <li>
                A statement that the information in your notice is accurate
                and, under penalty of perjury, that you are the copyright owner
                or authorized to act on the owner’s behalf.
              </li>

              <li>
                Your physical or electronic signature.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">
              Where to send a notice
            </h2>

            <p className="mt-3">
              Send copyright notices to:
            </p>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="font-medium text-white">
                Infinite Cultivation Copyright Contact
              </p>

              <a
                href="mailto:infinitecultivation1@gmail.com"
                className="mt-1 inline-block text-amber-300 underline decoration-amber-300/40 underline-offset-4 hover:text-amber-200"
              >
                infinitecultivation1@gmail.com
              </a>
            </div>

            <p className="mt-3 text-sm text-gray-400">
              This email address is intended for copyright and
              intellectual-property matters. Incomplete notices may delay our
              ability to investigate or respond.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">
              What happens after a notice
            </h2>

            <p className="mt-3">
              We may remove or disable access to disputed material while
              reviewing a notice. We may also contact the person or source
              associated with the material and may share the notice when
              reasonably necessary to investigate or process the request.
            </p>

            <p className="mt-3">
              Submitting false or materially misleading claims may result in
              legal consequences. If you are uncertain whether material
              infringes your rights, consider consulting a qualified attorney
              before submitting a notice.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}