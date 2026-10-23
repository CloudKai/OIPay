import { Suspense } from "react";
import { redirect } from "next/navigation";

import AuthShell from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-recovery-forms";
import { getAuthenticatedUser } from "@/lib/session";

export const metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/forgot-password");

  return (
    <AuthShell
      mode="recovery"
      heading="Choose a new password"
      subheading="Use a password that is unique to OIPay."
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
