// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";
import { ToastProvider } from "@/components/ui/toast";
import { ModeProvider } from "@/components/ModeProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://infinite-cultivation-28ue.vercel.app"),
  title: {
    default: "Infinite Cultivation",
    template: "%s | Infinite Cultivation",
  },
  description:
    "Discover, read, and create cultivation novels on Infinite Cultivation.",
  applicationName: "Infinite Cultivation",
  openGraph: {
    type: "website",
    siteName: "Infinite Cultivation",
    title: "Infinite Cultivation",
    description:
      "Discover, read, and create cultivation novels on Infinite Cultivation.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Infinite Cultivation",
    description:
      "Discover, read, and create cultivation novels on Infinite Cultivation.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0B1220] text-gray-100 antialiased">
        <ToastProvider>
          <ModeProvider>
            <div className="flex min-h-screen flex-col">
              <header className="border-b border-white/10 bg-black/30 backdrop-blur">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
                  <Link
                    href="/"
                    className="font-semibold tracking-wide text-white"
                  >
                    Infinite Cultivation
                  </Link>

                  <HeaderNav />
                </div>
              </header>

              <main className="flex-1">{children}</main>

              <footer className="border-t border-white/10 bg-black/20">
                <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                  <p>© {new Date().getFullYear()} Infinite Cultivation</p>

                  <nav
                    aria-label="Legal links"
                    className="flex flex-wrap items-center gap-x-5 gap-y-2"
                  >
                    <Link
                      href="/copyright"
                      className="transition hover:text-white"
                    >
                      Copyright
                    </Link>

                    <Link
                      href="/dmca"
                      className="transition hover:text-white"
                    >
                      DMCA
                    </Link>

                    <a
                      href="mailto:infinitecultivation1@gmail.com"
                      className="transition hover:text-white"
                    >
                      Contact
                    </a>
                  </nav>
                </div>
              </footer>
            </div>
          </ModeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
