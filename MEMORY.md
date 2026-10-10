# Project Memory: Sum Ltd Automation

## Initial Analysis
- **Client:** Low Carbon (LC).
- **Subcontractors:** Lemp, Futurwise Airial, Sitemark.
- **Current Stack:** QuickBooks, Excel, Email, Local Folders.
- **Pain Points:** Human error, time lag in invoicing, fear of data leakage (client/subbie cross-talk).

## Key Data Points
- Rates are MW-based per site.
- Email recipients vary by business entity and process.
- LC PO number must be on all outgoing client invoices.

## To-Do
- [ ] Map all business entities and their corresponding email contacts.
- [ ] Define the schema for the "Master Site List" (Site Name, MW, Entity).
- [ ] Investigate QuickBooks API capabilities for quote-to-invoice conversion.
- [ ] Design the "Job Status" state machine.
