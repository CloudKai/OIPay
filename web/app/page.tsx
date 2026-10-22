import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();

  if (user?.id) {
    redirect("/dashboard");
  }

  redirect("/login");
}
