import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Infinite Cultivation",
  description: "AI Xianxia writer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* antialiased + subpixel text; bg/text also set in globals as a backstop */}
      <body className="min-h-screen bg-[#0B1220] text-gray-100 antialiased">
        {/* Simple top bar (static links; auth-aware bits handled inside pages) */}
        <header className="border-b border-white/10 bg-black/30 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-wide text-white">
              Infinite Cultivation
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/new" className="text-gray-300 hover:text-white">
                New Story
              </Link>
              <Link href="/dashboard" className="text-gray-300 hover:text-white">
                Dashboard
              </Link>
              <Link href="/login" className="text-gray-300 hover:text-white">
                Login
              </Link>
            </nav>
          </div>
        </header>

        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
