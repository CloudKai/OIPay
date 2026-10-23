# OIPay Web

This is the active application: Next.js 16, React 19, TypeScript, Supabase Auth,
PostgreSQL, Prisma 7, Tailwind CSS 4, and Radix UI. Supabase sends authentication
emails through its configured SMTP provider. The app uses Resend for individual
email invitations; shared guest joining links also work without email delivery.

## Development setup

Use Node.js 24 and npm 10 or newer. Configure a dedicated development Supabase
project using [Supabase setup](../docs/supabase-setup.md). From `web/`:

```bash
cp .env.example .env
```

Replace the database, Supabase, site URL, and email placeholders, then run:

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

The root `./start-web.zsh` script performs these steps. A local PostgreSQL server
alone does not provide Supabase authentication. The legacy Docker database on
port 5433 is separate from the isolated test services below.

`npm run prisma:seed` creates sample application data; create authentication
accounts through Supabase Auth. Use seeds only in development or disposable tests.
For existing users from the older custom authentication system, follow the
reviewed `auth:migrate-users -- --confirm` procedure in the Supabase setup guide.

## Verification

```bash
npm run check
```

This runs lint, TypeScript checks, unit tests, and a production build. Database
tests require `RUN_DATABASE_TESTS=true` and a migrated disposable database.
Browser tests use Playwright on desktop and phone-sized Chromium screens.

### Isolated database and authentication tests

With Docker running and the Supabase CLI installed, run from `web/`:

```bash
supabase start
supabase status -o env > .env.supabase-status.local
node scripts/configure-test-env.mjs .env.supabase-status.local
npx playwright install chromium
npm run test:isolated
```

The helper writes ignored `.env.e2e.local` settings without printing credentials.
The isolated runner checks that PostgreSQL is local on port 54322 and Supabase
Auth is local on port 54321, applies committed migrations, then runs database,
unit, and browser tests. It creates a disposable confirmed account and cleans up
its test records. Playwright starts a separate dev server on port 3100.

`web/supabase/config.toml` disables email confirmation for these disposable test
services. Production email delivery and confirmation still need separate checks.
Stop the services with `supabase stop` when finished. The CI workflow uses the
same local service configuration.

For an already running dedicated staging environment, configure
`E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_REQUIRE_AUTH=true`,
`PLAYWRIGHT_BASE_URL`, and `PLAYWRIGHT_EXTERNAL_SERVER=true`, then run
`npm run test:e2e`. These tests create records; use a test account and test group.
Without credentials, authenticated browser flows can be skipped, so a passing
public-page test alone does not verify the full journey.

## Financial and guest behavior

The login page's **Try demo as a guest** button opens `/demo` without an account.
It uses sample members, expenses, and explicitly labelled sample exchange rates.
Expenses, corrections, payments, filters, and balance calculations work locally;
changes survive refresh in this tab's session storage. **Reset demo** restores
the sample trip. Demo records never enter the database or grant access to real
groups, and no database migration or special account is required.

Each group keeps one accounting currency, fixed after its first financial record.
Foreign expenses and repayments save their original amount, confirmed conversion,
reference date, and source. Rates are suggested for the entry day in UTC; the
actual publication date is shown. Saved rates remain unchanged until explicitly
edited. Automatic rates are daily references from [Frankfurter](https://frankfurter.dev/),
and can differ from a bank's execution rate. Manual entry remains available.

Shared joining links accept distinct member names without signup. Browser guest
credentials retain access; typing a previous member's name cannot recover it.
Owner-issued recovery links expire after 24 hours, work once, and replace the
membership's previous browser access. A verified account can claim guest records
from that same browser through the account page. Resolve an existing account
membership or invitation conflict before linking.

## Database changes and release

Use `npm run prisma:migrate` to create development migrations and
`npm run prisma:deploy` to apply committed migrations. Review migrations and use
separate databases for development, staging, and production. Deploy the full
migration chain, including the guest-session privacy migration, before serving
the updated app. See [production operations](../docs/production-operations.md)
for release order, database access rules, email, backups, and live pilot checks.
