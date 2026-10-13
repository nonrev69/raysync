import { useState, useEffect } from 'react';
import { IconFileText, IconBriefcase, IconCheckCircle, IconAlertTriangle, IconTrendingUp, IconDollarSign, IconX } from './icons';
import api from '../api';
import type { DashboardStats, Job, Site, Service, BusinessEntity, Subcontractor, ContactMatrix } from '../types';

/**
 * Lightweight dependency-free SVG sparkline/area chart.
 * Replaces recharts, which is incompatible with React 19.2 (useContext null crash).
 */
function Sparkline({ data, width = 800, height = 160 }: { data: { month: string; revenue: number }[]; width?: number; height?: number }) {
  if (!data || data.length === 0) {
    return <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', padding: '2rem', textAlign: 'center' }}>No revenue data yet.</p>;
  }

  const pts = [...data].reverse(); // oldest → newest
  const padX = 44;
  const padY = 24;
  const max = Math.max(...pts.map(p => p.revenue), 1);
  const innerW = width - padX - 16;
  const innerH = height - padY - 24;

  const x = (i: number) => padX + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
  const y = (v: number) => padY + innerH - (v / max) * innerH;

  const linePts = pts.map((p, i) => `${x(i)},${y(p.revenue)}`).join(' ');
  const areaPts = `${padX},${padY + innerH} ${linePts} ${x(pts.length - 1)},${padY + innerH}`;

  const fmtK = (v: number) => (v >= 1000 ? `\u00A3${(v / 1000).toFixed(0)}k` : `\u00A3${v.toFixed(0)}`);

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: 480, display: 'block' }} role="img" aria-label="Monthly revenue chart">
        <defs>
          <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-green)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--brand-green)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* horizontal gridlines + y labels */}
        {[0, 0.5, 1].map((t, i) => {
          const gy = padY + innerH - t * innerH;
          return (
            <g key={i}>
              <line x1={padX} y1={gy} x2={width - 16} y2={gy} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
              <text x={padX - 8} y={gy + 4} textAnchor="end" fontSize={11} fill="var(--ink-muted)">{fmtK(max * t)}</text>
            </g>
          );
        })}

        <polygon points={areaPts} fill="url(#revGradient)" />
        <polyline points={linePts} fill="none" stroke="var(--brand-green-dark)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.revenue)} r={3.5} fill="var(--canvas-raised)" stroke="var(--brand-green-dark)" strokeWidth={2}>
              <title>{p.month}: {fmtK(p.revenue)}</title>
            </circle>
            <text x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--ink-muted)">{p.month.slice(5)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

interface DashboardProps {
  sites: Site[];
  services: Service[];
  entities: BusinessEntity[];
  subcontractors: Subcontractor[];
  contactMatrix: ContactMatrix[];
  refresh: () => void;
  onNavigate?: (tab: string) => void;
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

/** Pipeline order — advancing/reverting walks this list. */
const JOB_STATUSES = ['Quoted', 'PO Received', 'Subbie Notified', 'Works Complete', 'Invoiced', 'Paid', 'Closed'] as const;

export default function Dashboard({ refresh, onNavigate, showToast }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [moving, setMoving] = useState(false);

  const statusIdx = (s: string) => (JOB_STATUSES as readonly string[]).indexOf(s);

  /** Advance (+1) or revert (-1) the selected job one step along the pipeline. */
  const moveJob = async (direction: 1 | -1) => {
    if (!selectedJob) return;
    const idx = statusIdx(selectedJob.status);
    const nextIdx = idx + direction;
    if (idx < 0 || nextIdx < 0 || nextIdx >= JOB_STATUSES.length) return;
    const next = JOB_STATUSES[nextIdx];

    // Business rule: an invoice is rejected by the client without the LC PO
    // number, so refuse to enter 'Invoiced' while it is missing.
    if (next === 'Invoiced' && !selectedJob.client_po_number) {
      showToast?.('error', `Cannot mark as Invoiced — ${selectedJob.site_name} has no client PO number. Add it in the Jobs tab first.`);
      return;
    }

    setMoving(true);
    try {
      const updated = await api.updateJob(selectedJob.id, { status: next });
      setSelectedJob(updated as unknown as Job);
      showToast?.('success', `${selectedJob.site_name} — ${selectedJob.status} → ${next}`);
      refresh();
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to update status');
    } finally {
      setMoving(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [refresh]);

  const loadDashboard = async () => {
    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="app-loading"><div className="loading-spinner" /><p>Loading dashboard...</p></div>;
  }

  if (!stats) {
    return <div className="card"><p>Failed to load dashboard data.</p></div>;
  }

  const fmt = (n: number) => `\u00A3${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

  const statCards = [
    { label: 'Total Jobs', value: stats.totalJobs, subtitle: `${stats.activeJobs} active`, icon: <IconBriefcase size={20} />, color: 'var(--action-blue)', bg: 'var(--action-blue-light)' },
    { label: 'Outstanding Balance', value: fmt(stats.outstandingBalance), subtitle: `${stats.overdueInvoices} overdue invoices`, icon: <IconAlertTriangle size={20} />, color: 'var(--warning)', bg: '#FEF3C7' },
    { label: 'Total Revenue', value: fmt(stats.totalRevenue), subtitle: `Profit: ${fmt(stats.profit)}`, icon: <IconTrendingUp size={20} />, color: 'var(--success)', bg: '#DCFCE7' },
    { label: 'VAT Liability', value: fmt(stats.vatLiability), subtitle: 'Estimated', icon: <IconDollarSign size={20} />, color: 'var(--status-paid)', bg: '#E0F2FE' },
  ];

  const kanbanColumns = [
    { status: 'Quoted', color: 'var(--status-pending)' },
    { status: 'PO Received', color: 'var(--status-authorised)' },
    { status: 'Subbie Notified', color: 'var(--status-works)' },
    { status: 'Works Complete', color: 'var(--status-works)' },
    { status: 'Invoiced', color: 'var(--status-invoiced)' },
    { status: 'Paid', color: 'var(--status-paid)' },
    { status: 'Closed', color: 'var(--status-closed)' },
  ];

  const quickActions = [
    { label: 'New Quote', icon: <IconFileText size={18} />, tab: 'quoting' },
    { label: 'View Jobs', icon: <IconBriefcase size={18} />, tab: 'jobs' },
    { label: 'Reconciliation', icon: <IconCheckCircle size={18} />, tab: 'reconciliation' },
  ];

  return (
    <div className="tab-content">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Dashboard</h1>

      {/* Stat Cards */}
      <div className="stat-grid">
        {statCards.map(card => (
          <div key={card.label} className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon" style={{ background: card.bg, color: card.color }}>
                {card.icon}
              </div>
              <div className="stat-label">{card.label}</div>
            </div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-subtitle">{card.subtitle}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      {onNavigate && (
        <div className="quick-actions">
          {quickActions.map(action => (
            <button
              key={action.label}
              className="quick-action-btn"
              onClick={() => onNavigate(action.tab)}
            >
              <span className="quick-action-icon">{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Overdue Alerts */}
      {(stats.overdueJobs > 0 || stats.overdueInvoices > 0) && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          {stats.overdueJobs > 0 && (
            <div className="card" style={{ flex: 1, borderColor: 'var(--warning)' }}>
              <strong>{stats.overdueJobs} overdue jobs</strong>
              <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>PO Received &gt;30 days with no Works Complete</p>
            </div>
          )}
          {stats.overdueInvoices > 0 && (
            <div className="card" style={{ flex: 1, borderColor: 'var(--danger)' }}>
              <strong>{stats.overdueInvoices} overdue invoices</strong>
              <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>Sent &gt;60 days unpaid</p>
            </div>
          )}
        </div>
      )}

      {/* Mini Revenue Chart (lightweight SVG, no recharts dependency) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Monthly Revenue</span>
        </div>
        <Sparkline data={stats.monthlyRevenue} width={800} height={160} />
      </div>

      {/* Kanban Board */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Active Jobs Board</span>
        </div>
        <div className="kanban-board">
          {kanbanColumns.map(col => {
            const jobs = stats.jobsByStatus.filter(j => j.status === col.status);
            return (
              <div key={col.status} className="kanban-column">
                <div className="kanban-column-header">
                  <span className="kanban-column-title">{col.status}</span>
                  <span className="kanban-count">{jobs.length}</span>
                </div>
                {jobs.map(job => {
                  const margin = job.quote_amount - job.subbie_cost;
                  const marginPct = job.quote_amount > 0 ? ((margin / job.quote_amount) * 100).toFixed(0) : '0';
                  return (
                    <div key={job.id} className="kanban-card" onClick={() => setSelectedJob(job)}>
                      <div className="kanban-card-title">{job.site_name}</div>
                      <div className="kanban-card-meta">{job.service_name}</div>
                      <div className="kanban-card-meta">{fmt(job.quote_amount)}</div>
                      {job.subbie_name && (
                        <div className="kanban-card-meta kanban-card-subbie">\uD83D\uDC77 {job.subbie_name}</div>
                      )}
                      <div className="kanban-card-meta kanban-card-margin" style={{ color: margin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        Margin: {fmt(margin)} ({marginPct}%)
                      </div>
                      {job.client_po_number && <div className="kanban-card-meta">PO: {job.client_po_number}</div>}
                    </div>
                  );
                })}
                {jobs.length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', textAlign: 'center', padding: '1rem' }}>No jobs</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Jobs Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Jobs</span>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Service</th>
                <th>Status</th>
                <th>Quote</th>
                <th>PO Number</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentJobs.map(job => (
                <tr key={job.id} onClick={() => setSelectedJob(job)} style={{ cursor: 'pointer' }}>
                  <td>{job.site_name}</td>
                  <td>{job.service_name}</td>
                  <td><span className={`status-pill status-${job.status.toLowerCase().replace(/ /g, '-')}`}>{job.status}</span></td>
                  <td>{fmt(job.quote_amount)}</td>
                  <td>{job.client_po_number || '\u2014'}</td>
                  <td>{new Date(job.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{selectedJob.site_name}</div>
                <div className="modal-subtitle">{selectedJob.service_name} \u00B7 {selectedJob.mw_output} MW</div>
              </div>
              <button className="modal-close" onClick={() => setSelectedJob(null)}><IconX size={18} /></button>
            </div>

            <div className="modal-body">
              {/* Status + Financials */}
              <div className="modal-section">
                <div className="modal-section-title">Status & Financials</div>
                <div className="modal-grid">
                  <div className="modal-field">
                    <span className="modal-field-label">Status</span>
                    <span className={`status-pill status-${selectedJob.status.toLowerCase().replace(/ /g, '-')}`}>{selectedJob.status}</span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-field-label">Quote Amount</span>
                    <span className="modal-field-value">{fmt(selectedJob.quote_amount)}</span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-field-label">Subbie Cost</span>
                    <span className="modal-field-value">{fmt(selectedJob.subbie_cost)}</span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-field-label">Margin</span>
                    <span className="modal-field-value" style={{ color: selectedJob.quote_amount - selectedJob.subbie_cost >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {fmt(selectedJob.quote_amount - selectedJob.subbie_cost)}
                    </span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-field-label">Invoice Amount</span>
                    <span className="modal-field-value">{selectedJob.invoice_amount ? fmt(selectedJob.invoice_amount) : '\u2014'}</span>
                  </div>
                </div>
              </div>

              {/* Parties */}
              <div className="modal-section">
                <div className="modal-section-title">Parties & PO Numbers</div>
                <div className="modal-grid">
                  <div className="modal-field">
                    <span className="modal-field-label">Subcontractor</span>
                    <span className="modal-field-value">{selectedJob.subbie_name || '\u2014'}</span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-field-label">Entity</span>
                    <span className="modal-field-value">{selectedJob.entity_name || '\u2014'}</span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-field-label">Client PO</span>
                    <span className="modal-field-value">{selectedJob.client_po_number || '\u2014'}</span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-field-label">Subbie PO</span>
                    <span className="modal-field-value">{selectedJob.subbie_po_number || '\u2014'}</span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-field-label">Invoice Number</span>
                    <span className="modal-field-value">{selectedJob.invoice_number || '\u2014'}</span>
                  </div>
                </div>
              </div>

              {/* Links */}
              <div className="modal-section">
                <div className="modal-section-title">Documents & Links</div>
                <div className="modal-links">
                  {selectedJob.report_link && (
                    <a href={selectedJob.report_link} target="_blank" rel="noopener" className="modal-link-btn">
                      \uD83D\uDCC4 View Report
                    </a>
                  )}
                  {selectedJob.photo_link && (
                    <a href={selectedJob.photo_link} target="_blank" rel="noopener" className="modal-link-btn">
                      \uD83D\uDCF7 View Photos
                    </a>
                  )}
                  {!selectedJob.report_link && !selectedJob.photo_link && (
                    <span style={{ color: 'var(--ink-faint)', fontSize: '0.875rem' }}>No documents attached</span>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedJob.notes && (
                <div className="modal-section">
                  <div className="modal-section-title">Notes</div>
                  <div className="modal-notes">{selectedJob.notes}</div>
                </div>
              )}
            </div>

            {/* Pipeline stepper + progress / revert actions */}
            {(() => {
              const idx = statusIdx(selectedJob.status);
              const prev = idx > 0 ? JOB_STATUSES[idx - 1] : null;
              const next = idx >= 0 && idx < JOB_STATUSES.length - 1 ? JOB_STATUSES[idx + 1] : null;
              return (
                <div className="modal-footer">
                  <div className="status-stepper" role="list" aria-label="Pipeline stage">
                    {JOB_STATUSES.map((s, i) => (
                      <div
                        key={s}
                        role="listitem"
                        className={`step ${i < idx ? 'done' : ''} ${i === idx ? 'current' : ''}`}
                        title={s}
                      >
                        <span className="step-dot" />
                        <span className="step-label">{s}</span>
                      </div>
                    ))}
                  </div>

                  <div className="modal-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => moveJob(-1)}
                      disabled={moving || !prev}
                      title={prev ? `Revert to ${prev}` : 'Already at the first stage'}
                    >
                      ← {prev || 'Start'}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => moveJob(1)}
                      disabled={moving || !next}
                      title={next ? `Progress to ${next}` : 'Already closed'}
                    >
                      {moving ? 'Saving…' : `${next || 'Closed'} →`}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
