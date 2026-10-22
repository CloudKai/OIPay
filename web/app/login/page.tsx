import { redirect } from "next/navigation";

import AuthShell from "@/components/auth/auth-shell";
import LoginForm from "@/components/auth/login-form";
import { authConfigured, googleAuthEnabled } from "@/lib/auth-config";
import { safeLocalRedirectPath } from "@/lib/navigation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ callbackURL?: string | string[] }>;
}) {
  const [user, params] = await Promise.all([getSessionUser(), searchParams]);

  if (user?.id) {
    redirect("/dashboard");
  }

  const callbackValue = Array.isArray(params.callbackURL)
    ? params.callbackURL[0]
    : params.callbackURL;
  const callbackURL = safeLocalRedirectPath(callbackValue) ?? "/dashboard";

  return (
    <AuthShell
      mode="login"
      heading="Sign in to your workspace"
      subheading="Track expenses, review balances, and settle up from one clean dashboard."
    >
      <LoginForm
        authConfigured={authConfigured}
        callbackURL={callbackURL}
        googleEnabled={googleAuthEnabled}
      />
    </AuthShell>
  );
}
