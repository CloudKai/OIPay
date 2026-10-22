import Link from "next/link";
import LinkGuestAccount from "@/components/invitations/link-guest-account";
import { getGuestSession } from "@/lib/guest-session";
import { getAuthContext } from "@/lib/session";
import AccountSettings from "@/components/account/account-settings";
import { googleAuthEnabled } from "@/lib/auth-config";


export const metadata = { title: "Account" };

export default async function AccountPage() {
  const context = await getAuthContext();
  const guest = await getGuestSession();
  if (!context) return <div className="max-w-2xl space-y-5"><h1 className="text-3xl font-semibold tracking-tight">Keep your group access</h1><p className="text-[var(--ink-muted)]">You’re a guest. This browser remembers your memberships. Create an account or sign in on this browser, then link your guest records here to use other devices. If you lose access first, your group owner can send you a private recovery link.</p><div className="flex flex-wrap gap-4"><Link className="font-semibold text-[var(--primary)] underline underline-offset-4" href="/signup">Create an account</Link><Link className="font-semibold text-[var(--primary)] underline underline-offset-4" href="/login?callbackURL=/account">Sign in to an existing account</Link></div></div>;
  const { authUser, user } = context;
  const providers = new Set(
    authUser.identities?.map((identity) => identity.provider) ?? []
  );

  return (
    <div className="space-y-6" data-enter>
      <header>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">
          Profile, security, and privacy
        </h1>
      </header>
      {guest?.members.length ? <LinkGuestAccount /> : null}
      <AccountSettings
        user={{
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified
        }}
        hasPassword={providers.has("email")}
        googleLinked={providers.has("google")}
        googleEnabled={googleAuthEnabled}
      />
    </div>
  );
}
