# OIPay

OIPay helps friends, couples, housemates, and travel groups track shared
expenses and record repayments. Payments happen through your usual bank, cash,
or payment app; OIPay keeps the group's records and balances.

The active application is `web/`: Next.js 16, React 19, TypeScript, Supabase
Auth, PostgreSQL, Prisma 7, Tailwind CSS 4, and Radix UI. `backend/` and `mobile/`
are archived prototypes.

## What the app supports

- Equal, exact, percentage, and weighted-share splits, with partial repayments.
- Account owners create groups; invitees can join a shared link with a distinct
  name and return in the same browser without an account.
- Owners can replace joining links, remove members, and issue private guest
  recovery links. Guests can link their records to a verified account later.
- Optional foreign-currency expenses and repayments retain their original amount
  and confirmed rate. Personal display conversion leaves recorded debts unchanged.
- Creator-or-owner corrections, activity history, account recovery, export,
  and deletion.

The target release is a private pilot for invited testers. Local checks and a
successful build do not establish that a live deployment, real email delivery,
production backups, or monitoring have been configured.

## Start the app

Use Node.js 24 and npm 10 or newer. First follow
[Supabase setup](docs/supabase-setup.md) to configure a development project,
database connections, authentication, and email.

```bash
cp web/.env.example web/.env
```

Replace the placeholders in `web/.env`, then run:

```bash
./start-web.zsh
```

The script installs locked dependencies, generates the database client, applies
committed migrations, and starts the app, normally at `http://localhost:3000`.
`./dev.sh` calls the same script. Existing NextAuth settings alone are insufficient
for the current Supabase authentication flow.

## Verify or release

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

See [web development and isolated browser tests](web/README.md), the
[architecture guide](docs/OIPay_Fullstack_Guide.md), and the
[pilot deployment checklist](docs/production-operations.md). The confirmed product
scope is in [docs/product-scope.md](docs/product-scope.md).

The root `vercel.json` deploys `web` publicly and the archived Django `backend`
internally in one existing Vercel project. See [multi-service deployment](docs/vercel-services.md)
for project settings and `vercel dev` checks.
