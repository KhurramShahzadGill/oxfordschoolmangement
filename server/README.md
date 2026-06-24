# Backend API — School Management System

**Node.js + Express + PostgreSQL.** This is the real backend that replaces the
old browser-only `localStorage` data layer.

```
server/
  db/
    schema.sql        all tables, rules and the money views
    seed.sql          default school, admin, classes and fee heads
  src/
    config/env.js     reads environment variables
    db/
      pool.js         PostgreSQL connection + transaction helper
      migrate.js      sets up the database (schema + seed + admin password)
    middleware/       auth (JWT + roles), validation, error handling
    services/
      feeEngine.js    THE single place all money math happens
    modules/          auth, students, parents, academics, fees (routes + logic)
    app.js            wires all routes together
    server.js         starts the server
```

## How to run it

1. **Install** (done once):
   ```bash
   cd server
   npm install
   ```
2. **Create a database.** Either a local PostgreSQL, or a free cloud one
   (e.g. Supabase). Copy its connection string.
3. **Configure**: copy `.env.example` to `.env` and fill in `DATABASE_URL`,
   a long random `JWT_SECRET`, and `DEFAULT_ADMIN_PASSWORD`.
4. **Set up the tables**:
   ```bash
   npm run migrate        # fresh database
   # or  npm run migrate:fresh   to wipe and rebuild (DEV ONLY)
   ```
5. **Start**:
   ```bash
   npm run dev            # auto-restarts on changes
   # or  npm start
   ```
   API is now at `http://localhost:4000`. Login: `admin@oxford.edu` / your `DEFAULT_ADMIN_PASSWORD`.

## API endpoints

All `/api/*` routes (except login) require a header: `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Log in, returns a token |
| GET  | `/api/auth/me` | Current user |
| GET/POST | `/api/students` | List (filters: class_id, section_id, status, q) / create |
| GET/PUT/DELETE | `/api/students/:id` | Read / update / delete |
| POST | `/api/students/:id/promote` | Promote to a class/section |
| GET  | `/api/students/:id/history` | Promotion/transfer history |
| GET/POST/PUT/DELETE | `/api/parents` (+`/:id`) | Family records (POST = find-or-create by CNIC) |
| GET/POST/PUT/DELETE | `/api/classes` (+`/:id`) | Classes |
| GET/POST/PUT/DELETE | `/api/sections` (+`/:id`) | Sections |
| GET/POST/PUT | `/api/fee-heads` (+`/:id`) | Charge categories |
| GET/PUT | `/api/settings` | School profile |
| GET  | `/api/fees/students/:id/charges` | A student's charges + balances |
| GET  | `/api/fees/students/:id/balance` | A student's total balance |
| GET  | `/api/fees/students/:id/ledger` | Full charges + payments history |
| POST | `/api/fees/students/:id/charges` | Add a one-time/specific charge |
| POST | `/api/fees/students/:id/generate-monthly` | Create monthly tuition dues up to a month |
| POST | `/api/fees/payments` | Record a payment (with allocations) |
| GET  | `/api/fees/report` | Fee report (from, to, class_id, section_id, status) |

## The money model (why bugs stop)

| Table | Meaning |
|-------|---------|
| `charges` | What a student **owes** (one frozen row per due) |
| `payments` | Money **received** |
| `payment_allocations` | Which charge each payment paid (handles part-payments exactly) |

**Balance = total charges − total paid**, computed by the database views
`v_charge_balances` and `v_student_balances`. The fee engine is the only code
that writes money, inside transactions, and the database itself blocks
over-payment and double-billing. So every screen shows the same, correct number.

## Roles

- **admin** — everything, including settings, classes and deleting records
- **accountant** — students, parents, charges and payments
- **teacher** — read access (extend as needed)

## Next phase

**Phase 3** — connect the React frontend: replace `src/services/db.js` with a
small API client that calls these endpoints, and add a real login screen.
