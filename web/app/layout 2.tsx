import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Link from "next/link";

import "@/app/globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

export const metadata: Metadata = {
  title: "SplitTogether",
  description: "Modern shared expense tracking for trips, roommates, and teams"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} font-[var(--font-manrope)]`}>
        <div className="min-h-screen pb-8">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <Link href="/dashboard" className="text-xl font-extrabold tracking-tight text-slate-900">
                SplitTogether
              </Link>
              <div className="hidden items-center gap-2 sm:flex">
                <p className="soft-chip">Expense Sharing</p>
                <p className="soft-chip">Realtime Balances</p>
              </div>
            </div>
          </header>
          <main className="mx-auto mt-6 max-w-6xl px-4 sm:px-6 lg:px-10">
            <div className="page-shell">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
