import { useState, useEffect } from 'react';
import api from '../api';
import type { Job, Site, Service, BusinessEntity, Subcontractor, ContactMatrix } from '../types';

interface HistoryProps {
  sites: Site[];
  services: Service[];
  entities: BusinessEntity[];
  subcontractors: Subcontractor[];
  contactMatrix: ContactMatrix[];
  refresh: () => void;
}

export default function History({ refresh }: HistoryProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadHistory();
  }, [refresh]);

  const loadHistory = async () => {
    try {
      const data = await api.getJobs();
      // Show paid and closed jobs by default
      const filtered = filter
        ? data.filter(j => j.status === filter)
        : data.filter(j => j.status === 'Paid' || j.status === 'Closed');
      setJobs(filtered);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="app-loading"><div className="loading-spinner" /><p>Loading history...</p></div>;
  }

  return (
    <div className="tab-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>History</h1>
        <select className="form-select" style={{ width: 'auto' }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">Completed (Paid + Closed)</option>
          <option value="Paid">Paid</option>
          <option value="Closed">Closed</option>
          <option value="Invoiced">Invoiced</option>
          <option value="Works Complete">Works Complete</option>
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
                <th>Invoice</th>
                <th>Invoice Amount</th>
                <th>Client PO</th>
                <th>Invoice Date</th>
                <th>Paid Date</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <td>{job.site_name}</td>
                  <td>{job.service_name}</td>
                  <td><span className={`status-pill status-${job.status.toLowerCase().replace(/ /g, '-')}`}>{job.status}</span></td>
                  <td>£{job.quote_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td>{job.invoice_number || '—'}</td>
                  <td>{job.invoice_amount ? `£${job.invoice_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td>{job.client_po_number || '—'}</td>
                  <td>{job.invoiced_date ? new Date(job.invoiced_date).toLocaleDateString('en-GB') : '—'}</td>
                  <td>{job.paid_date ? new Date(job.paid_date).toLocaleDateString('en-GB') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
