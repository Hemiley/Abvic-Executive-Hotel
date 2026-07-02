# Hotel CMS Admin

A hotel front-desk management system with rooms, reservations, guests, payments, staff shifts, audit logs, and reports.

## Stack

- **Frontend**: React 18 + React Router v6 + Vite
- **Backend**: Express (Node.js) + TypeScript via `tsx`
- **Database**: PostgreSQL (Replit built-in) via Drizzle ORM
- **Auth**: Session-based (`express-session` + `connect-pg-simple`)

## How to run

```
npm run dev
```

Starts the dev server on port 5000 (Express serves both API and Vite frontend).

## Database

Schema is in `shared/schema.ts`. To push schema changes:

```
npm run db:push
```

On first boot, `server/seed.ts` auto-creates an `admin` and `receptionist` account and seeds 7 sample rooms. Credentials are printed to the workflow log on first startup (development only).

## Key files

- `shared/schema.ts` — Drizzle schema + Zod validation types
- `server/index.ts` — Express app entry point
- `server/routes.ts` — API routes
- `server/storage.ts` — DB query layer
- `server/seed.ts` — First-boot seed logic
- `client/src/App.tsx` — React router setup
- `client/src/pages/` — Page components
- `client/src/context/AuthContext.tsx` — Auth state

## Environment secrets

| Secret | Purpose |
|---|---|
| `SESSION_SECRET` | Express session signing |
| `DATABASE_URL` | PostgreSQL connection (auto-set by Replit) |

## User preferences

- Keep existing project structure and stack; do not restructure or migrate.
