# SplitTogether Repository

This repository now includes a full-stack SplitTogether MVP built with Next.js 14 + Prisma in [`web/`](./web/README.md).

## Run the MVP

```bash
cd web
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Then open `http://localhost:3000`.

## One-command startup (web only)

You can use the helper script from repo root:

```bash
./start-web.zsh
```

Useful options:

```bash
./start-web.zsh --reset-db    # reset DB and seed demo data
./start-web.zsh --port 3001   # run Next.js on a custom port
```

## Legacy folders

- `backend/` and `mobile/` contain earlier project iterations.
