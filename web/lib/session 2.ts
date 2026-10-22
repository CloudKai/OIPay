import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

export async function requireSessionUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session.user;
}

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}
