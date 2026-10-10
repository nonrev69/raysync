import { useState, useEffect } from 'react';
import api from '../api';
import type { DashboardStats, Job, Site, Service, BusinessEntity, Subcontractor, ContactMatrix } from '../types';

interface DashboardProps {
  sites: Site[];
  services: Service[];
  entities: BusinessEntity[];
  subcontractors: Subcontractor[];
  contactMatrix: ContactMatrix[];
  refresh: () => void;
}

export default function Dashboard({ refresh }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

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

  const statCards = [
    { label: 'Total Jobs', value: stats.totalJobs, subtitle: `${stats.activeJobs} active` },
    { label: 'Outstanding Balance', value: `£${stats.outstandingBalance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, subtitle: `${stats.overdueInvoices} overdue invoices` },
    { label: 'Total Revenue', value: `£${stats.totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, subtitle: `Profit: £${stats.profit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` },
    { label: 'VAT Liability', value: `£${stats.vatLiability.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, subtitle: 'Estimated' },
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

  return (
    <div className="tab-content">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Dashboard</h1>

      {/* Stat Cards */}
      <div className="stat-grid">
        {statCards.map(card => (
          <div key={card.label} className="stat-card">
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-subtitle">{card.subtitle}</div>
          </div>
        ))}
      </div>

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
                {jobs.map(job => (
                  <div key={job.id} className="kanban-card" onClick={() => setSelectedJob(job)}>
                    <div className="kanban-card-title">{job.site_name}</div>
                    <div className="kanban-card-meta">{job.service_name}</div>
                    <div className="kanban-card-meta">£{job.quote_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                    {job.client_po_number && <div className="kanban-card-meta">PO: {job.client_po_number}</div>}
                  </div>
                ))}
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
                  <td>£{job.quote_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td>{job.client_po_number || '—'}</td>
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
              <span className="modal-title">Job Details</span>
              <button className="modal-close" onClick={() => setSelectedJob(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div><strong>Site:</strong> {selectedJob.site_name} ({selectedJob.mw_output} MW)</div>
              <div><strong>Service:</strong> {selectedJob.service_name}</div>
              <div><strong>Status:</strong> <span className={`status-pill status-${selectedJob.status.toLowerCase().replace(/ /g, '-')}`}>{selectedJob.status}</span></div>
              <div><strong>Quote Amount:</strong> £{selectedJob.quote_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
              <div><strong>Subbie Cost:</strong> £{selectedJob.subbie_cost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
              <div><strong>Client PO:</strong> {selectedJob.client_po_number || '—'}</div>
              <div><strong>Subbie PO:</strong> {selectedJob.subbie_po_number || '—'}</div>
              <div><strong>Invoice Number:</strong> {selectedJob.invoice_number || '—'}</div>
              <div><strong>Invoice Amount:</strong> {selectedJob.invoice_amount ? `£${selectedJob.invoice_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}</div>
              <div><strong>Report Link:</strong> {selectedJob.report_link ? <a href={selectedJob.report_link} target="_blank" rel="noopener">View</a> : '—'}</div>
              <div><strong>Photo Link:</strong> {selectedJob.photo_link ? <a href={selectedJob.photo_link} target="_blank" rel="noopener">View</a> : '—'}</div>
              {selectedJob.notes && <div><strong>Notes:</strong> {selectedJob.notes}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
