import { Router, Response } from 'express';
import db from '../db.js';
import { authenticateToken } from './auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/dashboard - summary stats
router.get('/dashboard', (_req: any, res: Response) => {
  const totalJobs = (db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any).count;
  const activeJobs = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status NOT IN ('Paid', 'Closed')").get() as any).count;
  const quoted = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'Quoted'").get() as any).count;
  const poReceived = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'PO Received'").get() as any).count;
  const subbieNotified = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'Subbie Notified'").get() as any).count;
  const worksComplete = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'Works Complete'").get() as any).count;
  const invoiced = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'Invoiced'").get() as any).count;
  const paid = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'Paid'").get() as any).count;
  const closed = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'Closed'").get() as any).count;

  // Outstanding balance (invoiced but not paid)
  const outstandingResult = db.prepare("SELECT COALESCE(SUM(invoice_amount), 0) as total FROM jobs WHERE status = 'Invoiced'").get() as any;
  const outstandingBalance = outstandingResult.total;

  // Overdue jobs (PO Received > 30 days ago, no works complete)
  const overdueJobs = (db.prepare(`
    SELECT COUNT(*) as count FROM jobs
    WHERE status IN ('PO Received', 'Subbie Notified')
    AND authorised_date IS NOT NULL
    AND julianday('now') - julianday(authorised_date) > 30
  `).get() as any).count;

  // Overdue invoices (Invoiced > 60 days ago, not paid)
  const overdueInvoices = (db.prepare(`
    SELECT COUNT(*) as count FROM jobs
    WHERE status = 'Invoiced'
    AND invoiced_date IS NOT NULL
    AND julianday('now') - julianday(invoiced_date) > 60
  `).get() as any).count;

  // Total revenue (all invoiced + paid)
  const totalRevenueResult = db.prepare("SELECT COALESCE(SUM(invoice_amount), 0) as total FROM jobs WHERE status IN ('Invoiced', 'Paid', 'Closed')").get() as any;
  const totalRevenue = totalRevenueResult.total;

  // Total costs — only on jobs that have been billed, so it aligns with totalRevenue
  const totalCostsResult = db.prepare("SELECT COALESCE(SUM(subbie_cost), 0) as total FROM jobs WHERE status IN ('Invoiced', 'Paid', 'Closed')").get() as any;
  const totalCosts = totalCostsResult.total;

  // Recent jobs (last 10)
  const recentJobs = db.prepare(`
    SELECT j.*, s.name as site_name, sv.name as service_name, sv.short_code
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN services sv ON j.service_id = sv.id
    ORDER BY j.created_at DESC
    LIMIT 10
  `).all();

  // Jobs by status for kanban
  const jobsByStatus = db.prepare(`
    SELECT j.*, s.name as site_name, sv.name as service_name, sv.short_code, sub.name as subbie_name
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN services sv ON j.service_id = sv.id
    JOIN subcontractors sub ON sv.assigned_subbie_id = sub.id
    WHERE j.status NOT IN ('Paid', 'Closed')
    ORDER BY j.created_at DESC
  `).all();

  // Revenue by site (for charts)
  const revenueBySite = db.prepare(`
    SELECT s.name as site_name, COALESCE(SUM(j.invoice_amount), 0) as revenue, COALESCE(SUM(j.subbie_cost), 0) as cost
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    WHERE j.status IN ('Invoiced', 'Paid', 'Closed')
    GROUP BY s.id
    ORDER BY revenue DESC
  `).all();

  // Monthly revenue (last 12 months)
  const monthlyRevenue = db.prepare(`
    SELECT strftime('%Y-%m', invoiced_date) as month, COALESCE(SUM(invoice_amount), 0) as revenue
    FROM jobs
    WHERE status IN ('Invoiced', 'Paid', 'Closed')
    AND invoiced_date IS NOT NULL
    GROUP BY strftime('%Y-%m', invoiced_date)
    ORDER BY month DESC
    LIMIT 12
  `).all();

  // VAT liability (20% of invoiced amounts)
  const vatLiability = (outstandingBalance + totalRevenue) * 0.2;

  res.json({
    totalJobs,
    activeJobs,
    statusCounts: { quoted, poReceived, subbieNotified, worksComplete, invoiced, paid, closed },
    outstandingBalance,
    overdueJobs,
    overdueInvoices,
    totalRevenue,
    totalCosts,
    profit: totalRevenue - totalCosts,
    vatLiability,
    recentJobs,
    jobsByStatus,
    revenueBySite,
    monthlyRevenue,
  });
});

// GET /api/dashboard/calendar - jobs for calendar view
router.get('/calendar', (req: any, res: Response) => {
  const { month, year } = req.query;
  let sql = `
    SELECT j.*, s.name as site_name, sv.name as service_name, sv.short_code, sub.name as subbie_name
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN services sv ON j.service_id = sv.id
    JOIN subcontractors sub ON sv.assigned_subbie_id = sub.id
  `;
  const params: any[] = [];

  if (month && year) {
    sql += ` WHERE strftime('%Y-%m', j.authorised_date) = ?`;
    params.push(`${year}-${month.toString().padStart(2, '0')}`);
  }

  sql += ' ORDER BY j.authorised_date ASC';
  const jobs = db.prepare(sql).all(...params);
  res.json(jobs);
});

// GET /api/dashboard/reconciliation - sent invoices for matching
router.get('/reconciliation', (_req: any, res: Response) => {
  const sentInvoices = db.prepare(`
    SELECT j.*, s.name as site_name, sv.name as service_name, sv.short_code
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN services sv ON j.service_id = sv.id
    WHERE j.status = 'Invoiced'
    ORDER BY j.invoiced_date DESC
  `).all();

  const recentlyPaid = db.prepare(`
    SELECT j.*, s.name as site_name, sv.name as service_name, sv.short_code
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN services sv ON j.service_id = sv.id
    WHERE j.status = 'Paid'
    ORDER BY j.paid_date DESC
    LIMIT 20
  `).all();

  res.json({ sentInvoices, recentlyPaid });
});

// GET /api/dashboard/subbie-invoices - subcontractor invoice tracking
router.get('/subbie-invoices', (_req: any, res: Response) => {
  const subbieInvoices = db.prepare(`
    SELECT j.*, s.name as site_name, sv.name as service_name, sv.short_code, sub.name as subbie_name
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN services sv ON j.service_id = sv.id
    JOIN subcontractors sub ON sv.assigned_subbie_id = sub.id
    WHERE j.subbie_invoice_status IS NOT NULL AND j.subbie_invoice_status != 'pending'
    ORDER BY j.updated_at DESC
  `).all();

  const pendingSubbieInvoices = db.prepare(`
    SELECT j.*, s.name as site_name, sv.name as service_name, sv.short_code, sub.name as subbie_name
    FROM jobs j
    JOIN sites s ON j.site_id = s.id
    JOIN services sv ON j.service_id = sv.id
    JOIN subcontractors sub ON sv.assigned_subbie_id = sub.id
    WHERE j.status IN ('Works Complete', 'Invoiced')
    AND (j.subbie_invoice_status IS NULL OR j.subbie_invoice_status = 'pending')
    ORDER BY j.works_complete_date DESC
  `).all();

  res.json({ subbieInvoices, pendingSubbieInvoices });
});

export default router;
