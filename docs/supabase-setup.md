# Supabase Setup

OIPay uses Supabase Auth for login and Supabase Postgres for application
data. Prisma remains the server-side database client.

## 1. Create a project

Create a dedicated Supabase project for OIPay. Do not reuse a project
that belongs to another application.

From the project's **Connect** dialog, collect:

- the transaction pooler connection string for `DATABASE_URL`;
- the session pooler or direct connection string for `DIRECT_DATABASE_URL`;
- the project URL;
- a publishable key (`sb_publishable_...`);
- a server-only secret key (`sb_secret_...`).

Copy `web/.env.example` to `web/.env` and replace every placeholder.
Set `AUTH_RATE_LIMIT_SECRET` to a long random value in every deployed
environment. OIPay uses it only on the server to hash login rate-limit
buckets before they are stored in Postgres.

## 2. Apply the database migrations

From `web/`:

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
```

The Supabase migration removes the old custom password/session tables, adds a
Supabase identity link to each app user, enables Row Level Security on the
financial tables, and removes Data API access for `anon` and `authenticated`.
The app reads financial data only through trusted Next.js server code.

The app also includes a private `AuthRateLimit` table for brute-force
protection on `/api/auth/login`. It stores hashed buckets and counters only,
not raw emails, IP addresses, passwords, JWTs, or refresh tokens.

Existing users keep their groups and expenses. Existing custom password hashes
cannot be moved. After SMTP and the invite template are configured, run:

```bash
npm run auth:migrate-users -- --confirm
```

This links users who already exist in Supabase Auth and emails a secure
set-password invitation to everyone else. Test it in staging before production.

## 3. Configure Auth URLs

In **Authentication > URL Configuration**:

- Site URL: the deployed app URL, such as `https://split.example.com`
- Redirect URLs:
  - `http://localhost:3000/**`
  - the production URL followed by `/**`
  - each trusted preview or staging URL followed by `/**`

Set `NEXT_PUBLIC_SITE_URL` to the same app origin in each environment.

In **Authentication > Password Security**, set the minimum password length to
10 characters. If the project plan supports it, enable leaked password
protection as well.

In **Authentication > Rate Limits**, keep Supabase's built-in auth limits
enabled. OIPay also enforces an app-side login limiter before calling
Supabase Auth.

## 4. Configure email templates

Supabase SSR uses a secure token-hash exchange. In **Authentication > Email
Templates**, use these links.

Confirm signup:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">
  Confirm email address
</a>
```

Reset password:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}">
  Reset password
</a>
```

Invite user:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next={{ .RedirectTo }}">
  Set up your OIPay login
</a>
```

Disable click tracking for authentication email links. Link rewriting can make
single-use verification links fail.

## 5. Configure email delivery

Supabase's default SMTP service is for development only and sends only to
pre-authorized project-team addresses. In **Authentication > SMTP Settings**,
configure Resend or another SMTP provider before testing with real users.

For Resend, verify a sending domain and use a dedicated authentication sender
such as `no-reply@auth.example.com`. Keep `RESEND_API_KEY` in the app as well
only if OIPay group invitations should be sent.

## 6. Optional Google sign-in

1. Create a Google Web OAuth client.
2. Use `https://PROJECT_REF.supabase.co/auth/v1/callback` as Google's redirect
   URI.
3. Add the Google client ID and secret in **Authentication > Providers**.
4. Set `NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED=true` in the app.
5. Enable manual identity linking if the Account page should link Google to an
   existing password account.

## 7. Verify

Create a new account with an address your SMTP provider can deliver to, confirm
the email, sign in, request a password reset, and complete the reset.

Then run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
