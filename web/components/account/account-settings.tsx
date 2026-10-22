"use client";

import {
  Download,
  KeyRound,
  Link2,
  LogOut,
  ShieldCheck,
  Trash2,
  UserRound
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteAccountAction,
  revokeOtherSessionsAction,
  updateProfileAction
} from "@/app/actions/account";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { MIN_AUTH_PASSWORD_LENGTH } from "@/lib/auth/constants";
import { authClient } from "@/lib/auth-client";

export default function AccountSettings({
  user,
  hasPassword,
  googleLinked,
  googleEnabled
}: {
  user: { name: string; email: string; emailVerified: boolean };
  hasPassword: boolean;
  googleLinked: boolean;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const auth = useAuth();
  const [name, setName] = useState(user.name);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profilePending, startProfile] = useTransition();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordPending, startPassword] = useTransition();
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDelete] = useTransition();
  const [sessionsPending, startSessions] = useTransition();

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <Card>
          <CardHeader className="flex flex-row items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-muted)]">
              <UserRound className="h-5 w-5 text-[var(--primary)]" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Profile</h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                Used for your account and new groups. Existing groups keep your chosen member name.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setProfileError(null);
                startProfile(async () => {
                  const result = await updateProfileAction({ name });
                  if (!result.ok) {
                    setProfileError(result.message);
                    return;
                  }
                  if (auth.user) {
                    auth.setUser({ ...auth.user, name: result.data.name });
                  }
                  toast.success(result.message);
                  router.refresh();
                });
              }}
            >
              <Field label="Name" htmlFor="profile-name">
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label="Email" htmlFor="profile-email">
                <Input id="profile-email" value={user.email} disabled />
              </Field>
              <div>
                <Badge tone={user.emailVerified ? "positive" : "warning"}>
                  {user.emailVerified ? "Email verified" : "Verification pending"}
                </Badge>
              </div>
              <FormMessage message={profileError} />
              <Button type="submit" disabled={profilePending}>
                {profilePending ? "Saving..." : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-muted)]">
              <KeyRound className="h-5 w-5 text-[var(--primary)]" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Password</h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                Changing it signs out your other sessions.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {hasPassword ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setPasswordError(null);
                  startPassword(async () => {
                    if (newPassword.length < MIN_AUTH_PASSWORD_LENGTH) {
                      setPasswordError(
                        `Use at least ${MIN_AUTH_PASSWORD_LENGTH} characters.`
                      );
                      return;
                    }
                    if (newPassword !== confirmPassword) {
                      setPasswordError("The passwords do not match.");
                      return;
                    }
                    const result = await authClient.updatePassword(newPassword);
                    if (result.error) {
                      setPasswordError(
                        "The password could not be changed. Sign in again and retry."
                      );
                      return;
                    }
                    setNewPassword("");
                    setConfirmPassword("");
                    toast.success("Password changed.");
                  });
                }}
              >
                <Field
                  label="New password"
                  htmlFor="new-password"
                  hint={`Use at least ${MIN_AUTH_PASSWORD_LENGTH} characters.`}
                >
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={MIN_AUTH_PASSWORD_LENGTH}
                    autoComplete="new-password"
                  />
                </Field>
                <Field
                  label="Confirm new password"
                  htmlFor="confirm-new-password"
                >
                  <Input
                    id="confirm-new-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={MIN_AUTH_PASSWORD_LENGTH}
                    autoComplete="new-password"
                  />
                </Field>
                <FormMessage message={passwordError} />
                <Button type="submit" disabled={passwordPending}>
                  {passwordPending ? "Changing..." : "Change password"}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">
                This account currently signs in through a linked provider.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader className="flex flex-row items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-muted)]">
              <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Security and access</h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                Control access on your other browsers and devices.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="secondary"
              disabled={sessionsPending}
              onClick={() =>
                startSessions(async () => {
                  const result = await revokeOtherSessionsAction();
                  if (result.ok) {
                    toast.success(result.message);
                    router.refresh();
                  } else {
                    toast.error(result.message);
                  }
                })
              }
            >
              <LogOut className="h-4 w-4" />
              {sessionsPending ? "Signing out..." : "Sign out other sessions"}
            </Button>
            {googleEnabled ? (
              googleLinked ? (
                <div className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
                  <Link2 className="h-4 w-4 text-[var(--positive)]" />
                  Google account linked
                </div>
              ) : (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const result = await authClient.linkGoogle();
                    if (result.error) {
                      toast.error("Google account linking could not be started.");
                    }
                  }}
                >
                  <Link2 className="h-4 w-4" />
                  Link Google account
                </Button>
              )
            ) : (
              <p className="text-xs text-[var(--ink-subtle)]">
                Google sign-in becomes available after its production credentials
                are configured.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Your data</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Download the account and group records connected to you.
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <a href="/api/account/export" download>
                <Download className="h-4 w-4" />
                Export my data
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <h2 className="text-lg font-semibold text-red-900">Delete account</h2>
            <p className="mt-1 text-sm leading-6 text-red-800">
              Your profile and membership details are removed. Shared expenses,
              notes, and activity history remain available to other group members.
              Transfer any group you solely own first.
            </p>
          </CardHeader>
          <CardContent>
            <Field
              label='Enter "DELETE" to confirm'
              htmlFor="delete-account-confirmation"
            >
              <Input
                id="delete-account-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
            <FormMessage message={deleteError} className="mt-3" />
            <Button
              variant="danger"
              className="mt-4"
              disabled={deletePending}
              onClick={() =>
                startDelete(async () => {
                  const result = await deleteAccountAction({ confirmation });
                  if (!result.ok) {
                    setDeleteError(result.message);
                    return;
                  }
                  toast.success(result.message);
                  try {
                    await auth.signOut();
                  } finally {
                    router.replace("/login");
                    router.refresh();
                  }
                })
              }
            >
              <Trash2 className="h-4 w-4" />
              {deletePending ? "Deleting..." : "Delete my account"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
