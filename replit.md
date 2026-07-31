# Hotel CMS Admin

A hotel front-desk management system with rooms, reservations, guests, payments, staff shifts, audit logs, reports — plus Bar Management, Kitchen Management, and a Security Attendance Portal.

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

## Roles

| Role | Access |
|---|---|
| `admin` | Full system access — hotel + bar + kitchen + security/attendance |
| `receptionist` | Hotel front-desk: bookings, rooms, shifts |
| `supervisor` | Hotel front-desk + audit logs + bar + kitchen |
| `bar_attendant` | Bar portal only: sales, inventory view, shifts |
| `chef` | Kitchen portal only: orders, inventory, shifts |
| `security` | Security portal only: staff sign-in/sign-out |

## Key files

- `shared/schema.ts` — Drizzle schema + Zod validation types (hotel + bar tables)
- `server/index.ts` — Express app entry point
- `server/routes.ts` — API routes (hotel + `/api/bar/*`)
- `server/storage.ts` — DB query layer
- `server/seed.ts` — First-boot seed logic
- `client/src/App.tsx` — React router setup (hotel + bar routes)
- `client/src/pages/` — Hotel page components
- `client/src/pages/bar/` — Bar portal page components
- `client/src/context/AuthContext.tsx` — Auth state

## Bar Management Portal

Accessible at `/bar`. Bar attendants are redirected here automatically after login.
Admins can also access the bar portal via the sidebar link.

### Bar routes

- `/bar` — Dashboard with shift, stock, and sales overview
- `/bar/sales` — POS terminal for recording sales and printing receipts
- `/bar/inventory` — Drink stock management (admin: full CRUD; bar attendant: view)
- `/bar/waiters` — Waiter/waitress roster management
- `/bar/reports` — Sales reports with PDF print, Excel, and CSV export
- `/bar/shifts` — Bar shift history with printable shift summaries

### Bar API endpoints

- `GET/POST/PATCH/DELETE /api/bar/drinks` — Drink inventory
- `GET/POST /api/bar/waiters` — Waiter roster
- `POST /api/bar/shifts/start` — Open a bar shift
- `GET /api/bar/shifts/current` — Current shift
- `GET /api/bar/shifts` — Shift history
- `POST /api/bar/shifts/:id/close` — Close shift (locks it + takes stock snapshot)
- `POST /api/bar/sales` — Record a sale (deducts stock, generates invoice)
- `GET /api/bar/sales` — List sales
- `GET /api/bar/sales/:id` — Sale detail + items
- `GET /api/bar/dashboard` — Attendant dashboard summary
- `GET /api/bar/reports` — Aggregated sales report with date filtering

## Security Attendance Portal

Accessible at `/security-login`. Security officers log in here and are redirected to `/security`.
Admins can also access attendance management via the sidebar.

### Security routes

- `/security-login` — Dedicated login for security personnel
- `/security` — Sign in / sign out staff members (records timestamp automatically)
- `/security/history` — Today's full attendance log with stats
- `/attendance` — Admin: full attendance management with filters, edit, delete, CSV export
- `/attendance/payroll` — Admin: monthly payroll summary per staff member

### Attendance API endpoints

- `POST /api/attendance/sign-in` — Sign in a staff member (security/admin)
- `POST /api/attendance/:id/sign-out` — Sign out (auto-calculates hours)
- `GET /api/attendance` — List with filters (date, branch, status, name, position)
- `PATCH /api/attendance/:id` — Edit record (admin only)
- `DELETE /api/attendance/:id` — Delete record (admin only)
- `GET /api/attendance/export` — CSV export data (admin only)
- `GET /api/attendance/payroll/summary` — Monthly hours summary (admin only)

### Features
- Duplicate sign-in prevention (same name + branch + date)
- Server-side timestamps (sign-in and sign-out)
- Auto-calculated total hours on sign-out
- Full audit log of all attendance actions

## Environment secrets

| Secret | Purpose |
|---|---|
| `SESSION_SECRET` | Express session signing |
| `DATABASE_URL` | PostgreSQL connection (auto-set by Replit) |

## User preferences

- Keep existing project structure and stack; do not restructure or migrate.
