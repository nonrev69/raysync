import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import type { Job, JobStatus } from '../types.js';
import { authenticateToken, requireRole } from './auth.js';

const router = Router();
router.use(authenticateToken);

const VALID_STATUSES: JobStatus[] = ['Quoted', 'PO Received', 'Subbie Notified', 'Works Complete', 'Invoiced', 'Paid', 'Closed'];

// GET /api/jobs - list all jobs with site/service details
router.get('/', (req: Request, res: Response) => {
  const { status, site_id, service_id } = req.query;
  let sql = `
    SELECT j.*, s.name as site_name, s.mw_output, s.site_type, be.name as entity_name, be.code as entity_code,
           sv.name as service_name, sv.short_code, sv.category as service_category,
           sub.name as subbie_name, sub.contact_email as subbie_email
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN business_entities be ON s.business_entity_id = be.id
    JOIN services sv ON j.service_id = sv.id
    JOIN subcontractors sub ON sv.assigned_subbie_id = sub.id
  `;
  const conditions: string[] = [];
  const params: any[] = [];

  if (status && VALID_STATUSES.includes(status as JobStatus)) {
    conditions.push('j.status = ?');
    params.push(status);
  }
  if (site_id) {
    conditions.push('j.site_id = ?');
    params.push(site_id);
  }
  if (service_id) {
    conditions.push('j.service_id = ?');
    params.push(service_id);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY j.created_at DESC';

  const jobs = db.prepare(sql).all(...params);
  res.json(jobs);
});

// GET /api/jobs/:id
router.get('/:id', (req: Request, res: Response) => {
  const job = db.prepare(`
    SELECT j.*, s.name as site_name, s.mw_output, s.site_type, be.name as entity_name, be.code as entity_code,
           sv.name as service_name, sv.short_code, sv.category as service_category,
           sub.name as subbie_name, sub.contact_email as subbie_email
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN business_entities be ON s.business_entity_id = be.id
    JOIN services sv ON j.service_id = sv.id
    JOIN subcontractors sub ON sv.assigned_subbie_id = sub.id
    WHERE j.id = ?
  `).get(req.params.id);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json(job);
});

// POST /api/jobs - create new job (quote)
router.post('/', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { site_id, service_id, notes } = req.body;
  if (!site_id || !service_id) {
    res.status(400).json({ error: 'site_id and service_id required' });
    return;
  }

  // Get site and service for rate calculation
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(site_id) as any;
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(service_id) as any;

  if (!site || !service) {
    res.status(400).json({ error: 'Invalid site_id or service_id' });
    return;
  }

  // Check for rate override
  const override = db.prepare('SELECT * FROM rate_overrides WHERE site_id = ? AND service_id = ?').get(site_id, service_id) as any;
  const clientRate = override ? override.client_rate_per_mw : service.client_rate_per_mw;
  const subbieRate = override ? override.subbie_rate_per_mw : service.subbie_rate_per_mw;

  const quoteAmount = site.mw_output * clientRate;
  const subbieCost = site.mw_output * subbieRate;
  const id = randomUUID();

  db.prepare(`
    INSERT INTO jobs (id, site_id, service_id, status, quote_amount, subbie_cost, notes)
    VALUES (?, ?, ?, 'Quoted', ?, ?, ?)
  `).run(id, site_id, service_id, quoteAmount, subbieCost, notes || null);

  const job = db.prepare(`
    SELECT j.*, s.name as site_name, s.mw_output, be.name as entity_name, sv.name as service_name, sv.short_code
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN business_entities be ON s.business_entity_id = be.id
    JOIN services sv ON j.service_id = sv.id
    WHERE j.id = ?
  `).get(id);

  res.status(201).json(job);
});

// PUT /api/jobs/:id - update job (status transitions, PO numbers, etc.)
router.put('/:id', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Job | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const updates: string[] = [];
  const params: any[] = [];

  // Status transition
  if (req.body.status && VALID_STATUSES.includes(req.body.status)) {
    updates.push('status = ?');
    params.push(req.body.status);

    // Set date fields based on status
    const today = new Date().toISOString().split('T')[0];
    if (req.body.status === 'PO Received' && !existing.authorised_date) {
      updates.push('authorised_date = ?');
      params.push(today);
    }
    if (req.body.status === 'Works Complete' && !existing.works_complete_date) {
      updates.push('works_complete_date = ?');
      params.push(today);
    }
    if (req.body.status === 'Invoiced' && !existing.invoiced_date) {
      updates.push('invoiced_date = ?');
      params.push(today);
    }
    if (req.body.status === 'Paid' && !existing.paid_date) {
      updates.push('paid_date = ?');
      params.push(today);
    }
    if (req.body.status === 'Closed' && !existing.closed_date) {
      updates.push('closed_date = ?');
      params.push(today);
    }
  }

  // PO numbers
  if (req.body.client_po_number !== undefined) {
    updates.push('client_po_number = ?');
    params.push(req.body.client_po_number);
  }
  if (req.body.subbie_po_number !== undefined) {
    updates.push('subbie_po_number = ?');
    params.push(req.body.subbie_po_number);
  }

  // Invoice fields
  if (req.body.invoice_number !== undefined) {
    updates.push('invoice_number = ?');
    params.push(req.body.invoice_number);
  }
  if (req.body.invoice_amount !== undefined) {
    updates.push('invoice_amount = ?');
    params.push(req.body.invoice_amount);
  }

  // Subbie invoice fields
  if (req.body.subbie_invoice_number !== undefined) {
    updates.push('subbie_invoice_number = ?');
    params.push(req.body.subbie_invoice_number);
  }
  if (req.body.subbie_invoiced_amount !== undefined) {
    updates.push('subbie_invoiced_amount = ?');
    params.push(req.body.subbie_invoiced_amount);
  }
  if (req.body.subbie_invoice_status !== undefined) {
    updates.push('subbie_invoice_status = ?');
    params.push(req.body.subbie_invoice_status);
  }

  // Links
  if (req.body.report_link !== undefined) {
    updates.push('report_link = ?');
    params.push(req.body.report_link);
  }
  if (req.body.photo_link !== undefined) {
    updates.push('photo_link = ?');
    params.push(req.body.photo_link);
  }
  if (req.body.folder_path !== undefined) {
    updates.push('folder_path = ?');
    params.push(req.body.folder_path);
  }
  if (req.body.notes !== undefined) {
    updates.push('notes = ?');
    params.push(req.body.notes);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  updates.push("updated_at = datetime('now')");
  db.prepare(`UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`).run(...params, id);

  const job = db.prepare(`
    SELECT j.*, s.name as site_name, s.mw_output, be.name as entity_name, sv.name as service_name, sv.short_code
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN business_entities be ON s.business_entity_id = be.id
    JOIN services sv ON j.service_id = sv.id
    WHERE j.id = ?
  `).get(id);

  res.json(job);
});

// DELETE /api/jobs/:id (admin only)
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/jobs/:id/invoice-pdf - generate PDF invoice
router.get('/:id/invoice-pdf', (req: Request, res: Response) => {
  const job = db.prepare(`
    SELECT j.*, s.name as site_name, s.mw_output, be.name as entity_name, be.code as entity_code,
           sv.name as service_name, sv.short_code, sub.name as subbie_name
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN business_entities be ON s.business_entity_id = be.id
    JOIN services sv ON j.service_id = sv.id
    JOIN subcontractors sub ON sv.assigned_subbie_id = sub.id
    WHERE j.id = ?
  `).get(req.params.id) as any;

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  // Generate simple text-based PDF
  const pdfContent = [
    'INVOICE',
    '',
    `Invoice Number: ${job.invoice_number || 'N/A'}`,
    `Date: ${job.invoiced_date || new Date().toLocaleDateString('en-GB')}`,
    `Client PO: ${job.client_po_number || 'N/A'}`,
    `Entity: ${job.entity_name}`,
    `Site: ${job.site_name} (${job.mw_output} MW)`,
    `Service: ${job.service_name}`,
    '',
    `Total: \u00A3${(job.invoice_amount || job.quote_amount).toFixed(2)}`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="Invoice_${job.invoice_number}_PO_${job.client_po_number}.txt"`);
  res.send(pdfContent);
});

// GET /api/jobs/:id/quote-pdf - generate PDF quote
router.get('/:id/quote-pdf', (req: Request, res: Response) => {
  const job = db.prepare(`
    SELECT j.*, s.name as site_name, s.mw_output, be.name as entity_name, be.code as entity_code,
           sv.name as service_name, sv.short_code
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN business_entities be ON s.business_entity_id = be.id
    JOIN services sv ON j.service_id = sv.id
    WHERE j.id = ?
  `).get(req.params.id) as any;

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const pdfContent = [
    'QUOTATION',
    '',
    `Date: ${new Date().toLocaleDateString('en-GB')}`,
    `Entity: ${job.entity_name}`,
    `Site: ${job.site_name} (${job.mw_output} MW)`,
    `Service: ${job.service_name}`,
    '',
    `Total: \u00A3${job.quote_amount.toFixed(2)}`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="Quote_${job.site_name}_${job.service_name}.txt"`);
  res.send(pdfContent);
});

// GET /api/jobs/:id/subbie-po-pdf - generate subcontractor PO
router.get('/:id/subbie-po-pdf', (req: Request, res: Response) => {
  const job = db.prepare(`
    SELECT j.*, s.name as site_name, s.mw_output, be.name as entity_name,
           sv.name as service_name, sv.short_code, sub.name as subbie_name, sub.contact_email as subbie_email
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN business_entities be ON s.business_entity_id = be.id
    JOIN services sv ON j.service_id = sv.id
    JOIN subcontractors sub ON sv.assigned_subbie_id = sub.id
    WHERE j.id = ?
  `).get(req.params.id) as any;

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const pdfContent = [
    'PURCHASE ORDER',
    '',
    `PO Number: ${job.subbie_po_number || 'N/A'}`,
    `Date: ${new Date().toLocaleDateString('en-GB')}`,
    `Subcontractor: ${job.subbie_name}`,
    `Site: ${job.site_name} (${job.mw_output} MW)`,
    `Service: ${job.service_name}`,
    '',
    `Total: \u00A3${job.subbie_cost.toFixed(2)}`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="SubbiePO_${job.subbie_po_number}_${job.subbie_name}.txt"`);
  res.send(pdfContent);
});

export default router;
