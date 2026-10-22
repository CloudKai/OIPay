"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/result";
import {
  ActionFailure,
  publicActionError
} from "@/lib/server/authz";
import { getAuthContext } from "@/lib/session";
import { processAccountDeletion, requestAccountDeletion } from "@/lib/server/account-deletion";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateProfileSchema, zodFieldErrors } from "@/lib/validation";

export async function updateProfileAction(
  input: unknown
): Promise<ActionResult<{ name: string }>> {
  try {
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new ActionFailure("Check your profile details.", zodFieldErrors(parsed.error));
    }
    const context = await getAuthContext();
    if (!context) throw new ActionFailure("Your session expired.");

    const supabase = await createSupabaseServerClient();
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        full_name: parsed.data.name,
        name: parsed.data.name
      }
    });
    if (authError) {
      throw new ActionFailure("Your profile could not be updated.");
    }

    const { user } = context;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { name: parsed.data.name }
      });

    });
    revalidatePath("/account");
    revalidatePath("/dashboard");
    revalidatePath("/groups");
    return {
      ok: true,
      data: { name: parsed.data.name },
      message: "Profile updated."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function revokeOtherSessionsAction(): Promise<
  ActionResult<{ revoked: true }>
> {
  try {
    const context = await getAuthContext();
    if (!context) throw new ActionFailure("Your session expired.");

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) {
      throw new ActionFailure("Other sessions could not be signed out.");
    }

    return {
      ok: true,
      data: { revoked: true },
      message: "Other sessions were signed out."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function deleteAccountAction(input: {
  confirmation: string;
}): Promise<ActionResult<{ deleted: true }>> {
  try {
    const context = await getAuthContext();
    if (!context) throw new ActionFailure("Your session expired.");
    const { authUser, user } = context;

    if (input.confirmation !== "DELETE") {
      throw new ActionFailure('Enter "DELETE" to confirm account deletion.');
    }

    await requestAccountDeletion(user.id, authUser.id);
    // App cleanup and the recovery job have committed together. Even if the
    // provider or this request fails, a scheduled worker can finish the job.
    const completed = await processAccountDeletion(authUser.id).catch(() => false);

    return {
      ok: true,
      data: { deleted: true },
      message: completed
        ? "Your account was deleted."
        : "Your profile is deleted. We are finishing your account removal automatically."
    };
  } catch (error) {
    return publicActionError(error);
  }
}
