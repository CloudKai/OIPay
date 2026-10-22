import GuestEntry from "@/components/invitations/guest-entry";
import { Card } from "@/components/ui/card";
import { getGuestRecoveryPreview } from "@/lib/guest-session";
export const dynamic = "force-dynamic";
export const metadata = { title: "Recover guest access", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function GuestRecoveryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const member = await getGuestRecoveryPreview(token);
  const active = Boolean(member);
  return <main className="grid min-h-dvh place-items-center px-4 py-10"><Card className="w-full max-w-lg p-6 sm:p-8">
    <h1 className="text-3xl font-semibold tracking-tight">{active ? `Recover access for ${member!.displayName}` : "This recovery link is no longer active"}</h1>
    <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{active ? "Continue only if this membership belongs to you. Your expenses and balances will stay the same. Previous browser access will be replaced. This private link works once." : "Ask the group owner for another private recovery link."}</p>
    {active ? <GuestEntry token={token} recovery /> : null}
  </Card></main>;
}
