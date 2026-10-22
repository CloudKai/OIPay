import { type NextRequest } from "next/server";

import { SupabaseAuthController } from "@/lib/server/auth-controller";

export async function POST(request: NextRequest) {
  return new SupabaseAuthController().login(request);
}
