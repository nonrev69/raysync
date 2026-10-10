import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import type { Site, BusinessEntity, Service, Subcontractor } from '../types.js';
import { authenticateToken, requireRole } from './auth.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// ========== BUSINESS ENTITIES ==========

router.get('/entities', (_req: Request, res: Response) => {
  const entities = db.prepare('SELECT * FROM business_entities ORDER BY name').all();
  res.json(entities);
});

router.post('/entities', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { name, code } = req.body;
  if (!name || !code) {
    res.status(400).json({ error: 'Name and code required' });
    return;
  }
  const id = randomUUID();
  db.prepare('INSERT INTO business_entities (id, name, code) VALUES (?, ?, ?)').run(id, name, code);
  res.status(201).json({ id, name, code });
});

router.put('/entities/:id', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { name, code } = req.body;
  db.prepare('UPDATE business_entities SET name = ?, code = ? WHERE id = ?').run(name, code, req.params.id);
  res.json({ success: true });
});

router.delete('/entities/:id', requireRole('admin'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM business_entities WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== SITES ==========

router.get('/sites', (_req: Request, res: Response) => {
  const sites = db.prepare(`
    SELECT s.*, be.name as entity_name, be.code as entity_code
    FROM sites s
    JOIN business_entities be ON s.business_entity_id = be.id
    ORDER BY s.name
  `).all();
  res.json(sites);
});

router.post('/sites', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { name, mw_output, site_type, business_entity_id } = req.body;
  if (!name || !mw_output || !business_entity_id) {
    res.status(400).json({ error: 'Name, mw_output, and business_entity_id required' });
    return;
  }
  const id = randomUUID();
  db.prepare('INSERT INTO sites (id, name, mw_output, site_type, business_entity_id) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, mw_output, site_type || 'solar', business_entity_id);
  res.status(201).json({ id, name, mw_output, site_type, business_entity_id });
});

router.put('/sites/:id', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { name, mw_output, site_type, business_entity_id } = req.body;
  db.prepare('UPDATE sites SET name = ?, mw_output = ?, site_type = ?, business_entity_id = ? WHERE id = ?')
    .run(name, mw_output, site_type, business_entity_id, req.params.id);
  res.json({ success: true });
});

router.delete('/sites/:id', requireRole('admin'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== SERVICES ==========

router.get('/services', (_req: Request, res: Response) => {
  const services = db.prepare(`
    SELECT s.*, sub.name as subbie_name
    FROM services s
    JOIN subcontractors sub ON s.assigned_subbie_id = sub.id
    ORDER BY s.name
  `).all();
  res.json(services);
});

router.post('/services', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { name, short_code, category, client_rate_per_mw, subbie_rate_per_mw, assigned_subbie_id } = req.body;
  if (!name || !category || !assigned_subbie_id) {
    res.status(400).json({ error: 'Name, category, and assigned_subbie_id required' });
    return;
  }
  const id = randomUUID();
  db.prepare('INSERT INTO services (id, name, short_code, category, client_rate_per_mw, subbie_rate_per_mw, assigned_subbie_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, short_code || '', category, client_rate_per_mw || 0, subbie_rate_per_mw || 0, assigned_subbie_id);
  res.status(201).json({ id, name, short_code, category, client_rate_per_mw, subbie_rate_per_mw, assigned_subbie_id });
});

router.put('/services/:id', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { name, short_code, category, client_rate_per_mw, subbie_rate_per_mw, assigned_subbie_id } = req.body;

  // Audit log
  const old = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id) as Service | undefined;
  if (old) {
    db.prepare('INSERT INTO rate_audit_log (id, service_id, old_client_rate, new_client_rate, old_subbie_rate, new_subbie_rate, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(randomUUID(), req.params.id, old.client_rate_per_mw, client_rate_per_mw, old.subbie_rate_per_mw, subbie_rate_per_mw, (req as any).user?.userId || null);
  }

  db.prepare('UPDATE services SET name = ?, short_code = ?, category = ?, client_rate_per_mw = ?, subbie_rate_per_mw = ?, assigned_subbie_id = ? WHERE id = ?')
    .run(name, short_code, category, client_rate_per_mw, subbie_rate_per_mw, assigned_subbie_id, req.params.id);
  res.json({ success: true });
});

router.delete('/services/:id', requireRole('admin'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== SUBCONTRACTORS ==========

router.get('/subcontractors', (_req: Request, res: Response) => {
  const subs = db.prepare('SELECT * FROM subcontractors ORDER BY name').all();
  res.json(subs);
});

router.post('/subcontractors', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { name, contact_email, service_category } = req.body;
  if (!name || !contact_email || !service_category) {
    res.status(400).json({ error: 'Name, contact_email, and service_category required' });
    return;
  }
  const id = randomUUID();
  db.prepare('INSERT INTO subcontractors (id, name, contact_email, service_category) VALUES (?, ?, ?, ?)')
    .run(id, name, contact_email, service_category);
  res.status(201).json({ id, name, contact_email, service_category });
});

router.put('/subcontractors/:id', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { name, contact_email, service_category } = req.body;
  db.prepare('UPDATE subcontractors SET name = ?, contact_email = ?, service_category = ? WHERE id = ?')
    .run(name, contact_email, service_category, req.params.id);
  res.json({ success: true });
});

router.delete('/subcontractors/:id', requireRole('admin'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM subcontractors WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== RATE OVERRIDES ==========

router.get('/rate-overrides', (_req: Request, res: Response) => {
  const overrides = db.prepare(`
    SELECT ro.*, s.name as site_name, sv.name as service_name
    FROM rate_overrides ro
    JOIN sites s ON ro.site_id = s.id
    JOIN services sv ON ro.service_id = sv.id
    ORDER BY s.name, sv.name
  `).all();
  res.json(overrides);
});

router.post('/rate-overrides', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { site_id, service_id, client_rate_per_mw, subbie_rate_per_mw, effective_date } = req.body;
  if (!site_id || !service_id || !client_rate_per_mw || !subbie_rate_per_mw) {
    res.status(400).json({ error: 'site_id, service_id, client_rate_per_mw, subbie_rate_per_mw required' });
    return;
  }
  const id = randomUUID();
  db.prepare('INSERT OR REPLACE INTO rate_overrides (id, site_id, service_id, client_rate_per_mw, subbie_rate_per_mw, effective_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, site_id, service_id, client_rate_per_mw, subbie_rate_per_mw, effective_date || new Date().toISOString());
  res.status(201).json({ id, site_id, service_id, client_rate_per_mw, subbie_rate_per_mw, effective_date });
});

router.delete('/rate-overrides/:id', requireRole('admin'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM rate_overrides WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== RATE AUDIT LOG ==========

router.get('/rate-audit', (_req: Request, res: Response) => {
  const entries = db.prepare(`
    SELECT ral.*, s.name as service_name, s.short_code
    FROM rate_audit_log ral
    JOIN services s ON ral.service_id = s.id
    ORDER BY ral.changed_at DESC
  `).all();
  res.json(entries);
});

// ========== CONTACT MATRIX ==========

router.get('/contact-matrix', (_req: Request, res: Response) => {
  const matrix = db.prepare(`
    SELECT cm.*, be.name as entity_name, be.code as entity_code
    FROM contact_matrix cm
    JOIN business_entities be ON cm.business_entity_id = be.id
    ORDER BY be.name, cm.job_category
  `).all();
  res.json(matrix);
});

router.put('/contact-matrix/:id', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { to_emails, cc_emails } = req.body;
  db.prepare('UPDATE contact_matrix SET to_emails = ?, cc_emails = ? WHERE id = ?')
    .run(to_emails, cc_emails, req.params.id);
  res.json({ success: true });
});

router.post('/contact-matrix', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { business_entity_id, job_category, to_emails, cc_emails } = req.body;
  if (!business_entity_id || !job_category) {
    res.status(400).json({ error: 'business_entity_id and job_category required' });
    return;
  }
  const id = randomUUID();
  db.prepare('INSERT OR REPLACE INTO contact_matrix (id, business_entity_id, job_category, to_emails, cc_emails) VALUES (?, ?, ?, ?, ?)')
    .run(id, business_entity_id, job_category, to_emails || '', cc_emails || '');
  res.status(201).json({ id, business_entity_id, job_category, to_emails, cc_emails });
});

export default router;
