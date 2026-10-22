import { getGuestSession } from "@/lib/guest-session";
import AppNav from "@/components/layout/app-nav";
import { requireSessionPrincipal } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireSessionPrincipal();
  const pendingGuest = !user.isGuest ? await getGuestSession() : null;
  return (
    <div className="min-h-dvh lg:pl-64">
      <AppNav user={{ name: user.name, email: user.email, isGuest: user.isGuest }} />
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
        {user.isGuest ? <div className="mb-5 border-b border-[var(--border)] pb-4 text-sm leading-6">You’re joining as {user.name}. This browser remembers you. <a className="font-semibold text-[var(--primary)] underline underline-offset-4" href="/account">Add an account to keep access on other devices</a>.</div> : null}
        {pendingGuest?.members.length ? <div className="mb-5 border-b border-[var(--border)] pb-4 text-sm leading-6">Your guest records are still saved in this browser. <a href="/account" className="font-semibold text-[var(--primary)] underline underline-offset-4">Link them to this account</a> to keep using them on other devices.</div> : null}
        {children}
      </main>
    </div>
  );
}
