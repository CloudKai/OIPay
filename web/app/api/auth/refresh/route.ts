import { SupabaseAuthController } from "@/lib/server/auth-controller";

export async function POST() {
  return new SupabaseAuthController().refresh();
}
