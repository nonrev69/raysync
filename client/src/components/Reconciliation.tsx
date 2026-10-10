import { useState, useEffect } from 'react';
import api from '../api';
import type { Job, Site, Service, BusinessEntity, Subcontractor, ContactMatrix } from '../types';

interface ReconciliationProps {
  sites: Site[];
  services: Service[];
  entities: BusinessEntity[];
  subcontractors: Subcontractor[];
  contactMatrix: ContactMatrix[];
  refresh: () => void;
}

export default function Reconciliation({ refresh }: ReconciliationProps) {
  const [sentInvoices, setSentInvoices] = useState<Job[]>([]);
  const [recentlyPaid, setRecentlyPaid] = useState<Job[]>([]);
  const [subbieInvoices, setSubbieInvoices] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [matchResult, setMatchResult] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [refresh]);

  const loadData = async () => {
    try {
      const [reconData, subbieData] = await Promise.all([
        api.getReconciliation(),
        api.getSubbieInvoices(),
      ]);
      setSentInvoices(reconData.sentInvoices);
      setRecentlyPaid(reconData.recentlyPaid);
      setSubbieInvoices(subbieData);
    } catch (err) {
      console.error('Failed to load reconciliation data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setMatchResult('Please enter a valid payment amount');
      return;
    }

    const selected = sentInvoices.filter(j => selectedInvoices.includes(j.id));
    const total = selected.reduce((sum, j) => sum + (j.invoice_amount || 0), 0);

    if (Math.abs(total - amount) < 0.01) {
      setMatchResult(`Match found! ${selected.length} invoice(s) total £${total.toFixed(2)} matches payment of £${amount.toFixed(2)}`);
    } else {
      setMatchResult(`No match. Selected invoices total £${total.toFixed(2)} vs payment £${amount.toFixed(2)} (difference: £${(total - amount).toFixed(2)})`);
    }
  };

  const handleMarkPaid = async () => {
    const selected = sentInvoices.filter(j => selectedInvoices.includes(j.id));
    for (const job of selected) {
      await api.updateJob(job.id, { status: 'Paid' });
    }
    setSelectedInvoices([]);
    setPaymentAmount('');
    setMatchResult(null);
    refresh();
  };

  if (loading) {
    return <div className="app-loading"><div className="loading-spinner" /><p>Loading reconciliation...</p></div>;
  }

  return (
    <div className="tab-content">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Reconciliation</h1>

      {/* Payment Matcher */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Payment Matcher</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label className="form-label">Payment Amount Received</label>
            <input
              type="number"
              className="form-input"
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              placeholder="Enter amount..."
            />
          </div>
          <button className="btn btn-primary" onClick={handleMatch}>Find Match</button>
          {selectedInvoices.length > 0 && (
            <button className="btn btn-secondary" onClick={handleMarkPaid}>Mark Selected as Paid</button>
          )}
        </div>
        {matchResult && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: matchResult.startsWith('Match') ? '#DCFCE7' : '#FEF3C7' }}>
            {matchResult}
          </div>
        )}
      </div>

      {/* Sent Invoices */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Sent Invoices (Unpaid)</span>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Site</th>
                <th>Service</th>
                <th>Invoice #</th>
                <th>Amount</th>
                <th>Invoice Date</th>
                <th>Days Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {sentInvoices.map(job => {
                const daysOutstanding = job.invoiced_date
                  ? Math.floor((Date.now() - new Date(job.invoiced_date).getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                return (
                  <tr key={job.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedInvoices.includes(job.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedInvoices([...selectedInvoices, job.id]);
                          } else {
                            setSelectedInvoices(selectedInvoices.filter(id => id !== job.id));
                          }
                        }}
                      />
                    </td>
                    <td>{job.site_name}</td>
                    <td>{job.service_name}</td>
                    <td>{job.invoice_number}</td>
                    <td>£{(job.invoice_amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                    <td>{job.invoiced_date ? new Date(job.invoiced_date).toLocaleDateString('en-GB') : '—'}</td>
                    <td style={{ color: daysOutstanding > 60 ? 'var(--danger)' : daysOutstanding > 30 ? 'var(--warning)' : 'inherit' }}>
                      {daysOutstanding} days
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recently Paid */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Recently Paid</span>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Service</th>
                <th>Invoice #</th>
                <th>Amount</th>
                <th>Paid Date</th>
              </tr>
            </thead>
            <tbody>
              {recentlyPaid.map(job => (
                <tr key={job.id}>
                  <td>{job.site_name}</td>
                  <td>{job.service_name}</td>
                  <td>{job.invoice_number}</td>
                  <td>£{(job.invoice_amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td>{job.paid_date ? new Date(job.paid_date).toLocaleDateString('en-GB') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subbie Invoice Tracker */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Subcontractor Invoice Tracker</span>
        </div>

        {subbieInvoices.pendingSubbieInvoices?.length > 0 && (
          <>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--warning)' }}>Pending Subbie Invoices</h3>
            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Service</th>
                    <th>Subbie</th>
                    <th>Agreed Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subbieInvoices.pendingSubbieInvoices.map((job: Job) => (
                    <tr key={job.id}>
                      <td>{job.site_name}</td>
                      <td>{job.service_name}</td>
                      <td>{job.subbie_name}</td>
                      <td>£{job.subbie_cost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                      <td><span className="status-pill status-pending">Pending</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {subbieInvoices.subbieInvoices?.length > 0 && (
          <>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Received Subbie Invoices</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Service</th>
                    <th>Subbie</th>
                    <th>Agreed Cost</th>
                    <th>Invoiced Amount</th>
                    <th>Difference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subbieInvoices.subbieInvoices.map((job: Job) => {
                    const diff = (job.subbie_invoiced_amount || 0) - job.subbie_cost;
                    return (
                      <tr key={job.id}>
                        <td>{job.site_name}</td>
                        <td>{job.service_name}</td>
                        <td>{job.subbie_name}</td>
                        <td>£{job.subbie_cost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                        <td>£{(job.subbie_invoiced_amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                        <td style={{ color: diff > 0 ? 'var(--danger)' : diff < 0 ? 'var(--success)' : 'inherit' }}>
                          {diff > 0 ? '+' : ''}£{diff.toFixed(2)}
                        </td>
                        <td><span className={`status-pill status-${job.subbie_invoice_status}`}>{job.subbie_invoice_status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
