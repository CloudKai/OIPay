import { CalendarClock, UsersRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import ClaimInvitation from "@/components/invitations/claim-invitation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getInvitationPreview } from "@/lib/group-data";
import { getSessionUser } from "@/lib/session";

export default async function InvitationPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [invitation, user] = await Promise.all([
    getInvitationPreview(token),
    getSessionUser()
  ]);
  if (!invitation) notFound();
  const expired = invitation.expired;

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <Card className="w-full max-w-lg p-6 text-center sm:p-8" data-enter>
        <span className="mx-auto grid h-14 w-14 place-items-center text-[var(--primary)]">
          {expired ? <CalendarClock className="h-6 w-6" /> : <UsersRound className="h-6 w-6" />}
        </span>
        <p className="mt-5 text-sm font-semibold text-[var(--primary)]">
          SplitTogether invitation
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {expired ? "This invitation is no longer active" : `Join ${invitation.group.name}`}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          {expired
            ? "Ask a group owner to send a new invitation."
            : `${invitation.displayName}, you were invited to share ${invitation.group.currency} expenses and balances with this group.`}
        </p>
        <div className="mt-7">
          {expired ? (
            <Button asChild variant="secondary" className="w-full">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          ) : user ? (
            <ClaimInvitation token={token} />
          ) : (
            <Button asChild size="lg" className="w-full">
              <Link href={`/login?callbackURL=${encodeURIComponent(`/invite/${token}`)}`}>
                Sign in to accept
              </Link>
            </Button>
          )}
        </div>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 text-xs text-[var(--ink-subtle)]">
          <WalletCards className="h-4 w-4" />
          SplitTogether
        </Link>
      </Card>
    </main>
  );
}
