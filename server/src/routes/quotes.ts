import { Router, Request, Response } from 'express';
import db from '../db.js';
import { shortId } from '../crypto.js';
import { authenticateToken, requireRole } from './auth.js';

const router = Router();
router.use(authenticateToken);

interface LineInput {
  site_id: string;
  service_id: string;
}

/** Resolve the effective rates for a site+service, honouring per-site overrides. */
function resolveRates(siteId: string, serviceId: string) {
  const site = db.prepare('SELECT mw_output FROM sites WHERE id = ?').get(siteId) as any;
  const service = db.prepare('SELECT client_rate_per_mw, subbie_rate_per_mw FROM services WHERE id = ?').get(serviceId) as any;
  if (!site || !service) return null;

  const override = db.prepare('SELECT client_rate_per_mw, subbie_rate_per_mw FROM rate_overrides WHERE site_id = ? AND service_id = ?').get(siteId, serviceId) as any;
  const clientRate = override ? override.client_rate_per_mw : service.client_rate_per_mw;
  const subbieRate = override ? override.subbie_rate_per_mw : service.subbie_rate_per_mw;

  return {
    mw: site.mw_output,
    clientRate,
    subbieRate,
    lineAmount: Math.round(site.mw_output * clientRate * 100) / 100,
    subbieCost: Math.round(site.mw_output * subbieRate * 100) / 100,
  };
}

/** Load a quote with its line items and joined names. */
function loadQuote(id: string) {
  const quote = db.prepare(`
    SELECT q.*, be.name as entity_name, be.code as entity_code
    FROM quotes q
    JOIN business_entities be ON q.business_entity_id = be.id
    WHERE q.id = ?
  `).get(id) as any;
  if (!quote) return null;

  quote.lines = db.prepare(`
    SELECT ql.*, s.name as site_name, s.site_type,
           sv.name as service_name, sv.short_code, sv.category,
           sub.name as subbie_name, sub.contact_email as subbie_email
    FROM quote_lines ql
    JOIN sites s ON ql.site_id = s.id
    JOIN services sv ON ql.service_id = sv.id
    JOIN subcontractors sub ON sv.assigned_subbie_id = sub.id
    WHERE ql.quote_id = ?
    ORDER BY ql.sort_order, ql.created_at
  `).all(id);

  return quote;
}

function recalcTotal(quoteId: string) {
  const row = db.prepare('SELECT COALESCE(SUM(line_amount), 0) as total FROM quote_lines WHERE quote_id = ?').get(quoteId) as any;
  db.prepare("UPDATE quotes SET total_amount = ?, updated_at = datetime('now') WHERE id = ?").run(row.total, quoteId);
  return row.total;
}

// GET /api/quotes - list all quotes with line counts
router.get('/', (_req: Request, res: Response) => {
  const quotes = db.prepare(`
    SELECT q.*, be.name as entity_name, be.code as entity_code,
           (SELECT COUNT(*) FROM quote_lines ql WHERE ql.quote_id = q.id) as line_count
    FROM quotes q
    JOIN business_entities be ON q.business_entity_id = be.id
    ORDER BY q.created_at DESC
  `).all();
  res.json(quotes);
});

// GET /api/quotes/:id
router.get('/:id', (req: Request, res: Response) => {
  const quote = loadQuote(req.params.id);
  if (!quote) {
    res.status(404).json({ error: 'Quote not found' });
    return;
  }
  res.json(quote);
});

// POST /api/quotes - create a multi-service quote
router.post('/', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { business_entity_id, lines, invoice_mode, notes } = req.body as {
    business_entity_id?: string;
    lines?: LineInput[];
    invoice_mode?: 'split' | 'combined';
    notes?: string;
  };

  if (!business_entity_id || !Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ error: 'business_entity_id and at least one line are required' });
    return;
  }

  const mode = invoice_mode === 'combined' ? 'combined' : 'split';
  const id = shortId();
  const seq = (db.prepare('SELECT COUNT(*) as n FROM quotes').get() as any).n + 1;
  const quoteRef = `Q-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;

  const insertLine = db.prepare(`
    INSERT INTO quote_lines (id, quote_id, site_id, service_id, mw_output, client_rate_per_mw, subbie_rate_per_mw, line_amount, subbie_cost, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = () => {
    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO quotes (id, quote_ref, business_entity_id, status, invoice_mode, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, quoteRef, business_entity_id, 'Draft', mode, notes || null);

      lines.forEach((line, i) => {
        const r = resolveRates(line.site_id, line.service_id);
        if (!r) throw new Error(`Invalid site or service: ${line.site_id}/${line.service_id}`);
        insertLine.run(shortId(), id, line.site_id, line.service_id, r.mw, r.clientRate, r.subbieRate, r.lineAmount, r.subbieCost, i);
      });

      recalcTotal(id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  try {
    tx();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  res.status(201).json(loadQuote(id));
});

// PUT /api/quotes/:id - update meta (status, invoice_mode, PO, notes)
router.put('/:id', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id) as any;
  if (!quote) {
    res.status(404).json({ error: 'Quote not found' });
    return;
  }

  const updates: string[] = [];
  const params: any[] = [];
  for (const field of ['status', 'invoice_mode', 'client_po_number', 'notes'] as const) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }
  if (updates.length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }
  updates.push("updated_at = datetime('now')");
  db.prepare(`UPDATE quotes SET ${updates.join(', ')} WHERE id = ?`).run(...params, req.params.id);
  res.json(loadQuote(req.params.id));
});

// POST /api/quotes/:id/lines - add a line item
router.post('/:id/lines', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const quote = db.prepare('SELECT id FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) {
    res.status(404).json({ error: 'Quote not found' });
    return;
  }
  const { site_id, service_id } = req.body as LineInput;
  const r = resolveRates(site_id, service_id);
  if (!r) {
    res.status(400).json({ error: 'Invalid site or service' });
    return;
  }
  const order = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM quote_lines WHERE quote_id = ?').get(req.params.id) as any).n;
  db.prepare(`
    INSERT INTO quote_lines (id, quote_id, site_id, service_id, mw_output, client_rate_per_mw, subbie_rate_per_mw, line_amount, subbie_cost, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(shortId(), req.params.id, site_id, service_id, r.mw, r.clientRate, r.subbieRate, r.lineAmount, r.subbieCost, order);
  recalcTotal(req.params.id);
  res.status(201).json(loadQuote(req.params.id));
});

// DELETE /api/quotes/:id/lines/:lineId
router.delete('/:id/lines/:lineId', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM quote_lines WHERE id = ? AND quote_id = ?').run(req.params.lineId, req.params.id);
  recalcTotal(req.params.id);
  res.json(loadQuote(req.params.id));
});

// DELETE /api/quotes/:id
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/**
 * POST /api/quotes/:id/accept
 * Converts an accepted quote into jobs. This is where invoice_mode matters:
 *  - split:    one job per line item (each invoiced separately, each carries the LC PO)
 *  - combined: one job covering the whole quote, with a generated line summary
 */
router.post('/:id/accept', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const quote = loadQuote(req.params.id) as any;
  if (!quote) {
    res.status(404).json({ error: 'Quote not found' });
    return;
  }
  if (quote.status === 'Accepted') {
    res.status(409).json({ error: 'Quote already accepted' });
    return;
  }
  if (!quote.lines || quote.lines.length === 0) {
    res.status(400).json({ error: 'Quote has no line items' });
    return;
  }

  const clientPO = req.body?.client_po_number || quote.client_po_number || null;
  const createdJobIds: string[] = [];

  db.exec('BEGIN');
  try {
    if (quote.invoice_mode === 'combined') {
      // One job for the whole quote. Uses the first line's site/service as the
      // primary record and folds the remaining lines into the notes.
      const first = quote.lines[0];
      const jobId = shortId();
      const summary = quote.lines
        .map((l: any) => `${l.site_name} — ${l.service_name} (${l.mw_output} MW) £${l.line_amount.toFixed(2)}`)
        .join('; ');
      const totalSubbie = quote.lines.reduce((s: number, l: any) => s + l.subbie_cost, 0);

      db.prepare(`
        INSERT INTO jobs (id, site_id, service_id, status, client_po_number, quote_amount, subbie_cost, notes)
        VALUES (?, ?, ?, 'Quoted', ?, ?, ?, ?)
      `).run(jobId, first.site_id, first.service_id, clientPO, quote.total_amount, totalSubbie, `Combined quote ${quote.quote_ref}: ${summary}`);

      db.prepare('UPDATE quote_lines SET job_id = ? WHERE quote_id = ?').run(jobId, quote.id);
      createdJobIds.push(jobId);
    } else {
      // Split: one job per line, all sharing the client PO.
      for (const line of quote.lines) {
        const jobId = shortId();
        db.prepare(`
          INSERT INTO jobs (id, site_id, service_id, status, client_po_number, quote_amount, subbie_cost, notes)
          VALUES (?, ?, ?, 'Quoted', ?, ?, ?, ?)
        `).run(jobId, line.site_id, line.service_id, clientPO, line.line_amount, line.subbie_cost, `From quote ${quote.quote_ref}`);
        db.prepare('UPDATE quote_lines SET job_id = ? WHERE id = ?').run(jobId, line.id);
        createdJobIds.push(jobId);
      }
    }

    db.prepare("UPDATE quotes SET status = 'Accepted', client_po_number = ?, updated_at = datetime('now') WHERE id = ?")
      .run(clientPO, quote.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: (err as Error).message });
    return;
  }

  res.json({
    success: true,
    invoice_mode: quote.invoice_mode,
    jobs_created: createdJobIds.length,
    job_ids: createdJobIds,
  });
});

export default router;
