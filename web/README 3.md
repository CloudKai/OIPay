# OIPay Web

This is the active OIPay product.

## Stack

- Next.js 16 and React 19
- Supabase Auth and Supabase Postgres
- Prisma 7 for server-side business queries
- Resend for group invitation email
- Tailwind CSS 4 and Radix UI

Authentication includes email confirmation, password recovery, Google OAuth,
linked identities, cookie-based sessions, session revocation, and account
deletion.

## Setup

Use Node.js 24 and npm 10 or newer.

```bash
cp .env.example .env
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

The required Supabase project, environment variables, email templates, SMTP,
and Google provider steps are documented in
[`../docs/supabase-setup.md`](../docs/supabase-setup.md).

`npm run prisma:seed` adds sample business data only. Authentication users are
created through Supabase Auth, not the seed script.

For an existing Better Auth database, use the reviewed one-time migration:

```bash
npm run auth:migrate-users -- --confirm
```

## Verification

```bash
npm run lint
npm run typecheck
npm test
RUN_DATABASE_TESTS=true npm test
npm run build
E2E_USER_EMAIL="user@example.com" E2E_USER_PASSWORD="..." npm run test:e2e
npm audit
```

The database suite requires a migrated test database. The authenticated
Playwright flow requires a dedicated Supabase test user.

## Database changes

Create and deploy reviewed Prisma migrations:

```bash
npm run prisma:migrate
npm run prisma:deploy
```

Never use `prisma db push` for staging or production.

Deploy `web/` as the Vercel project root and use separate Supabase projects for
development, staging, and production.
