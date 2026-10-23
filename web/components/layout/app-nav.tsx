"use client";

import { BrandName } from "@/components/ui/brand-name";

import {
  Activity,
  LayoutDashboard,
  Settings,
  UsersRound,
  WalletCards
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import SignOutButton from "@/components/group/signout-button";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Groups", icon: UsersRound },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/account", label: "Account", icon: Settings }
];

function NavItems({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return items.map((item) => {
    const active =
      pathname === item.href ||
      (item.href === "/groups" && pathname.startsWith("/groups/"));
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
          mobile
            ? "min-h-12 flex-1 flex-col justify-center gap-1 rounded-lg px-1 py-1 text-[11px]"
            : "min-h-11 px-3",
          active
            ? "bg-[var(--surface-muted)] font-semibold text-[var(--primary)]"
            : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
        )}
      >
        <Icon className={cn("h-5 w-5", active && "text-[var(--primary)]")} />
        {item.label}
      </Link>
    );
  });
}

export default function AppNav({
  user
}: {
  user: { name: string; email: string | null; isGuest?: boolean };
}) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6 lg:flex lg:flex-col">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-xl px-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        >
          <WalletCards className="h-6 w-6 shrink-0 text-[var(--primary)]" aria-hidden="true" />
          <span>
            <span className="block text-base font-bold tracking-tight"><BrandName /></span>
          </span>
        </Link>
        <nav className="mt-7 space-y-1" aria-label="Primary navigation">
          <NavItems />
        </nav>
        <div className="mt-auto border-t border-[var(--border)] px-3 pt-5">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-[var(--ink-muted)]">{user.email ?? "Guest · remembered in this browser"}</p>
          <div className="mt-3">
            <SignOutButton guest={user.isGuest} />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <WalletCards className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
          <BrandName />
        </Link>
        <div className="ml-auto">
          <SignOutButton compact guest={user.isGuest} />
        </div>
      </header>

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--border)] bg-[var(--surface)] px-2 pt-2 lg:hidden"
        aria-label="Primary navigation"
      >
        <NavItems mobile />
      </nav>
    </>
  );
}
