"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkGuestAccountAction } from "@/app/actions/guests";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/feedback";
export default function LinkGuestAccount() {
  const router = useRouter(); const [message, setMessage] = useState<string | null>(null); const [pending, startTransition] = useTransition();
  return <section className="rounded-xl border border-[var(--border)] bg-white p-5"><h2 className="font-semibold">Keep your guest records</h2><p className="mt-2 text-sm text-[var(--ink-muted)]">Link the guest memberships remembered in this browser to this account. Your group names, expenses, and balances stay with you on other devices. Verify your email first.</p><FormMessage className="mt-3" message={message} /><Button className="mt-4" disabled={pending} onClick={() => startTransition(async () => { try { const result = await linkGuestAccountAction(); setMessage(result.message ?? null); if (result.ok) router.refresh(); } catch { setMessage("Could not connect. Please try again."); } })}>{pending ? "Linking…" : "Link my guest records"}</Button></section>;
}
