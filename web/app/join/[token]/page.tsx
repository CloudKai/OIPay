import { BrandName } from "@/components/ui/brand-name";
import Link from "next/link";
import GuestEntry from "@/components/invitations/guest-entry";
import { Card } from "@/components/ui/card";
import { credentialHash } from "@/lib/guest-session";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join a group", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const group = /^[A-Za-z0-9_-]{43}$/.test(token) ? await prisma.group.findUnique({ where: { joinTokenHash: credentialHash(token) }, select: { name: true, currency: true, joinEnabled: true, archivedAt: true } }) : null;
  const account = await getSessionUser();
  const active = group?.joinEnabled && !group.archivedAt;
  return <main className="grid min-h-dvh place-items-center px-4 py-10"><Card className="w-full max-w-lg p-6 sm:p-8">
    <h1 className="text-3xl font-semibold tracking-tight">{active ? `Join ${group.name}` : "This joining link is no longer active"}</h1>
    <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{active ? `Share expenses and balances in ${group.currency}. ${account ? "Your membership will be linked to your signed-in account." : "Enter your name to join. No signup needed. This browser will remember your access."}` : "Ask a group owner for a new link. An old or disabled link cannot be used to join."}</p>
    {active ? <GuestEntry token={token} initialName={account?.name ?? ""} /> : null}
    <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[var(--primary)] underline underline-offset-4"><BrandName /></Link>
  </Card></main>;
}
