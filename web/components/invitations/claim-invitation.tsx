"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { claimInvitationAction } from "@/app/actions/groups";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/feedback";

export default function ClaimInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <FormMessage message={error} className="mb-4" />
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await claimInvitationAction({ token });
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.push(`/groups/${result.data.groupId}`);
          })
        }
      >
        {pending ? "Accepting..." : "Accept invitation"}
      </Button>
    </div>
  );
}
