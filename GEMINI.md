# Project Instructions: RaySync - Solar O&M Automation

## Overview
This project aims to automate the workflow for Sum Ltd, a solar operations and management contractor. The goal is to replace a manual process involving QuickBooks, Excel, and local folder structures with a robust, automated system that handles quoting, PO generation, invoicing, and reporting.

## Core Workflows to Automate
1. **Quoting:** Generate quotes based on site MW output (from master site list) and agreed process rates.
2. **PO Management:** 
   - Receive and store client POs.
   - Automatically generate and email subcontractor POs (using subcontractor rates).
   - Track status via a central dashboard.
3. **Completion & Invoicing:**
   - Process subcontractor invoices and site reports/photos.
   - Convert quotes to client invoices in QuickBooks (via API if possible, or automated export).
   - Generate and send formatted emails to client accounts/maintenance teams with specific attachments/links based on the entity.
4. **Reconciliation:** Assist in reconciling bulk payments against multiple invoices.
5. **Reporting:** Dashboard showing real-time status of all jobs (Quoted, PO Received, Subbie Notified, Work Done, Invoiced, Paid).

## Technical Strategy
- **Frontend:** React (TypeScript) for a clean, modern dashboard.
- **Backend:** Node.js (Express) or Python (FastAPI).
- **Database:** PostgreSQL or similar to store site data, rates, and job statuses.
- **Integrations:** 
  - QuickBooks API (for quotes/invoices).
  - Email API (e.g., SendGrid/Postmark) for automated communication.
  - File Storage (e.g., OneDrive/Google Drive API) for document management.
- **Security:** Strict isolation between client and subcontractor data to prevent accidental cross-exposure.

## Design Principles
- **Aesthetic:** Clean, professional, and "alive" with status indicators.
- **Robustness:** Error handling for API failures and manual overrides for edge cases.
- **Simplicity:** Minimize "brain power" required for day-to-day operations.

## Repository Structure
- `/client`: Frontend application.
- `/server`: Backend API.
- `/docs`: Detailed workflow diagrams and API documentation.

# 🛠️ GEMINI.md: Project Intelligence & Performance Mandate

This file serves as the primary context gate for Gemini CLI and other AI agents. It takes absolute precedence over general defaults to ensure high-velocity development and zero terminal lag[cite: 3].

## 🚫 Anti-Lag Directives (Performance Guardrails)
*   **Search Limitation**: Never run global `SearchText` or `grep` across the entire workspace; use `ReadFolder` to target specific directories first[cite: 3].
*   **100-Match Rule**: If a search returns "100 matches (limited)", abort immediately and request a more specific search path or keyword[cite: 1, 3].
*   **Mega-File Handling**: Any file exceeding 500 lines (e.g., `src/app/actions.ts`) MUST be read using `startLine` and `endLine` parameters; never ingest the full file at once[cite: 1, 3].
*   **Context Management**: If the session duration exceeds 30 minutes or "Thinking" time exceeds 30 seconds, the agent must suggest a `/compress` command or a fresh session resume[cite: 3].
*   **Reference Folders**: The `/FLOW-3` and `/Design` directories are for **REFERENCE ONLY** (style, patterns, UI kit). NEVER scan these folders for active logic, never modify them, and exclude them from global searches to save context[cite: User].

## 💾 Vibecoder Safety Protocol (Offline/No Git)
*   **Beads Workflow**: This project uses the [gemini-beads](https://github.com/thoreinstein/gemini-beads) system for state management and micro-saves.
*   **Pre-Flight Backups**: Before any `write_file` or `replace` operation, the AI MUST run `cp -f {file} {file}.vibe.bak` to create a local recovery point[cite: 5].
*   **Non-Interactive Execution**: Always use the `-f` (force) flag for `cp`, `mv`, and `rm` to prevent terminal hangs on hidden confirmation prompts[cite: 5].
*   **State Verification**: Always run `bd list` at the start of every session to sync with the local Beads task graph. Use `bd show <id>` to inspect a specific issue[cite: 1, 5].
*   **Micro-Saves**: Document every logic change in a new Bead with a summary of the "Before" and "After" state[cite: 1, 3].

## 🏗️ Architecture & Stack Standards

> ⚠️ **IMPORTANT**: This project is **React 18 + Vite**, NOT Next.js. The `/FLOW-3` folder is a separate Next.js 16 reference codebase — do not apply its patterns here.

*   **Frontend**: React (TypeScript) + Vite. No App Router, no Server Actions, no `revalidatePath`.
*   **Backend**: Node.js + Express (`server/src/index.ts`). All API calls go through axios from the client.
*   **Mutations**: Standard React state (`useState`) + axios POST/PUT/DELETE to Express endpoints.
*   **Styling**: Vanilla CSS variables. Tokens live in `client/src/design.css`. Use these — do not add Tailwind or CSS-in-JS.
*   **Icons**: Import Lucide icons directly from `lucide-react` (no `DynamicIcon` wrapper — that's FLOW-3 only).
*   **Charts**: `recharts` (already installed).
*   **Dates**: `date-fns` (already installed).

## 🗺️ Logical Mapping (Current Hot-Spots)
| Feature | Primary File | Notes |
| :--- | :--- | :--- |
| **Entire Frontend** | `client/src/App.tsx` | MEGA FILE — use offset/limit to read |
| **Design Tokens** | `client/src/design.css` | CSS variables, light + dark themes |
| **All API Routes** | `server/src/index.ts` | Single Express server |
| **Issue Tracker** | `.beads/` | Use `bd list` / `bd show` |

> **Note**: Verify exact line numbers before editing App.tsx to avoid context-drift.

## 📋 Current Project State (May 2026)
Core workflow is **complete and working**:
- Quoting engine, PO management, Invoicing, Reconciliation, History, Calendar, Settings tabs all built.
- Design system (Flow 2: cream canvas, olive green, Poppins, pill buttons) fully integrated.

**Next phase — open Beads issues (all P2)**:
| Beads ID | Feature | Priority |
|---|---|---|
| `jake-app-upn` | Intelligent Contact Matrix (Phase 1 — START HERE) | NOW |
| `jake-app-u1v` | Branded PDF Engine (Phase 2) | Next |
| `jake-app-5mn` | Storage & Folder Automation (Phase 3) | Backlog |
| `jake-app-2al` | Subcontractor Self-Service Portal (Phase 4) | Backlog |
| `jake-app-8sw` | Financial Intelligence — VAT & forecasting (Phase 5) | Backlog |

## 🎭 Agent Persona & Output
*   **Role**: Lead Developer for a tech-savvy "Vibecoder"[cite: 3].
*   **Style**: Direct, brief, and technical. Avoid conversational filler or repeating the user's prompt[cite: 3].
*   **Validation**: Run `npx tsc --noEmit` after significant code changes to ensure zero regressions[cite: 3].
