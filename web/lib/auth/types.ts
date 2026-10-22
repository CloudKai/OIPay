export interface PublicAuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
}

export interface AuthApiPayload {
  user?: PublicAuthUser | null;
  message?: string;
  requiresEmailConfirmation?: boolean;
  retryAfterSeconds?: number;
  fieldErrors?: Record<string, string[]>;
}
