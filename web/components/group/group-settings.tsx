"use client";

import { Archive, Mail, RefreshCw, Shield, Trash2, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  archiveGroupAction,
  permanentlyDeleteGroupAction,
  removeMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
  transferOwnershipAction,
  updateGroupAction
} from "@/app/actions/groups";
import { GroupJoinLink, GuestRecoveryLink } from "@/components/group/guest-management";
import InviteMemberDialog from "@/components/group/invite-member-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { FormMessage } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { supportedCurrencies } from "@/lib/money";

type SettingsMember = {
  id: string;
  name: string;
  email: string | null;
  isGuest?: boolean;
  role: "OWNER" | "MEMBER";
  status: "ACTIVE" | "INVITED" | "REMOVED";
  invitationDeliveryStatus: "PENDING" | "SENT" | "FAILED" | "DISABLED" | null;
};

function AsyncButton({
  children,
  action,
  variant = "ghost"
}: {
  children: React.ReactNode;
  action: () => Promise<{ ok: boolean; message?: string }>;
  variant?: "ghost" | "secondary" | "danger";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action();
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else {
            toast.error(result.message);
          }
        })
      }
    >
      {pending ? "Working..." : children}
    </Button>
  );
}

export default function GroupSettings({
  group,
  members,
  currentMemberId,
  isOwner
}: {
  group: {
    id: string;
    name: string;
    currency: string;
    archived: boolean;
    hasFinancialRecords: boolean;
    joinEnabled?: boolean;
  };
  members: SettingsMember[];
  currentMemberId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [currency, setCurrency] = useState(group.currency);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDeleting] = useTransition();
  const visibleMembers = members.filter((member) => member.status !== "REMOVED");

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold">Group settings</h2>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Only a group owner can manage members or change group settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0 space-y-5">
        <GroupJoinLink groupId={group.id} enabled={Boolean(group.joinEnabled)} archived={group.archived} />
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Group details</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Choose the currency for the group’s accounts. It is fixed after the first expense or repayment.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                startTransition(async () => {
                  const result = await updateGroupAction({
                    groupId: group.id,
                    name,
                    currency
                  });
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  toast.success(result.message);
                  router.refresh();
                });
              }}
            >
              <Field label="Name" htmlFor="settings-group-name">
                <Input
                  id="settings-group-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={group.archived}
                />
              </Field>
              <Field
                label="Currency"
                htmlFor="settings-group-currency"
                hint={
                  group.hasFinancialRecords
                    ? "Currency is locked after the first expense or payment."
                    : "Choose the currency used for every group record."
                }
              >
                <Select
                  id="settings-group-currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  disabled={group.archived || group.hasFinancialRecords}
                >
                  {supportedCurrencies.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <FormMessage message={error} />
              <Button type="submit" disabled={pending || group.archived}>
                {pending ? "Saving..." : "Save settings"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-amber-200">
          <CardHeader>
            <h2 className="text-lg font-semibold">Group history</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Archive first to freeze changes while keeping every record.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!group.archived ? (
              <ConfirmAction
                title={`Archive ${group.name}?`}
                description="Expenses and payments will become read-only. The financial history stays available."
                confirmLabel="Archive group"
                trigger={
                  <Button variant="secondary">
                    <Archive className="h-4 w-4" />
                    Archive group
                  </Button>
                }
                onConfirm={() => archiveGroupAction({ groupId: group.id })}
              />
            ) : (
              <>
                <Badge tone="warning">This group is archived</Badge>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-900">
                    Permanently delete all group data
                  </p>
                  <p className="mt-1 text-xs leading-5 text-red-800">
                    This cannot be undone. Enter the exact group name:{" "}
                    <strong>{group.name}</strong>
                  </p>
                  <Input
                    className="mt-3"
                    value={deleteConfirmation}
                    onChange={(event) => setDeleteConfirmation(event.target.value)}
                    aria-label="Group name deletion confirmation"
                  />
                  <FormMessage message={deleteError} className="mt-3" />
                  <Button
                    type="button"
                    variant="danger"
                    className="mt-3"
                    disabled={deleting}
                    onClick={() =>
                      startDeleting(async () => {
                        const result = await permanentlyDeleteGroupAction({
                          groupId: group.id,
                          confirmation: deleteConfirmation
                        });
                        if (!result.ok) {
                          setDeleteError(result.message);
                          return;
                        }
                        toast.success(result.message);
                        router.push("/groups");
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleting ? "Deleting..." : "Permanently delete"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Members</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Pending people can already be included in expenses.
            </p>
          </div>
          {!group.archived ? <InviteMemberDialog groupId={group.id} /> : null}
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-[var(--border)]">
            {visibleMembers.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] font-semibold text-[var(--primary)]">
                  {member.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{member.name}</p>
                    {member.role === "OWNER" ? <Badge tone="teal">Owner</Badge> : null}
                    {member.status === "INVITED" ? <Badge tone="warning">Pending</Badge> : null}
                  </div>
                  <p className="truncate text-xs text-[var(--ink-subtle)]">{member.email ?? "Guest"}</p>
                  {member.isGuest && member.status === "ACTIVE" ? <GuestRecoveryLink groupId={group.id} memberId={member.id} name={member.name} /> : null}
                  {member.status === "INVITED" && member.invitationDeliveryStatus ? (
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">
                      {member.invitationDeliveryStatus === "FAILED"
                        ? "Email sending failed. Use Resend to try again."
                        : member.invitationDeliveryStatus === "PENDING"
                          ? "Email sending is not yet confirmed. Use Resend if this persists."
                          : member.invitationDeliveryStatus === "DISABLED"
                            ? "Email sending is disabled in this environment."
                            : "Email sent. Waiting for acceptance."}
                    </p>
                  ) : null}
                </div>
                {!group.archived ? (
                  <div className="flex flex-wrap gap-1">
                    {member.status === "INVITED" ? (
                      <>
                        <AsyncButton
                          action={() =>
                            resendInvitationAction({
                              groupId: group.id,
                              memberId: member.id
                            })
                          }
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Resend
                        </AsyncButton>
                        <ConfirmAction
                          title="Revoke invitation?"
                          description={`${member.name} will no longer be able to claim this group place.`}
                          confirmLabel="Revoke"
                          trigger={
                            <Button size="sm" variant="ghost">
                              <Mail className="h-3.5 w-3.5" />
                              Revoke
                            </Button>
                          }
                          onConfirm={() =>
                            revokeInvitationAction({
                              groupId: group.id,
                              memberId: member.id
                            })
                          }
                        />
                      </>
                    ) : member.id !== currentMemberId ? (
                      <>
                        <ConfirmAction
                          title={`Transfer ownership to ${member.name}?`}
                          description="You will become a regular member. The new owner can manage all members and records."
                          confirmLabel="Transfer ownership"
                          trigger={
                            <Button size="sm" variant="ghost">
                              <Shield className="h-3.5 w-3.5" />
                              Make owner
                            </Button>
                          }
                          onConfirm={() =>
                            transferOwnershipAction({
                              groupId: group.id,
                              memberId: member.id
                            })
                          }
                        />
                        <ConfirmAction
                          title={`Remove ${member.name}?`}
                          description="Their past shares remain in balances and history, but their current membership loses access. Disable or replace the joining link to prevent them joining again with it."
                          confirmLabel="Remove member"
                          trigger={
                            <Button size="sm" variant="ghost">
                              <UserMinus className="h-3.5 w-3.5" />
                              Remove
                            </Button>
                          }
                          onConfirm={() =>
                            removeMemberAction({
                              groupId: group.id,
                              memberId: member.id
                            })
                          }
                        />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
