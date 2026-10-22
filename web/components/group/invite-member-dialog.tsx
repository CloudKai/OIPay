"use client";

import { UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { inviteMemberAction } from "@/app/actions/groups";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger
} from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";

export default function InviteMemberDialog({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await inviteMemberAction({ groupId, displayName, email });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(result.message);
      setDisplayName("");
      setEmail("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <UserPlus className="h-4 w-4" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Invite a member"
        description="They can be included in expenses immediately and claim their place after registering."
        className="sm:max-w-lg"
      >
        <form onSubmit={submit} className="space-y-5">
          <Field label="Display name" htmlFor="invite-name">
            <Input
              id="invite-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={60}
              required
            />
          </Field>
          <Field label="Email" htmlFor="invite-email">
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <FormMessage message={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending..." : "Send invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
