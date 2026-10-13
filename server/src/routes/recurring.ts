import { Router, Request, Response } from 'express';
import db from '../db.js';
import { shortId } from '../crypto.js';
import { authenticateToken, requireRole } from './auth.js';

const router = Router();
router.use(authenticateToken);

const INTERVAL_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
  'one-off': 9999,
};

/** Month numbers in a season window, tolerating wrap-around (e.g. Nov → Feb). */
function inSeason(startMonth: number, endMonth: number, month: number): boolean {
  if (startMonth <= endMonth) return month >= startMonth && month <= endMonth;
  return month >= startMonth || month <= endMonth; // wraps year end
}

/** Whole months between a stored date and the target YYYY-MM. */
function monthsSince(fromIso: string, targetYear: number, targetMonth: number): number {
  const d = new Date(fromIso);
  if (isNaN(d.getTime())) return 9999;
  return (targetYear - d.getFullYear()) * 12 + (targetMonth - (d.getMonth() + 1));
}

interface PlanRow {
  id: string;
  site_id: string;
  service_id: string;
  frequency: string;
  season_start_month: number;
  season_end_month: number;
  last_generated_date: string | null;
  is_active: number;
  notes: string | null;
  // joined
  site_name?: string;
  mw_output?: number;
  entity_id?: string;
  entity_name?: string;
  entity_code?: string;
  service_name?: string;
  short_code?: string;
  category?: string;
  subbie_name?: string;
  client_rate_per_mw?: number;
  subbie_rate_per_mw?: number;
}

const PLAN_SELECT = `
  SELECT rp.*, s.name AS site_name, s.mw_output, s.business_entity_id AS entity_id,
         be.name AS entity_name, be.code AS entity_code,
         sv.name AS service_name, sv.short_code, sv.category,
         sv.client_rate_per_mw, sv.subbie_rate_per_mw,
         sub.name AS subbie_name
  FROM recurring_plans rp
  JOIN sites s        ON rp.site_id = s.id
  JOIN business_entities be ON s.business_entity_id = be.id
  JOIN services sv    ON rp.service_id = sv.id
  JOIN subcontractors sub ON sv.assigned_subbie_id = sub.id
`;

/** Rate for a plan, honouring a per-site override. */
function planRates(plan: PlanRow) {
  const override = db
    .prepare('SELECT client_rate_per_mw, subbie_rate_per_mw FROM rate_overrides WHERE site_id = ? AND service_id = ?')
    .get(plan.site_id, plan.service_id) as any;
  const clientRate = override ? override.client_rate_per_mw : plan.client_rate_per_mw!;
  const subbieRate = override ? override.subbie_rate_per_mw : plan.subbie_rate_per_mw!;
  return {
    clientRate,
    subbieRate,
    lineAmount: Math.round(plan.mw_output! * clientRate * 100) / 100,
    subbieCost: Math.round(plan.mw_output! * subbieRate * 100) / 100,
  };
}

interface DueLine extends PlanRow {
  mw_output: number;
  entity_id: string;
  entity_name: string;
  entity_code: string;
  lineAmount: number;
  subbieCost: number;
  clientRate: number;
  subbieRate: number;
  reason: string;
}

/** Which plans fall due in a given YYYY-MM, and why. */
function computeDue(year: number, month: number): DueLine[] {
  const plans = db.prepare(`${PLAN_SELECT} WHERE rp.is_active = 1 ORDER BY s.name, sv.name`).all() as unknown as PlanRow[];

  const due: DueLine[] = [];

  for (const p of plans) {
    if (!inSeason(p.season_start_month, p.season_end_month, month)) continue;

    const interval = INTERVAL_MONTHS[p.frequency] ?? 12;
    let reason: string | null = null;

    if (!p.last_generated_date) {
      reason = 'Never scheduled before';
    } else {
      const since = monthsSince(p.last_generated_date, year, month);
      if (since >= interval) reason = `${since} months since last scheduled (every ${interval})`;
    }

    if (reason) {
      const r = planRates(p);
      due.push({
        ...p,
        mw_output: p.mw_output!,
        entity_id: p.entity_id!,
        entity_name: p.entity_name!,
        entity_code: p.entity_code!,
        ...r,
        reason,
      });
    }
  }

  return due;
}

/** Parse and validate a YYYY-MM period. */
function parsePeriod(raw: unknown): { year: number; month: number } | null {
  const s = String(raw || '');
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * The date stamped on a plan when a period is generated.
 *
 * This must be the *scheduled period* (first of the month), NOT wall-clock "now".
 * The interval maths compares this against the period being previewed, so stamping
 * the real current date makes a plan look overdue the moment it's generated.
 */
function periodStamp(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

// ---------- Plan CRUD ----------

// GET /api/recurring
router.get('/', (_req: Request, res: Response) => {
  const plans = db.prepare(`${PLAN_SELECT} ORDER BY s.name, sv.name`).all();
  res.json(plans);
});

// POST /api/recurring
router.post('/', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const { site_id, service_id, frequency, season_start_month, season_end_month, notes } = req.body;
  if (!site_id || !service_id) {
    res.status(400).json({ error: 'site_id and service_id are required' });
    return;
  }
  const existing = db.prepare('SELECT id FROM recurring_plans WHERE site_id = ? AND service_id = ?').get(site_id, service_id);
  if (existing) {
    res.status(409).json({ error: 'A plan already exists for that site and service' });
    return;
  }
  const id = shortId();
  db.prepare(`
    INSERT INTO recurring_plans (id, site_id, service_id, frequency, season_start_month, season_end_month, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, site_id, service_id,
    frequency || 'annual',
    season_start_month ?? 1,
    season_end_month ?? 12,
    notes || null
  );
  res.status(201).json(db.prepare(`${PLAN_SELECT} WHERE rp.id = ?`).get(id));
});

// PUT /api/recurring/:id
router.put('/:id', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const plan = db.prepare('SELECT * FROM recurring_plans WHERE id = ?').get(req.params.id);
  if (!plan) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }
  const fields = ['frequency', 'season_start_month', 'season_end_month', 'is_active', 'notes'] as const;
  const updates: string[] = [];
  const params: any[] = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  }
  if (updates.length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }
  updates.push("updated_at = datetime('now')");
  db.prepare(`UPDATE recurring_plans SET ${updates.join(', ')} WHERE id = ?`).run(...params, req.params.id);
  res.json(db.prepare(`${PLAN_SELECT} WHERE rp.id = ?`).get(req.params.id));
});

// DELETE /api/recurring/:id
router.delete('/:id', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM recurring_plans WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ---------- Seasonal generation ----------

// GET /api/recurring/due?period=YYYY-MM  — preview, no side effects
router.get('/due', (req: Request, res: Response) => {
  const period = parsePeriod(req.query.period);
  if (!period) {
    res.status(400).json({ error: 'period must be YYYY-MM (e.g. 2027-04)' });
    return;
  }
  const due = computeDue(period.year, period.month);

  // Group by entity — a quote is issued per business entity.
  const byEntity = new Map<string, { entity_id: string; entity_name: string; entity_code: string; lines: any[]; total: number }>();
  for (const d of due) {
    if (!byEntity.has(d.entity_id!)) {
      byEntity.set(d.entity_id!, {
        entity_id: d.entity_id!,
        entity_name: d.entity_name!,
        entity_code: d.entity_code!,
        lines: [],
        total: 0,
      });
    }
    const g = byEntity.get(d.entity_id!)!;
    g.lines.push(d);
    g.total += d.lineAmount;
  }

  res.json({
    period: `${period.year}-${String(period.month).padStart(2, '0')}`,
    total_due: due.length,
    total_value: Math.round(due.reduce((s, d) => s + d.lineAmount, 0) * 100) / 100,
    groups: Array.from(byEntity.values()),
  });
});

/**
 * POST /api/recurring/generate  { period: "YYYY-MM", invoice_mode?: "split"|"combined" }
 * Creates one DRAFT quote per business entity, pre-filled with that entity's due
 * lines, and stamps last_generated_date so the same period can't be double-generated.
 */
router.post('/generate', requireRole('admin', 'editor'), (req: Request, res: Response) => {
  const period = parsePeriod(req.body?.period);
  if (!period) {
    res.status(400).json({ error: 'period must be YYYY-MM (e.g. 2027-04)' });
    return;
  }
  const mode = req.body?.invoice_mode === 'combined' ? 'combined' : 'split';

  const due = computeDue(period.year, period.month);
  if (due.length === 0) {
    res.json({ period: `${period.year}-${String(period.month).padStart(2, '0')}`, quotes_created: 0, quotes: [], message: 'Nothing due for this period.' });
    return;
  }

  const periodLabel = `${period.year}-${String(period.month).padStart(2, '0')}`;
  const created: any[] = [];

  db.exec('BEGIN');
  try {
    // Group by entity
    const byEntity = new Map<string, typeof due>();
    for (const d of due) {
      const list = byEntity.get(d.entity_id!) || [];
      list.push(d);
      byEntity.set(d.entity_id!, list);
    }

    for (const [entityId, lines] of byEntity) {
      const quoteId = shortId();
      const seq = (db.prepare('SELECT COUNT(*) as n FROM quotes').get() as any).n + 1;
      const quoteRef = `Q-${period.year}-${String(seq).padStart(4, '0')}`;

      db.prepare('INSERT INTO quotes (id, quote_ref, business_entity_id, status, invoice_mode, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(quoteId, quoteRef, entityId, 'Draft', mode, `Generated from maintenance schedule for ${periodLabel}`);

      let order = 0;
      let total = 0;
      for (const l of lines) {
        db.prepare(`
          INSERT INTO quote_lines (id, quote_id, site_id, service_id, mw_output, client_rate_per_mw, subbie_rate_per_mw, line_amount, subbie_cost, sort_order, plan_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(shortId(), quoteId, l.site_id, l.service_id, l.mw_output, l.clientRate, l.subbieRate, l.lineAmount, l.subbieCost, order++, l.id);

        db.prepare("UPDATE recurring_plans SET last_generated_date = ?, updated_at = datetime('now') WHERE id = ?")
          .run(periodStamp(period.year, period.month), l.id);
        total += l.lineAmount;
      }

      db.prepare("UPDATE quotes SET total_amount = ?, updated_at = datetime('now') WHERE id = ?").run(Math.round(total * 100) / 100, quoteId);

      created.push({ id: quoteId, quote_ref: quoteRef, entity_id: entityId, entity_name: lines[0].entity_name, lines: lines.length, total: Math.round(total * 100) / 100 });
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: (err as Error).message });
    return;
  }

  res.status(201).json({
    period: periodLabel,
    quotes_created: created.length,
    lines_scheduled: due.length,
    quotes: created,
  });
});

export default router;
