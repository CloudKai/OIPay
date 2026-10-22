"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";

import { forgetGuestAction } from "@/app/actions/guests";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

export default function SignOutButton({ compact = false, guest = false }: { compact?: boolean; guest?: boolean }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon" : "default"}
      disabled={pending}
      aria-label="Sign out"
      onClick={async () => {
        if (guest && !window.confirm("Forget your guest access on this browser? You will need a private recovery link from a group owner to return. Add an account first if you want to keep access.")) return;
        setPending(true);
        try {
          if (guest) {
            const result = await forgetGuestAction();
            if (!result.ok) { toast.error(result.message); setPending(false); return; }
          } else {
            const result = await signOut();
            if (result.error) { toast.error(result.error); setPending(false); return; }
          }
          router.replace("/login"); router.refresh();
        } catch { toast.error("Could not connect. Please try signing out again."); setPending(false); }
      }}
    >
      <LogOut className="h-4 w-4" />
      {compact ? null : pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
