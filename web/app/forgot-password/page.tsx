import AuthShell from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-recovery-forms";
import { authConfigured } from "@/lib/auth-config";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      mode="recovery"
      heading="Reset your password"
      subheading="Enter your email. We will send a secure link if an account is registered."
    >
      <ForgotPasswordForm authConfigured={authConfigured} />
    </AuthShell>
  );
}
