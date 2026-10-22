"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueGuestRecoveryAction, manageJoinLinkAction } from "@/app/actions/guests";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";

function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="space-y-2"><Field label={label} htmlFor={`copy-${label.replaceAll(" ", "-")}`}><Input id={`copy-${label.replaceAll(" ", "-")}`} value={url} readOnly onFocus={(event) => event.target.select()} /></Field><Button type="button" variant="secondary" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy link"}</Button></div>;
}
export function GroupJoinLink({ groupId, enabled, archived }: { groupId: string; enabled: boolean; archived: boolean }) {
  const router = useRouter(); const [url, setUrl] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [pending, startTransition] = useTransition();
  function manage(enable: boolean) { setError(null); startTransition(async () => { try { const result = await manageJoinLinkAction({ groupId, enabled: enable }); if (!result.ok) { setError(result.message); return; } setUrl(result.data.url); router.refresh(); } catch { setError("Could not connect. Try again."); } }); }
  return <section className="rounded-xl border border-[var(--border)] bg-white p-5"><h2 className="text-lg font-semibold">Join by name</h2><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Share one link with your group. People enter a distinct name and join without creating an account. Anyone with the link can join while it is active.</p><p className="mt-2 text-sm font-medium">{enabled ? "Joining link is active." : "Joining link is disabled."}</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" disabled={pending || archived} onClick={() => manage(true)}>{pending ? "Working…" : enabled ? "Replace joining link" : "Create joining link"}</Button>{enabled ? <Button type="button" variant="secondary" disabled={pending || archived} onClick={() => manage(false)}>Disable joining link</Button> : null}</div>{enabled ? <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">Replacing the link immediately stops the previous link from working. Save the new link when it appears.</p> : null}<FormMessage className="mt-3" message={error} />{url ? <div className="mt-4"><CopyLink url={url} label="Group joining link" /></div> : null}</section>;
}
export function GuestRecoveryLink({ groupId, memberId, name }: { groupId: string; memberId: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [pending, startTransition] = useTransition();
  return <div><Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => { try { const result = await issueGuestRecoveryAction({ groupId, memberId }); if (!result.ok) { setError(result.message); return; } setUrl(result.data.url); } catch { setError("Could not connect. Try again."); } })}>{pending ? "Creating…" : "Create private recovery link"}</Button><FormMessage message={error} />{url ? <div className="mt-2 max-w-full space-y-2"><p className="text-xs leading-5 text-[var(--ink-muted)]">Send only to {name}. This link expires in 24 hours and works once. Using it replaces their previous browser access.</p><CopyLink url={url} label={`Private recovery link for ${name}`} /></div> : null}</div>;
}
