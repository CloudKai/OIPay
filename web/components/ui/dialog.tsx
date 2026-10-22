"use client";

import { Dialog as RadixDialog } from "radix-ui";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  title,
  description,
  children,
  className
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35 data-[state=closed]:animate-out data-[state=open]:animate-in" />
      <RadixDialog.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto overscroll-contain scroll-p-5 rounded-t-2xl bg-white p-5 shadow-2xl outline-none sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(92vw,680px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6",
          className
        )}
      >
        <div className="mb-5 pr-10">
          <RadixDialog.Title className="text-xl font-semibold tracking-tight text-[var(--ink)]">
            {title}
          </RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-1 text-sm text-[var(--ink-muted)]">
              {description}
            </RadixDialog.Description>
          ) : null}
        </div>
        {children}
        <RadixDialog.Close
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
