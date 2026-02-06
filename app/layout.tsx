// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Infinite Cultivation",
  description: "AI Xianxia writer",
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
          <header className="border-b border-white/10 bg-black/30 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/" className="font-semibold tracking-wide text-white">
                Infinite Cultivation
              </Link>

              {/* Auth-aware nav */}
              <HeaderNav />
            </div>
          </header>

          <div className="min-h-screen">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
