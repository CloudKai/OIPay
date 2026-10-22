# Deploy the pilot to your existing Vercel project

Use the existing project you choose. No application has been deployed by this session.

## Local verification

Verified on 2026-10-23 with Node.js 24: lint, TypeScript checks, 154 unit/database tests (including simultaneous-write checks), a production build, and all twelve desktop/phone browser tests. The browser journeys cover guest joining, duplicate-name rejection, foreign expenses, manual-rate repayment fallback, personal currency display, owner/creator editing controls, recovery, account linking, and accessibility checks for login, guest joining, and conversion forms. Demo checks also cover account-free entry, expense edits, filters, repayments, sample conversions, refresh, reset, damaged storage, and unchanged access to real groups.

The local preview is available at `http://127.0.0.1:3100` while its server and isolated Supabase services are running. It uses a separate local test database and local authentication, not the hosted Supabase project. You can create a local account there to try the app. This local configuration skips production email delivery and confirmation, so it is not evidence that hosted signup emails work.

For an account-free presentation, choose **Try demo as a guest** on the login page, or open `/demo`. This interactive sample group stores its changes only in the current browser tab. Its currency rates are labelled illustrative. Use **Reset demo** before another walkthrough. This feature needs no database migration or demo login credentials.

## What has already been prepared

The existing **SplitTogether** Supabase project (`wucwusyxrgatwioowfah`, Singapore region) was restored from its paused state and reported healthy. Its public application tables were empty when inspected. Its schema now includes login rate limiting, recoverable account deletion, invitation sending status, guest sessions and recovery, distinct member names, and saved currency conversions. Guest credentials are protected by row-level security and cannot be read with public API keys.

The database updates were applied through Supabase's migration system, as the project's existing tables had been. This project has no Prisma migration history table. Do **not** run the old initial Prisma migrations against it: reconcile/baseline the migration history first. The ordinary Vercel build runs `npm run build`; it does not replay database migrations or seed demo records.

## Existing Vercel project settings

In your existing project's settings:

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root directory, if uploading this whole repository | `web` |
| Root directory, if uploading only the contents of `web/` | leave empty |
| Node.js | 24.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | framework default |

Upload/connect the current source, including `web/prisma/`, `web/package-lock.json`, and `web/vercel.json`. Exclude `.env*` files, `node_modules`, build outputs, and test screenshots. Use the environment settings below rather than uploading local credentials.

## Environment variables

Set these in the existing project's **Production** environment. Use separate database/auth projects for previews if enabling preview deployments.

| Variable | Where the value comes from |
| --- | --- |
| `DATABASE_URL` | Supabase **Connect → Transaction pooler**, port 6543, with the database password and SSL enabled |
| `DIRECT_DATABASE_URL` | Supabase **Connect → Session pooler**, port 5432, with the same password; needed for migration operations |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wucwusyxrgatwioowfah.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project's API settings → publishable key |
| `SUPABASE_SECRET_KEY` | Supabase project's API settings → server-only secret key; used for account-deletion recovery |
| `NEXT_PUBLIC_SITE_URL` | Your existing project's final HTTPS app URL |
| `AUTH_RATE_LIMIT_SECRET` | A unique random server-only value of at least 32 characters |
| `CRON_SECRET` | Another unique random server-only value of at least 32 characters |
| `RESEND_API_KEY` | Your Resend account's sending key |
| `EMAIL_FROM` | A sender on your verified sending domain, e.g. `SplitTogether <no-reply@your-domain>` |
| `EMAIL_DELIVERY_MODE` | `resend` |
| `NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED` | `false` unless Google has been configured in Supabase |

Never paste database passwords or server keys into chat. Enter them directly in Vercel. Do not copy the isolated `.env.e2e.local` settings: they are only for tests on this computer.

Automatic currency suggestions require no API key. They show the publication day and permit a bank-rate override or manual entry when unavailable. Display equivalents are estimates; group debts stay in the group currency.

## Authentication and email

Follow [Supabase setup](./supabase-setup.md) for confirmation/reset email templates, custom SMTP, and redirect URLs. Set the Supabase Site URL and allowed production redirects to the final app URL. Keep email confirmation enabled. Verify delivery to a real test address; local tests do not prove production SMTP delivery.

Group owners can share joining links without sending invitation emails. Individual email invitations still require the Resend settings above. Supabase authentication emails use the SMTP settings in Supabase, independently of the app's Resend setting.

## Before inviting testers

Deploy, then visit `/api/health` on your app and check that it reports healthy database connectivity and configured authentication. Run the real owner/guest journey on phone and computer: sign up, confirm email, create a group, create a joining link, join by name in another browser, enter a foreign expense, record a partial repayment, recover guest access, and link a guest to an account.

Check backups and restore capability, production email delivery, error monitoring, and the daily account-deletion recovery job using [production operations](./production-operations.md). These external service settings and the live deployment still require verification; local passing tests do not establish them.

## Hosting setup note

An empty project named `project-gbmqo` was created in Vercel before the owner clarified that an existing project should be used. It has no deployment and was left untouched after that clarification. It is not the app's deployment destination.
