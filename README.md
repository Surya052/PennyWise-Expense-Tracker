# PennyWise

Track every rupee: expenses, income and investments in one calm place.

Mobile-first multi-user expense tracker (React + NestJS + Postgres). Installable PWA.

**Project folder:** `C:\Users\ADMIN\Desktop\PennyWise`

## Quick start

1. Copy `.env.example` to `apps/api/.env` and set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (must include upper, lower, and a digit, 8+ chars).

2. From this folder:

```bash
npm install
cd apps/api
npx prisma migrate deploy
npm run seed
cd ../..
npm run dev
```

3. Open http://localhost:5173 and sign in with your admin email.

- API: port 3000  
- Web: port 5173 (proxies `/api` to the API)  
- Production: `npm run build` then `npm run start` — Nest serves the built PWA from `apps/web/dist`.

## Stack

- **API:** NestJS, Prisma, Postgres (`BigInt` paise)
- **Web:** React, Vite, Tailwind, Chart.js, vite-plugin-pwa
- **Auth:** httpOnly session cookie; admin creates users (no public signup)

## Tests

```bash
npm test
```

## Database

Set `DATABASE_URL` in `apps/api/.env` to your Postgres connection string (Supabase works). Then run `npx prisma migrate deploy` and `npm run seed` from `apps/api`.

## Architecture

```
PennyWise/
  apps/api/     NestJS + Prisma + business services
  apps/web/     Vite React PWA
  docs/SPEC.md  Product source of truth
```
