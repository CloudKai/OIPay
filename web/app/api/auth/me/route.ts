import { SupabaseAuthController } from "@/lib/server/auth-controller";

export async function GET() {
  return new SupabaseAuthController().me();
}
