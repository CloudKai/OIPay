"use client";

import { AlertDialog } from "radix-ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/feedback";

export function ConfirmAction({
  title,
  description,
  trigger,
  confirmLabel,
  onConfirm
}: {
  title: string;
  description: string;
  trigger: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<{ ok: boolean; message?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl outline-none">
          <AlertDialog.Title className="text-lg font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            {description}
          </AlertDialog.Description>
          <FormMessage message={error} className="mt-4" />
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialog.Cancel>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await onConfirm();
                  if (!result.ok) {
                    setError(result.message ?? "The action could not be completed.");
                    return;
                  }
                  toast.success(result.message);
                  setOpen(false);
                })
              }
            >
              {pending ? "Working..." : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
