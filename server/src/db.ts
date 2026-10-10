import { DatabaseSync } from 'node:sqlite';
import { join } from 'path';

const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'data.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('admin', 'editor', 'viewer')),
      display_name TEXT NOT NULL,
      email TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS business_entities (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      mw_output REAL NOT NULL,
      site_type TEXT NOT NULL DEFAULT 'solar' CHECK(site_type IN ('solar', 'wind', 'other')),
      business_entity_id TEXT NOT NULL REFERENCES business_entities(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      short_code TEXT NOT NULL,
      category TEXT NOT NULL,
      client_rate_per_mw REAL NOT NULL DEFAULT 0,
      subbie_rate_per_mw REAL NOT NULL DEFAULT 0,
      assigned_subbie_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subcontractors (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      contact_email TEXT NOT NULL,
      service_category TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      service_id TEXT NOT NULL REFERENCES services(id),
      status TEXT NOT NULL DEFAULT 'Quoted' CHECK(status IN ('Quoted', 'PO Received', 'Subbie Notified', 'Works Complete', 'Invoiced', 'Paid', 'Closed')),
      client_po_number TEXT,
      subbie_po_number TEXT,
      quote_amount REAL NOT NULL DEFAULT 0,
      subbie_cost REAL NOT NULL DEFAULT 0,
      invoice_number TEXT,
      invoice_amount REAL,
      subbie_invoice_number TEXT,
      subbie_invoiced_amount REAL,
      subbie_invoice_status TEXT DEFAULT 'pending' CHECK(subbie_invoice_status IN ('pending', 'received', 'approved', 'disputed', 'paid')),
      report_link TEXT,
      photo_link TEXT,
      folder_path TEXT,
      authorised_date TEXT,
      works_complete_date TEXT,
      invoiced_date TEXT,
      paid_date TEXT,
      closed_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contact_matrix (
      id TEXT PRIMARY KEY,
      business_entity_id TEXT NOT NULL REFERENCES business_entities(id),
      job_category TEXT NOT NULL,
      to_emails TEXT NOT NULL DEFAULT '',
      cc_emails TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(business_entity_id, job_category)
    );

    CREATE TABLE IF NOT EXISTS rate_overrides (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      service_id TEXT NOT NULL REFERENCES services(id),
      client_rate_per_mw REAL NOT NULL,
      subbie_rate_per_mw REAL NOT NULL,
      effective_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(site_id, service_id)
    );

    CREATE TABLE IF NOT EXISTS rate_audit_log (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL REFERENCES services(id),
      old_client_rate REAL,
      new_client_rate REAL,
      old_subbie_rate REAL,
      new_subbie_rate REAL,
      changed_at TEXT NOT NULL DEFAULT (datetime('now')),
      changed_by TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Insert default data
    INSERT OR IGNORE INTO business_entities (id, name, code) VALUES
      ('be-001', 'Low Carbon Solar 1', 'LCS1'),
      ('be-002', 'Low Carbon Solar 2', 'LCS2'),
      ('be-003', 'Low Carbon Solar 3', 'LCS3'),
      ('be-004', 'Low Carbon Solar 4', 'LCS4');

    INSERT OR IGNORE INTO sites (id, name, mw_output, site_type, business_entity_id) VALUES
      ('site-001', 'Beech Farm', 5.0, 'solar', 'be-001'),
      ('site-002', 'Oak Solar', 7.5, 'solar', 'be-002'),
      ('site-003', 'Valley Park', 10.0, 'solar', 'be-003'),
      ('site-004', 'Hill Top', 3.5, 'solar', 'be-001'),
      ('site-005', 'Green Field', 12.0, 'solar', 'be-002');

    INSERT OR IGNORE INTO subcontractors (id, name, contact_email, service_category) VALUES
      ('sub-001', 'Lemp', 'lemp@example.com', 'Groundworks'),
      ('sub-002', 'Futurwise Aerial', 'futurwise@example.com', 'Survey'),
      ('sub-003', 'Sitemark', 'sitemark@example.com', 'Data Processing');

    INSERT OR IGNORE INTO services (id, name, short_code, category, client_rate_per_mw, subbie_rate_per_mw, assigned_subbie_id) VALUES
      ('svc-001', 'Grass Cutting', 'GC', 'Groundworks', 500, 300, 'sub-001'),
      ('svc-002', 'Weed Killing', 'WK', 'Groundworks', 600, 350, 'sub-001'),
      ('svc-003', 'Panel Cleaning', 'PC', 'Groundworks', 450, 250, 'sub-001'),
      ('svc-004', 'Hedge Trimming', 'HT', 'Groundworks', 700, 400, 'sub-001'),
      ('svc-005', 'Thermographic Survey', 'TS', 'Survey', 800, 500, 'sub-002'),
      ('svc-006', 'Groundworks', 'GW', 'Groundworks', 1000, 600, 'sub-001'),
      ('svc-007', 'Data Processing', 'DP', 'Data Processing', 400, 200, 'sub-003');

    INSERT OR IGNORE INTO contact_matrix (id, business_entity_id, job_category, to_emails, cc_emails) VALUES
      ('cm-001', 'be-001', 'Groundworks', 'accounts@lowcarbon.com', 'maintenance@lowcarbon.com'),
      ('cm-002', 'be-001', 'Survey', 'accounts@lowcarbon.com', 'maintenance@lowcarbon.com'),
      ('cm-003', 'be-001', 'Data Processing', 'accounts@lowcarbon.com', 'maintenance@lowcarbon.com'),
      ('cm-004', 'be-002', 'Groundworks', 'accounts2@lowcarbon.com', 'maintenance2@lowcarbon.com'),
      ('cm-005', 'be-002', 'Survey', 'accounts2@lowcarbon.com', 'maintenance2@lowcarbon.com'),
      ('cm-006', 'be-002', 'Data Processing', 'accounts2@lowcarbon.com', 'maintenance2@lowcarbon.com'),
      ('cm-007', 'be-003', 'Groundworks', 'accounts3@lowcarbon.com', 'maintenance3@lowcarbon.com'),
      ('cm-008', 'be-003', 'Survey', 'accounts3@lowcarbon.com', 'maintenance3@lowcarbon.com'),
      ('cm-009', 'be-003', 'Data Processing', 'accounts3@lowcarbon.com', 'maintenance3@lowcarbon.com'),
      ('cm-010', 'be-004', 'Groundworks', 'accounts4@lowcarbon.com', 'maintenance4@lowcarbon.com'),
      ('cm-011', 'be-004', 'Survey', 'accounts4@lowcarbon.com', 'maintenance4@lowcarbon.com'),
      ('cm-012', 'be-004', 'Data Processing', 'accounts4@lowcarbon.com', 'maintenance4@lowcarbon.com');

    -- Create default admin user (password: admin123)
    INSERT OR IGNORE INTO users (id, username, password_hash, role, display_name, email) VALUES
      ('user-001', 'admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', 'Administrator', 'admin@raysync.local');
  `);
}

export default db;
