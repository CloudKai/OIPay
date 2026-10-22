import { z } from "zod";

import {
  MAX_AUTH_PASSWORD_LENGTH,
  MIN_AUTH_PASSWORD_LENGTH
} from "@/lib/auth/constants";

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

const authEmail = z.email().transform(normalizeAuthEmail);

export const authPassword = z
  .string()
  .min(
    MIN_AUTH_PASSWORD_LENGTH,
    `Use at least ${MIN_AUTH_PASSWORD_LENGTH} characters.`
  )
  .max(MAX_AUTH_PASSWORD_LENGTH, "Use a shorter password.");

export const registerInputSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(60),
  email: authEmail,
  password: authPassword
});

export const loginInputSchema = z.object({
  email: authEmail,
  password: z.string().min(1, "Enter your password.").max(MAX_AUTH_PASSWORD_LENGTH)
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
