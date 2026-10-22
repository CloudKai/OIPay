# SplitTogether

SplitTogether is a shared-expense web app for groups. It supports equal, exact,
percentage, and weighted-share splits; simplified debts; partial payments;
invitations; and activity history.

## Active product

`web/` is the only active application. It uses Next.js 16, React 19, Supabase
Auth, Supabase Postgres, Prisma 7, Tailwind CSS 4, and Radix UI.

`backend/` and `mobile/` are archived prototypes.

## Start

Requirements: Node.js 24, npm 10+, and a dedicated Supabase project.

```bash
cp web/.env.example web/.env
./start-web.zsh
```

Open `http://localhost:3000`.

See [`docs/supabase-setup.md`](./docs/supabase-setup.md) for the one-time
database, authentication, email, and Google setup.

Common commands:

```bash
npm run build
npm run dev
npm test
```
