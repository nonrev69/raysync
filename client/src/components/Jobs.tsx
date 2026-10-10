import { useState, useEffect } from 'react';
import api from '../api';
import type { Job, Site, Service, BusinessEntity, Subcontractor, ContactMatrix } from '../types';

interface JobsProps {
  sites: Site[];
  services: Service[];
  entities: BusinessEntity[];
  subcontractors: Subcontractor[];
  contactMatrix: ContactMatrix[];
  refresh: () => void;
}

export default function Jobs({ refresh }: JobsProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    loadJobs();
  }, [refresh]);

  const loadJobs = async () => {
    try {
      const params: any = {};
      if (filter) params.status = filter;
      const data = await api.getJobs(params);
      setJobs(data);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    try {
      await api.updateJob(jobId, { status: newStatus });
      refresh();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleEdit = (job: Job) => {
    setSelectedJob(job);
    setEditForm({
      client_po_number: job.client_po_number || '',
      subbie_po_number: job.subbie_po_number || '',
      invoice_number: job.invoice_number || '',
      invoice_amount: job.invoice_amount || '',
      subbie_invoice_number: job.subbie_invoice_number || '',
      subbie_invoiced_amount: job.subbie_invoiced_amount || '',
      report_link: job.report_link || '',
      photo_link: job.photo_link || '',
      notes: job.notes || '',
    });
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedJob) return;
    try {
      await api.updateJob(selectedJob.id, editForm);
      setShowEdit(false);
      setSelectedJob(null);
      refresh();
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };

  const statuses = ['Quoted', 'PO Received', 'Subbie Notified', 'Works Complete', 'Invoiced', 'Paid', 'Closed'];

  if (loading) {
    return <div className="app-loading"><div className="loading-spinner" /><p>Loading jobs...</p></div>;
  }

  return (
    <div className="tab-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Jobs</h1>
        <select className="form-select" style={{ width: 'auto' }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Service</th>
                <th>Status</th>
                <th>Quote</th>
                <th>Client PO</th>
                <th>Invoice</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <td>{job.site_name}</td>
                  <td>{job.service_name}</td>
                  <td>
                    <span className={`status-pill status-${job.status.toLowerCase().replace(/ /g, '-')}`}>
                      {job.status}
                    </span>
                  </td>
                  <td>£{job.quote_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td>{job.client_po_number || '—'}</td>
                  <td>{job.invoice_number || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(job)}>Edit</button>
                      {job.status !== 'Closed' && job.status !== 'Paid' && (
                        <select
                          className="form-select"
                          style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          value={job.status}
                          onChange={e => handleStatusChange(job.id, e.target.value)}
                        >
                          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Edit Job — {selectedJob.site_name}</span>
              <button className="modal-close" onClick={() => setShowEdit(false)}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Client PO Number</label>
                <input className="form-input" value={editForm.client_po_number} onChange={e => setEditForm({ ...editForm, client_po_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Subbie PO Number</label>
                <input className="form-input" value={editForm.subbie_po_number} onChange={e => setEditForm({ ...editForm, subbie_po_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Number</label>
                <input className="form-input" value={editForm.invoice_number} onChange={e => setEditForm({ ...editForm, invoice_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Amount</label>
                <input type="number" className="form-input" value={editForm.invoice_amount} onChange={e => setEditForm({ ...editForm, invoice_amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Subbie Invoice Number</label>
                <input className="form-input" value={editForm.subbie_invoice_number} onChange={e => setEditForm({ ...editForm, subbie_invoice_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Subbie Invoiced Amount</label>
                <input type="number" className="form-input" value={editForm.subbie_invoiced_amount} onChange={e => setEditForm({ ...editForm, subbie_invoiced_amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Report Link</label>
                <input className="form-input" value={editForm.report_link} onChange={e => setEditForm({ ...editForm, report_link: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Photo Link</label>
                <input className="form-input" value={editForm.photo_link} onChange={e => setEditForm({ ...editForm, photo_link: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={3} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
