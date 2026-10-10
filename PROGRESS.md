# RaySync: Solar O&M Automation - Project Status

## Project Overview
A bespoke full-stack management system for Sum Ltd to automate solar farm operations and financial workflows.

## Current State (as of May 2026)

### 1. Core Workflow
- **Quoting Engine:** Automated quote generation based on site MW output and pre-agreed process rates.
- **PO Management:** 
    - Association of client POs with quotes.
    - Automatic generation of Subcontractor POs with adjusted subcontractor rates.
    - Tracking of PO status from 'Sent' to 'Works Complete'.
- **Invoicing System:** 
    - Generation of client-ready invoices with mandatory PO references.
    - Automated email drafting for Accounts and Maintenance teams.
- **Reconciliation Engine:** Bulk matching of incoming client payments against sent invoices to close project cycles.

### 2. Intelligent Automation
- **Intelligent Contact Matrix (Phase 1):** Entity x Job Category email routing to automate recipient selection and eliminate "CC paranoia".
- **Branded PDF Engine (Phase 2):** Professional PDF generation for Quotes, Subbie POs, and Client Invoices with RaySync branding.

### 3. Design & UX
- **Design System:** Full integration of the **Flow 2** system (Poppins font, olive-green accents).
- **Canvas:** Warm cream 'Basecamp' aesthetic for Light mode; Deep 'Ink' palette for Dark mode.
- **Theming:** Real-time Light/Dark mode toggle.
- **Navigation:** Structured tabbed workflow (Dashboard -> Quoting -> POs -> Invoices -> Reconciliation).
- **Components:** High-impact stat cards, professional data tables, and interactive selection lists.

### 3. Technical Stack
- **Frontend:** React (TypeScript) + Vite + Lucide Icons.
- **Backend:** Node.js (Express) + TypeScript + TSX.
- **Styling:** Vanilla CSS with comprehensive CSS Variable system for theming.

## Next Phase: Management Tools
- **Settings Module:** Implementation of a master data management area to add/edit/delete:
    - Solar Sites (Name, MW, Entity).
    - Business Entities (Clients).
    - Services/Processes (Name, Client Rate, Subbie Rate).
    - Subcontractors.
