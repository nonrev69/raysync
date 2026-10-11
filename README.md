# RaySync — Solar O&M Automation

A lightweight, self-hosted web app for managing solar farm operations and maintenance
workflows: quoting, purchase orders, invoicing, and payment reconciliation.

Built for **Sum Ltd** (solar O&M main contractor) and its client **Low Carbon**.

---

## What it does

| Area | Capability |
|---|---|
| **Quoting** | Build multi-service quotes across many sites, with live MW-based pricing and margin |
| **Quotes → Jobs** | Accept a quote and either split it into one job per line, or keep it as a single combined job |
| **Jobs** | Track each operation through `Quoted → PO Received → Subbie Notified → Works Complete → Invoiced → Paid → Closed` |
| **Reconciliation** | Match incoming BACS payments against outstanding invoices; track subcontractor invoices and flag discrepancies |
| **Calendar** | Month view of authorised work |
| **Dashboard** | Revenue, outstanding balance, VAT liability, kanban pipeline, monthly revenue chart |
| **Settings** | Sites, services, business entities, subcontractors, contact matrix, rate overrides, users |

### Business rules enforced

- **The client PO number is mandatory on every outbound invoice** — it is carried from quote acceptance through to the job record.
- **Client and subcontractor data are kept separate** — the contact matrix routes emails by business entity × job category so the wrong party can never be copied in.

---

## Requirements

- **Node.js 22.5 or newer** (uses the built-in `node:sqlite` — no native build step, no compiler needed)
- ~100 MB disk, ~80 MB RAM idle

No database server, no Docker, no external services.

---

## Quick start

```bash
# 1. Backend
cd server
npm install
npm run dev            # http://localhost:3030

# 2. Frontend (separate terminal)
cd client
npm install
npm run dev            # http://localhost:3080
```

Open **http://localhost:3080** and log in:

```
username: admin
password: admin123
```

> **Change this password immediately** in Settings → Users.

### Optional: demo data

```bash
cd server
npm run seed           # ~42 realistic jobs across all statuses
```

---

## Production deployment (Linux VPS)

The app is deliberately tiny. Two options:

### Option A — single service (simplest)

```bash
cd client && npm install && npm run build     # emits client/dist
cd ../server && npm install && npm run build  # emits server/dist
```

Serve `client/dist` as static files and run `node server/dist/index.js` behind nginx.

### Option B — pm2

`ecosystem.config.cjs` is included:

```bash
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

### Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3030` | API port |
| `DB_PATH` | `server/data.db` | SQLite file location — put this on backed-up storage |
| `JWT_SECRET` | dev fallback | **Set this in production.** Any long random string. |

Example:

```bash
export JWT_SECRET="$(head -c 48 /dev/urandom | base64)"
export DB_PATH=/var/lib/raysync/data.db
```

### Backups

The entire dataset is a single SQLite file. To back up:

```bash
sqlite3 "$DB_PATH" ".backup /backups/raysync-$(date +%F).db"
```

---

## Architecture

```
jake-app/
├── client/                 React 19 + TypeScript + Vite
│   └── src/
│       ├── App.tsx         Shell, tabs, session
│       ├── api.ts          Typed API client (fetch)
│       ├── design.css      Design tokens (light + dark)
│       ├── App.css         Component styles
│       └── components/     Dashboard, QuoteBuilder, Jobs, Reconciliation, …
└── server/                 Express + TypeScript
    └── src/
        ├── index.ts        App entry, route wiring
        ├── db.ts           Schema + seed data (node:sqlite)
        ├── crypto.ts       scrypt hashing + HMAC session tokens
        └── routes/         auth, masterData, jobs, quotes, dashboard
```

### Deliberately minimal dependencies

| | Runtime deps |
|---|---|
| Server | `express`, `cors` — **2** |
| Client | `react`, `react-dom` — **2** |

Everything else is built on the platform:

- **Passwords** — `node:crypto` scrypt (memory-hard, native)
- **Sessions** — HMAC-SHA256 signed tokens with expiry
- **Database** — `node:sqlite` (built into Node 22.5+)
- **Icons** — inline SVG
- **Charts** — hand-rolled SVG

Production bundle: **~79 KB gzipped**. Zero known npm vulnerabilities.

---

## API overview

All routes except `/api/auth/login` require `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Obtain a session token |
| `GET` | `/api/auth/me` | Current user |
| `GET/POST/PUT/DELETE` | `/api/sites`, `/api/services`, `/api/entities`, `/api/subcontractors` | Master data |
| `GET/PUT` | `/api/contact-matrix` | Email routing rules |
| `GET/POST/PUT/DELETE` | `/api/rate-overrides` | Per-site pricing overrides |
| `GET/POST/PUT/DELETE` | `/api/jobs` | Jobs / operations |
| `GET/POST/PUT/DELETE` | `/api/quotes` | Multi-service quotes |
| `POST` | `/api/quotes/:id/accept` | Convert a quote into jobs |
| `GET` | `/api/dashboard/dashboard` | Dashboard aggregates |

---

## Roles

| Role | Can |
|---|---|
| `admin` | Everything, including deletes and user management |
| `editor` | Create and update records |
| `viewer` | Read only |

---

## Licence

Proprietary — © Sum Ltd.
