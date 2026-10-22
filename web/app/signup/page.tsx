import { redirect } from "next/navigation";

import AuthShell from "@/components/auth/auth-shell";
import SignupForm from "@/components/auth/signup-form";
import { authConfigured, googleAuthEnabled } from "@/lib/auth-config";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getSessionUser();

  if (user?.id) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      mode="signup"
      heading="Create your account"
      subheading="Set up your profile in under a minute and start splitting with your group."
    >
      <SignupForm
        authConfigured={authConfigured}
        googleEnabled={googleAuthEnabled}
      />
    </AuthShell>
  );
}
