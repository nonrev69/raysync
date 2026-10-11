/**
 * Seeds realistic demo data for RaySync so the UI can be reviewed with content.
 * Run: npx tsx seed.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'crypto';

const db = new DatabaseSync('./data.db');
db.exec('PRAGMA foreign_keys = ON');

const sites = db.prepare('SELECT id, name, mw_output FROM sites').all() as any[];
const services = db.prepare('SELECT id, name, client_rate_per_mw, subbie_rate_per_mw FROM services').all() as any[];

if (sites.length === 0 || services.length === 0) {
  console.error('No sites/services found — run the server once to initialise the DB first.');
  process.exit(1);
}

// Status progression weighted toward a realistic pipeline
const statuses = [
  'Quoted', 'Quoted',
  'PO Received', 'PO Received', 'PO Received',
  'Subbie Notified', 'Subbie Notified',
  'Works Complete', 'Works Complete',
  'Invoiced', 'Invoiced', 'Invoiced',
  'Paid', 'Paid', 'Paid', 'Paid',
  'Closed', 'Closed', 'Closed', 'Closed',
];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const iso = (d: Date) => d.toISOString().split('T')[0];

const insert = db.prepare(`
  INSERT INTO jobs (
    id, site_id, service_id, status, client_po_number, subbie_po_number,
    quote_amount, subbie_cost, invoice_number, invoice_amount,
    subbie_invoice_number, subbie_invoiced_amount, subbie_invoice_status,
    report_link, photo_link, folder_path,
    authorised_date, works_complete_date, invoiced_date, paid_date, closed_date,
    notes, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

let createdCount = 0;
const now = new Date();

for (let i = 0; i < 42; i++) {
  const site = pick(sites);
  const svc = pick(services);
  const status = statuses[i % statuses.length];

  const quoteAmount = Math.round(site.mw_output * svc.client_rate_per_mw * 100) / 100;
  const subbieCost = Math.round(site.mw_output * svc.subbie_rate_per_mw * 100) / 100;

  // Spread creation over the last 14 months so the revenue chart has data
  const monthsAgo = Math.floor(rand(0, 14));
  const created = new Date(now.getFullYear(), now.getMonth() - monthsAgo, Math.floor(rand(1, 28)));

  const idx = statuses.indexOf(status);
  const auth = idx >= 1 ? new Date(created.getTime() + 3 * 864e5) : null;
  const complete = idx >= 3 ? new Date(created.getTime() + 21 * 864e5) : null;
  const invoiced = idx >= 4 ? new Date(created.getTime() + 26 * 864e5) : null;
  const paid = idx >= 5 ? new Date(created.getTime() + 55 * 864e5) : null;
  const closed = idx >= 6 ? new Date(created.getTime() + 58 * 864e5) : null;

  const hasPO = idx >= 1;
  const hasSubbiePO = idx >= 2;
  const hasInvoice = idx >= 4;
  const hasSubbieInvoice = idx >= 3;

  insert.run(
    randomUUID(), site.id, svc.id, status,
    hasPO ? `LC-${1000 + i}` : null,
    hasSubbiePO ? `SPO-${2000 + i}` : null,
    quoteAmount, subbieCost,
    hasInvoice ? `INV-${3000 + i}` : null,
    hasInvoice ? quoteAmount : null,
    hasSubbieInvoice ? `SI-${4000 + i}` : null,
    hasSubbieInvoice ? subbieCost : null,
    hasSubbieInvoice ? pick(['received', 'approved', 'paid']) : 'pending',
    hasSubbieInvoice ? `https://drive.example.com/reports/${site.name.replace(/\s+/g, '-')}-${created.getFullYear()}` : null,
    hasSubbieInvoice ? `https://onedrive.example.com/photos/${site.name.replace(/\s+/g, '-')}` : null,
    `/SolarFarms/${site.name}/${created.getFullYear()}/${svc.name}`,
    auth ? iso(auth) : null,
    complete ? iso(complete) : null,
    invoiced ? iso(invoiced) : null,
    paid ? iso(paid) : null,
    closed ? iso(closed) : null,
    null,
  );
  createdCount++;
}

console.log(`Seeded ${createdCount} jobs across ${sites.length} sites and ${services.length} services.`);
const counts = db.prepare('SELECT status, COUNT(*) as n FROM jobs GROUP BY status ORDER BY n DESC').all();
console.table(counts);
db.close();
