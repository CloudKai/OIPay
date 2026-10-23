import { BrandName } from "@/components/ui/brand-name";
import { WalletCards } from "lucide-react";
import Link from "next/link";

export default function AuthShell({
  mode,
  heading,
  subheading,
  children
}: {
  mode: "login" | "signup" | "recovery";
  heading: string;
  subheading: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-[var(--surface)]">
      <header className="px-6 py-6 sm:px-10 lg:px-14">
        <Link href="/" className="inline-flex items-center gap-2.5 text-base font-semibold tracking-tight">
          <WalletCards className="h-6 w-6 text-[var(--primary)]" aria-hidden="true" />
          <BrandName />
        </Link>
      </header>
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-16 px-6 pb-16 pt-8 sm:px-10 lg:grid-cols-2 lg:gap-24 lg:pb-24">
        <section className="hidden max-w-md lg:block">
          <h2 className="text-4xl font-semibold leading-tight tracking-[-0.03em] text-[var(--ink)]">
            Share the plans.<br />Keep the costs simple.
          </h2>
          <p className="mt-6 text-base leading-7 text-[var(--ink-muted)]">
            Trips with friends, a shared home, or a meal together. Keep track of what everyone paid and see what’s left to settle.
          </p>
          <p className="mt-5 text-sm leading-6 text-[var(--ink-muted)]">
            Split costs your way, record payments, and keep a clear history for the whole group.
          </p>
        </section>
        <section className="mx-auto w-full max-w-sm lg:mx-0" data-enter>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">
            {heading}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            {subheading}
          </p>
          <div className="mt-7">{children}</div>
          {mode !== "recovery" ? (
            <p className="mt-6 text-center text-sm text-[var(--ink-muted)]">
              {mode === "login" ? "New to OIPay?" : "Already have an account?"}{" "}
              <Link
                href={mode === "login" ? "/signup" : "/login"}
                className="font-semibold text-[var(--primary)] hover:underline"
              >
                {mode === "login" ? "Create account" : "Sign in"}
              </Link>
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
