"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinGroupAction, recoverGuestAction } from "@/app/actions/guests";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";

export default function GuestEntry({ token, recovery = false, initialName = "" }: { token: string; recovery?: boolean; initialName?: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return <form className="mt-6 space-y-4 text-left" onSubmit={(event) => {
    event.preventDefault(); setError(null);
    startTransition(async () => {
      try {
        const result = recovery ? await recoverGuestAction({ token }) : await joinGroupAction({ token, name });
        if (!result.ok) { setError(result.message); return; }
        router.push(`/groups/${result.data.groupId}`); router.refresh();
      } catch { setError("Could not connect. Your name is still here; try again when connected."); }
    });
  }}>
    {!recovery ? <Field label="Your name" htmlFor="guest-name" hint="Use a name your group will recognise. Each member needs a different name."><Input id="guest-name" name="name" autoComplete="name" required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /></Field> : null}
    <FormMessage message={error} />
    <Button type="submit" className="w-full" disabled={pending}>{pending ? "Connecting…" : recovery ? "Recover my guest access" : "Join group"}</Button>
  </form>;
}
