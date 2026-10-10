# CLAUDE.md: RaySync — Solar O&M Automation

Project intelligence file for Claude Code. Governs all agent behaviour in this repo.

---

## Project Overview

**RaySync** is a bespoke full-stack web app for **Sum Ltd**, automating solar farm O&M workflows that currently live in QuickBooks, Excel, email, and local folders.

- **Client**: Low Carbon (LC)
- **Subcontractors**: Lemp, Futurwise Aerial, Sitemark
- **Core loop**: Quote → Client PO → Subbie PO → Work done → Client invoice → Reconcile → Closed

**Critical business rule**: The LC PO number MUST appear on every outbound client invoice. This is non-negotiable.

**Privacy rule**: Client and subcontractor data must be strictly isolated — no cross-exposure in emails or documents.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Styling | Vanilla CSS, CSS variables (no Tailwind) |
| Icons | `lucide-react` |
| Charts | `recharts` |
| HTTP | `axios` |
| Dates | `date-fns` |
| Issues | Beads (`bd` CLI) |

**Not Next.js** — the `/FLOW-3` reference folder uses Next.js 16/Prisma; that is a separate reference codebase, not this project.

---

## File Map

```
jake-app/
├── client/src/
│   ├── App.tsx          ← MEGA FILE — entire frontend (monolithic component)
│   ├── design.css       ← CSS variable design tokens
│   ├── App.css          ← Component styles
│   └── index.css        ← Base reset
├── server/src/
│   └── index.ts         ← Single Express server file
├── FLOW-3/              ← REFERENCE ONLY — Next.js 16 agency CRM. Never scan for logic, never modify.
├── Design/              ← REFERENCE ONLY — Flow 2 UI kit, colours, fonts. Never scan, never modify.
├── additional-info/     ← Reference: schema, goals, Mermaid workflow diagram
├── .beads/              ← Beads issue tracker (Dolt-backed)
├── GEMINI.md            ← Gemini/AI agent context
├── PIPELINE.md          ← Feature pipeline (Phases 1–5)
├── PROGRESS.md          ← Current project state
└── MEMORY.md            ← Project memory log
```

### App.tsx — Mega-File Protocol
`client/src/App.tsx` is the entire frontend in one file. **Always read with `offset`/`limit`** — never ingest the full file.
Before editing, grep for the section you need; confirm exact line numbers first.

---

## Design System (Flow 2)

Source of truth: `/Design/colors_and_type.css` and `/Design/README.md`.

| Token | Value |
|---|---|
| Canvas | `#F7F5EF` (warm cream) |
| Brand green | `#A4C73A` (olive) |
| Ink / nav | `#0F1115` |
| Action blue | `#2B5BDC` |
| Border | `#E5E1D6` |
| Font | Poppins (400 body, 600–700 UI, 800–900 display) |
| Mono | JetBrains Mono (IDs, codes, timers only) |
| Button radius | `999px` (pill — always) |
| Card radius | `10–14px` |
| Icons | Lucide, 1.75–2px stroke, `currentColor`, 18–20px default |

Dark mode uses an "Ink" palette — see `design.css` for variables.

---

## Performance Guardrails

- **Never grep/search the whole workspace** — target specific files or directories.
- **Never read `/FLOW-3/`** — reference only, massive, full of TSX. Zero active logic for this project.
- **Never read `/Design/`** — for visual reference only. Read `/Design/README.md` or `/Design/colors_and_type.css` if you need design tokens.
- **Never read `client/node_modules/`** — excluded from all searches.
- **`App.tsx` mega-file rule**: always use `offset`+`limit`; never read in full.
- If a search returns 100+ matches, abort and narrow the path.

---

## Beads Issue Tracking

Beads (`bd`) is the project issue tracker. **Run these at session start.**

```bash
bd list                         # see all open issues
bd show <id>                    # view issue detail
bd create "title" --priority P1 # create issue
bd update <id> --claim          # assign to yourself
bd update <id> --status done    # close issue
bd dolt push                    # sync to remote
```

### Current Open Issues (P2)
| ID | Feature |
|---|---|
| `jake-app-upn` | Intelligent Contact Matrix — email recipient automation (Phase 1, NOW) |
| `jake-app-u1v` | Branded PDF Engine (Phase 2) |
| `jake-app-5mn` | Storage & Folder Automation (Phase 3) |
| `jake-app-2al` | Subcontractor Self-Service Portal (Phase 4) |
| `jake-app-8sw` | Financial Intelligence — VAT & forecasting (Phase 5) |

---

## Workflow State Machine

Jobs progress through these statuses:
`Quoted` → `PO Received` → `Subbie Notified` → `Works Complete` → `Invoiced` → `Paid` → `Closed`

See `/additional-info/The Solar Ops Master Workflow (Mermaid).txt` for the full flow diagram.

---

## Data Schema

| Entity | Key Fields |
|---|---|
| Sites | Name, MW output, LC Business Entity, Maintenance contacts, Accounts contacts |
| Process Catalog | Task name, Client rate/MW, Subbie rate/MW, Assigned subbie |
| Subcontractors | Name, Contact email, Service category |
| Project Tracker | Status, Client PO#, Subbie PO#, Folder path, Folder link |
| Contact Matrix | Entity × Job Category → To:/CC: email routing |

---

## Navigation Tabs

`dashboard` | `quoting` | `jobs` | `history` | `calendar` | `reconciliation` | `settings`

---

## Running the App

```bash
# Root
npm run dev        # starts backend (node server.js)

# Client (separate terminal)
cd client && npm run dev
```

See `RUN_DEV.bat` for the combined launcher.

---

## Agent Behaviour Rules

1. **Always run `bd list` at session start** to sync with open issues.
2. **No global searches** — target directories explicitly.
3. **Validate with `npx tsc --noEmit`** after significant frontend changes.
4. **Micro-save discipline**: describe Before/After state for each significant change.
5. **No Next.js patterns** — no Server Actions, no `revalidatePath`, no App Router. This is Vite/React.
6. **British English** in UI copy. Currency £. Dates DD/MM/YY.
7. **Sentence case** for buttons/labels; **Title Case** for page headings.
8. **No emoji** in UI chrome.
