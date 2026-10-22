import Link from "next/link";

import AuthShell from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Authentication link expired" };

export default function AuthErrorPage() {
  return (
    <AuthShell
      mode="recovery"
      heading="This authentication link did not work"
      subheading="The link may have expired, already been used, or opened on a different device."
    >
      <div className="space-y-3">
        <Button asChild className="w-full">
          <Link href="/login">Return to sign in</Link>
        </Button>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/forgot-password">Request a new reset link</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
