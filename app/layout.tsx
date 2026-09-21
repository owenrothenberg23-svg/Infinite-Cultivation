import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";
import { ToastProvider } from "@/components/ui/toast";
import { ModeProvider } from "@/components/ModeProvider";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://infinitecultivation.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Infinite Cultivation",
    template: "%s | Infinite Cultivation",
  },
  description:
    "Discover, rank, review, compare, and track cultivation novels and webnovels from across the internet.",
  openGraph: {
    type: "website",
    siteName: "Infinite Cultivation",
    title: "Infinite Cultivation",
    description:
      "Discover, rank, review, compare, and track cultivation novels and webnovels from across the internet.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Infinite Cultivation",
    description:
      "Discover, rank, review, compare, and track cultivation novels and webnovels from across the internet.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0B1220] text-gray-100 antialiased">
        <ToastProvider>
          <ModeProvider>
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

            <div className="min-h-screen">{children}</div>
          </ModeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}