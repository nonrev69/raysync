# RaySync — Build Handover & Test Brief

**Document purpose:** hand this project to another agent/model to verify by testing.
Read this file first. Everything below has been verified against the actual code, not assumed.

---

## 1. Build version

| Field | Value |
|---|---|
| **Version** | `1.1.0` |
| **Release name** | Multi-service quoting + low-footprint build |
| **Build date** | 2026-10-11 |
| **Git branch** | `master` |
| **HEAD commit** | `094d91f` — *docs: handover README + production deployment guide* |
| **Remote** | https://github.com/nonrev69/raysync (public) |
| **Working tree** | clean, in sync with `origin/master` |

### Commit history

| Commit | Summary |
|---|---|
| `34a88b9` | Initial commit: RaySync full-stack application |
| `8372d81` | feat: UI/UX overhaul + critical fixes |
| `7643d99` | perf: strip to minimal deps + multi-service quoting |
| `094d91f` | docs: handover README + production deployment guide |

### Measured build facts (do not trust — re-measure)

| Metric | Value | How to verify |
|---|---|---|
| Server runtime deps | **2** (`express`, `cors`) | `server/package.json` |
| Client runtime deps | **2** (`react`, `react-dom`) | `client/package.json` |
| npm vulnerabilities | **0** | `npm audit` in both dirs |
| Production bundle | **~79 KB gzipped** | `cd client && npm run build` |
| Source size | 5,657 lines across 27 files | `find client/src server/src -type f` |
| Client `node_modules` | 24 packages | `ls client/node_modules \| wc -l` |

---

## 2. What this project is

**RaySync** — a self-hosted web app automating solar farm operations & maintenance for
**Sum Ltd** (an O&M main contractor), whose sole client is **Low Carbon (LC)**.

The manual process it replaces: QuickBooks quotes, Excel spreadsheets, email chains, and
local folder structures — roughly 100 separately-invoiced processes a year.

### The core workflow

```
Client request → Quote → Client PO → Subcontractor PO → Works complete
              → Client invoice → Payment received → Reconcile → Pay subbie → Closed
```

Job status machine:
`Quoted → PO Received → Subbie Notified → Works Complete → Invoiced → Paid → Closed`

### Two non-negotiable business rules

1. **The LC PO number must appear on every outbound client invoice.** Invoices are rejected
   without it. The PO is carried from quote acceptance through to the job record.
2. **Client and subcontractor data must never cross.** The "contact matrix" routes emails by
   *business entity × job category* so the wrong party can't be copied in. (This is the
   owner's stated biggest fear — losing margin to a client going direct to a subbie.)

---

## 3. How to run it

**Requires Node.js ≥ 22.5** (uses the built-in `node:sqlite` — no compiler, no native build).
Verified running on Node v26.7.0.

```bash
# Terminal 1 — backend
cd server
npm install
npm run dev                 # http://localhost:3030

# Terminal 2 — frontend
cd client
npm install
npm run dev                 # http://localhost:3080
```

Open **http://localhost:3080**

| Credential | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |

Optional demo data (42 jobs across all 7 statuses, 14 months of history):

```bash
cd server && npm run seed
```

> **Note on Windows:** running the *compiled* server (`node dist/index.js`) in a non-TTY
> background process fails with `stdin is not a tty`. Redirect stdin (`< /dev/null`) or run
> it in a real terminal. Not an issue on Linux.

---

## 4. Test checklist

Each item is independently verifiable. **Report actual observed results, not expectations.**

### 4.1 Authentication

| # | Action | Expected |
|---|---|---|
| 1 | Log in with `admin` / `admin123` | Success; toast "Welcome back…"; dashboard loads |
| 2 | Log in with a wrong password | "Invalid credentials", no token stored |
| 3 | Log in 5× rapidly in succession | **All 5 succeed.** (A previous deterministic-token bug caused `UNIQUE constraint failed: sessions.token` — this is the regression test.) |
| 4 | Refresh the page while logged in | Session persists (token in `localStorage`) |
| 5 | Log out | Returns to login; toast "You have been logged out" |

### 4.2 Multi-service quoting ← *primary new feature*

| # | Action | Expected |
|---|---|---|
| 6 | Quotes tab → **New Quote** | Builder opens with one empty line |
| 7 | Pick a business entity | Required before saving |
| 8 | Add 3 lines (vary site *and* service) | Each line shows MW, client £/MW, line amount, margin |
| 9 | Watch the totals strip | Subbie cost / Total / Margin update live |
| 10 | Toggle **Split** vs **Combined** | Helper text under the toggle changes to explain the consequence |
| 11 | Create the quote | Toast with quote ref (e.g. `Q-2026-0001`) and total; appears in the list |
| 12 | Open the quote | Modal lists all lines with per-line amounts |
| 13 | Accept with **Split** + a PO number | Toast: "N jobs created"; **one job per line** appears in Jobs, **all sharing that PO** |
| 14 | Repeat 6–13 with **Combined** | **Exactly one job** created for the whole quote; line summary folded into the job notes |
| 15 | Accept an already-accepted quote | Rejected with "Quote already accepted" |

### 4.3 Maintenance schedule ← *new: planned work*

This is the "schedule, not the job" layer. Recurring plans model predictable work
(grass cutting monthly through the growing season, thermographic surveys annually) so
seasonal work is planned and quoted up front instead of arriving as a surprise text.

| # | Action | Expected |
|---|---|---|
| 16 | Schedule tab | 11 seeded plans; helper text explains the purpose |
| 17 | Step the month picker to **Jun 2027** | 10 jobs due across 3 client entities, £43,150 |
| 18 | Read the "Why due" column | Each line states its reason (e.g. "Never scheduled before") |
| 19 | Step to **Oct 2027** | Only 3 due — quarterly panel cleaning + the annual autumn hedge cut |
| 20 | Step to **Jan 2027** | Nothing due — outside every season window (grass cutting is Apr–Sep) |
| 21 | Generate for **Jun 2027** | Toast: 3 draft quotes created; they appear in the **Quotes** tab as `Draft` |
| 22 | **Generate Jun 2027 a second time** | **"Nothing due" / 0 created.** Regression test — see note below. |
| 23 | Step to **Jul 2027** | Only the 5 monthly grass-cutting jobs are due — quarterly work must NOT re-fire |
| 24 | Step to **Sep 2027** | Quarterly panel cleaning IS due again (3 months after June) |
| 25 | Accept one generated quote (Quotes tab) with a PO | Jobs created, all carrying that PO |
| 26 | Add a new schedule (site + service + frequency + season) | Appears in the list |
| 27 | Set a plan inactive, then preview that month | The inactive plan no longer appears as due |

> **Regression note (test 22):** the generator originally stamped `last_generated_date`
> with wall-clock "now" instead of the scheduled period, so a plan looked overdue the
> instant it was generated — generating June twice produced duplicate quotes. The stamp is
> now the first of the *scheduled* month. Verify this holds.

### 4.4 Jobs & pipeline

| # | Action | Expected |
|---|---|---|
| 16 | Jobs tab → change a job's status | Status updates; date fields stamp automatically |
| 17 | Edit a job (PO, invoice no., links, notes) | Values persist after save |
| 18 | Filter jobs by status | Table filters correctly |

### 4.5 Dashboard

| # | Action | Expected |
|---|---|---|
| 19 | Load dashboard with seeded data | Stat cards populated; kanban shows jobs per column |
| 20 | Inspect the Monthly Revenue chart | SVG area chart renders — **must not crash** (recharts was removed because it crashed under React 19; verify no console error) |
| 21 | Check Profit / margin on stat cards | **Positive** with seeded data (~£36,750 / ~41%). Negative profit = cost-scope regression. |
| 22 | Click a kanban card | Job detail modal with sectioned layout |

### 4.6 Reconciliation

| # | Action | Expected |
|---|---|---|
| 23 | Reconciliation tab → enter a payment amount | Suggests matching invoice combinations |
| 24 | Select invoices → "Mark as Paid" | Status moves to Paid |
| 25 | Subcontractor invoice tracker | Shows agreed vs invoiced, flags discrepancies |

### 4.7 Settings & roles

| # | Action | Expected |
|---|---|---|
| 26 | Settings → each section (Sites, Services, Entities, Subbies, Contact Matrix, Rate Overrides, Users) | All load and render |
| 27 | Add / edit / delete a record | Persists across reload |
| 28 | Edit a service rate | A row is written to the rate audit log |
| 29 | Toggle light / dark theme | Whole UI re-themes; persists on reload |
| 30 | Resize to mobile width | Layouts collapse; tables become card views |

### 4.8 API smoke test

All routes except `POST /api/auth/login` require `Authorization: Bearer <token>`.

```
POST   /api/auth/login            {username,password} → {token,user}
GET    /api/auth/me
GET    /api/sites | /api/services | /api/entities | /api/subcontractors
GET    /api/contact-matrix
GET    /api/rate-overrides | /api/rate-audit
GET    /api/jobs                  (supports ?status=&site_id=&service_id=)
GET    /api/quotes                → list with line_count
GET    /api/quotes/:id            → quote + lines[]
POST   /api/quotes                {business_entity_id,lines[],invoice_mode,notes}
POST   /api/quotes/:id/lines
DELETE /api/quotes/:id/lines/:lineId
POST   /api/quotes/:id/accept     {client_po_number} → {jobs_created,job_ids[]}
GET    /api/recurring             → recurring maintenance plans
POST   /api/recurring             {site_id,service_id,frequency,season_start_month,season_end_month}
GET    /api/recurring/due?period=YYYY-MM   → preview only, NO side effects
POST   /api/recurring/generate    {period,invoice_mode} → draft quotes per entity
GET    /api/dashboard/dashboard
GET    /api/dashboard/calendar | /reconciliation | /subbie-invoices
```

---

## 5. Beads issue tracker

Beads (`bd`) is the in-repo issue tracker. Raw data: `.beads/issues.jsonl` (83 issues).
Full audit trail: `.beads/interactions.jsonl`.

**Totals: 83 issues — 75 closed, 7 open, 1 in progress.**

### ⚠️ Three "open" issues are actually implemented

The tracker was not updated after the work landed. Verified in code:

| Beads ID | Title | Tracker says | **Reality (verified)** |
|---|---|---|---|
| `jake-app-453` | Rate change audit log | open | ✅ **Done** — `rate_audit_log` table + `GET /api/rate-audit` |
| `jake-app-t33` | Per-site rate overrides | open | ✅ **Done** — `rate_overrides` table, API, Settings UI section, applied in quote + job pricing |
| `jake-app-ds3` | App.tsx refactor into per-tab components | in_progress | ✅ **Done** — `App.tsx` is 172 lines; split into 11 components under `client/src/components/` |

> A testing agent should **verify these three independently** rather than trusting this claim.

### Genuinely not implemented (backlog)

| Beads ID | Pri | Title | Notes |
|---|---|---|---|
| `jake-app-wb0` | P2 | Site Profitability Heatmap | Visual report: margin vs incidents per site. Not started. |
| `jake-app-57g` | P2 | Interactive Site Map | Leaflet map, pins colour-coded by status. Not started. |
| `jake-app-hb6` | P2 | Weather-Aware Calendar | Weather API + 5-day forecast on calendar cells. Not started. |
| `jake-app-bn6` | P3 | Offline mode | Cache last-good fetch for read-only access when server is down. Not started. |
| `jake-app-046` | P3 | Real cloud storage sync | Currently **path/link display only** — no actual OneDrive/Google Drive API integration. |

### Selected closed history (75 total — this shows what was built)

Phases from `PIPELINE.md`, all closed:

| Beads ID | Feature |
|---|---|
| `jake-app-upn` | Intelligent Contact Matrix (entity × category email routing) |
| `jake-app-u1v` | Branded PDF Engine — ⚠️ **marked closed but NOT present in this build**, see §7.6 |
| `jake-app-5mn` | Storage & folder automation (`Site > Year > Process`) |
| `jake-app-2al` | Subcontractor self-service portal |
| `jake-app-8sw` | Financial intelligence (VAT & forecasting) |

> **Do not trust "closed" as "present".** At least one closed issue (`jake-app-u1v`) describes
> functionality that does not exist in this build. The tracker records intent and history from
> an earlier codebase; this build was reconstructed. Verify claims against code.

Plus: kanban board, quoting engine, PO management, reconciliation with smart payment matching,
subcontractor invoice tracking with discrepancy flagging, evidence vault, CSV/XLSX export,
Google Sheets sync, user management with roles, responsive/mobile layouts, dark mode.

---

## 6. Architecture

```
jake-app/
├── README.md                 ← handover/deployment guide
├── HANDOVER.md               ← this file
├── VERSION
├── brief.txt                 ← original client brief (the source of truth for scope)
├── PIPELINE.md               ← feature phases 1–5
├── PROGRESS.md, MEMORY.md
├── additional-info/          ← schema, goals, Mermaid workflow diagram
├── .beads/                   ← issue tracker (JSONL)
├── client/                   ← React 19 + TypeScript + Vite
│   └── src/
│       ├── App.tsx           shell, tabs, session (172 lines)
│       ├── api.ts            typed fetch client
│       ├── types.ts          shared types
│       ├── design.css        design tokens (light + dark)
│       ├── App.css           component styles
│       └── components/       Dashboard, QuoteBuilder, Jobs, History, Calendar,
│                             Reconciliation, Settings, Login, Toast, icons
└── server/                   ← Express + TypeScript
    └── src/
        ├── index.ts          entry, route wiring
        ├── db.ts             schema + seed data (node:sqlite)
        ├── crypto.ts         scrypt hashing + HMAC session tokens
        ├── types.ts
        └── routes/           auth, masterData, jobs, quotes, dashboard
```

### Deliberate minimalism

Everything possible is built on the platform rather than a package:

| Concern | Implementation |
|---|---|
| Password hashing | `node:crypto` **scrypt** (memory-hard, native C++) |
| Sessions | **HMAC-SHA256** signed tokens with `jti` + expiry |
| Database | **`node:sqlite`** (built into Node 22.5+) |
| Icons | inline SVG (`components/icons.tsx`) |
| Charts | hand-rolled SVG sparkline |

**Removed as unused:** `axios`, `date-fns`, `jspdf`, `jspdf-autotable`, `recharts`, `xlsx`,
`lucide-react`, `bcryptjs`, `jsonwebtoken`.
Removing `jspdf` is what took npm vulnerabilities to zero (all 3 advisories came from its
`dompurify` chain).

### Database

Single SQLite file (`server/data.db`). Tables: `users`, `sessions`, `business_entities`,
`sites`, `services`, `subcontractors`, `jobs`, `contact_matrix`, `rate_overrides`,
`rate_audit_log`, `quotes`, `quote_lines`.

Indexes exist on `jobs(status)`, `jobs(site_id)`, `jobs(service_id)`.

> **Schema caveat:** `data.db` is gitignored. A fresh clone builds the schema on first run
> from `initializeDatabase()` in `server/src/db.ts`, which also inserts default seed data
> (4 entities, 5 sites, 3 subbies, 7 services, 12 contact-matrix rows, admin user).

---

## 7. Known gaps & risks

Report these honestly; do not paper over them.

1. **Default credentials are committed in source.** `admin` / `admin123`, hash in
   `server/src/db.ts`. Must be changed before any real deployment.
2. **`JWT_SECRET` falls back to a hardcoded dev string** if the env var is unset. Must be set
   in production.
3. **No automated tests.** Zero unit/integration test files. All verification is manual or
   via the API. This is the single biggest quality gap.
4. **SQLite is single-writer.** Fine for one small company; not for concurrent multi-user
   write load.
5. **No real cloud storage integration** — folder paths and links are stored/displayed, but
   nothing syncs to OneDrive/Google Drive (beads `jake-app-046`).
6. **PDF generation is absent — and this contradicts the beads tracker.** Beads
   `jake-app-u1v` ("Branded PDF Engine") is marked **closed**, but this build has **no PDF
   capability at all**:
   - `GET /api/jobs/:id/invoice-pdf`, `/quote-pdf`, `/subbie-po-pdf` return `Content-Type:
     text/plain` with `.txt` filenames — plain-text dumps, not PDFs.
   - There are **no PDF buttons anywhere in the client UI** (`grep -rn "pdf" client/src/` → 0 hits).
   The original engine used `jspdf`, removed during the dependency strip. **Treat the closed
   beads entry as inaccurate.** This is the most likely thing to matter to the client, since
   invoices are the whole point of the workflow.
7. **Email sending is not wired up.** The contact matrix *resolves* recipients, but nothing
   actually sends mail (no SMTP/API integration).
8. **Docs drift.** `CLAUDE.md` and `GEMINI.md` still describe the pre-rewrite layout
   (a monolithic `App.tsx`, `server/src/index.ts` as the only server file, React 18).
   `PROGRESS.md` describes features as complete that were never built here.

---

## 8. Suggested testing approach

1. Run the app from a **clean clone** — `git clone`, `npm install` in both dirs, `npm run dev`.
   This tests that the repo is self-sufficient (schema builds from scratch, no missing files).
2. Work the **test checklist** in §4. Prioritise the quoting flow (§4.2) — it's the newest
   and least exercised code.
3. **Independently verify the three beads claims** in §5 rather than trusting this document.
4. Try to **falsify the §7 gaps** — especially #6 (PDF output) and #7 (email).
5. Report findings as: what you did → what you expected → **what actually happened** → severity.

### Severity convention

| Level | Meaning |
|---|---|
| 🔴 Blocker | Cannot build, run, or use a core flow |
| 🟡 Important | Works but incorrect, risky, or a regression |
| 🟢 Working | Verified correct |

---

*Prepared 2026-10-11. Every claim above was checked against the working tree at commit
`094d91f`; anything not verified is explicitly labelled as a claim to be tested.*
