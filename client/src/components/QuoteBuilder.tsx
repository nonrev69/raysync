import { useState, useEffect } from 'react';
import api from '../api';
import { IconPlus, IconTrash, IconX, IconCheckCircle } from './icons';
import type { Quote, QuoteLine, Site, Service, BusinessEntity } from '../types';

interface QuoteBuilderProps {
  sites: Site[];
  services: Service[];
  entities: BusinessEntity[];
  refresh: () => void;
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

interface DraftLine {
  key: string;
  site_id: string;
  service_id: string;
}

const fmt = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

export default function QuoteBuilder({ sites, services, entities, refresh, showToast }: QuoteBuilderProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);

  // Draft state
  const [entityId, setEntityId] = useState('');
  const [invoiceMode, setInvoiceMode] = useState<'split' | 'combined'>('split');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ key: newKey(), site_id: '', service_id: '' }]);
  const [saving, setSaving] = useState(false);

  // Detail / accept
  const [openQuote, setOpenQuote] = useState<Quote | null>(null);
  const [poNumber, setPoNumber] = useState('');

  useEffect(() => { loadQuotes(); }, []);

  const loadQuotes = async () => {
    try {
      setQuotes(await api.getQuotes());
    } catch (err) {
      console.error('Failed to load quotes:', err);
    } finally {
      setLoading(false);
    }
  };

  const siteOf = (id: string) => sites.find(s => s.id === id);
  const serviceOf = (id: string) => services.find(s => s.id === id);

  const lineCalc = (l: DraftLine) => {
    const site = siteOf(l.site_id);
    const svc = serviceOf(l.service_id);
    if (!site || !svc) return { amount: 0, cost: 0, mw: 0 };
    return {
      amount: site.mw_output * svc.client_rate_per_mw,
      cost: site.mw_output * svc.subbie_rate_per_mw,
      mw: site.mw_output,
    };
  };

  const totals = lines.reduce(
    (acc, l) => {
      const c = lineCalc(l);
      return { amount: acc.amount + c.amount, cost: acc.cost + c.cost };
    },
    { amount: 0, cost: 0 }
  );

  const addLine = () => setLines(prev => [...prev, { key: newKey(), site_id: '', service_id: '' }]);
  const removeLine = (key: string) => setLines(prev => (prev.length === 1 ? prev : prev.filter(l => l.key !== key)));
  const setLine = (key: string, patch: Partial<DraftLine>) =>
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const resetDraft = () => {
    setEntityId('');
    setInvoiceMode('split');
    setNotes('');
    setLines([{ key: newKey(), site_id: '', service_id: '' }]);
    setBuilding(false);
  };

  const canSave = entityId && lines.some(l => l.site_id && l.service_id) && lines.every(l => !l.site_id === !l.service_id);

  const handleSave = async () => {
    const validLines = lines.filter(l => l.site_id && l.service_id);
    if (!entityId || validLines.length === 0) {
      showToast?.('error', 'Select a business entity and at least one complete line.');
      return;
    }
    setSaving(true);
    try {
      const q = await api.createQuote({
        business_entity_id: entityId,
        invoice_mode: invoiceMode,
        notes,
        lines: validLines.map(l => ({ site_id: l.site_id, service_id: l.service_id })),
      });
      showToast?.('success', `Quote ${q.quote_ref} created (${q.lines?.length || validLines.length} lines, ${fmt(q.total_amount)}).`);
      resetDraft();
      await loadQuotes();
      refresh();
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to create quote');
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async () => {
    if (!openQuote) return;
    try {
      const res = await api.acceptQuote(openQuote.id, poNumber || undefined);
      showToast?.('success', `Accepted — ${res.jobs_created} job${res.jobs_created === 1 ? '' : 's'} created (${res.invoice_mode} mode).`);
      setOpenQuote(null);
      setPoNumber('');
      await loadQuotes();
      refresh();
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to accept quote');
    }
  };

  const handleDelete = async (q: Quote) => {
    if (!confirm(`Delete quote ${q.quote_ref}?`)) return;
    try {
      await api.deleteQuote(q.id);
      showToast?.('info', `Quote ${q.quote_ref} deleted.`);
      await loadQuotes();
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to delete quote');
    }
  };

  const openDetail = async (q: Quote) => {
    try {
      const full = await api.getQuote(q.id);
      setOpenQuote(full);
      setPoNumber(full.client_po_number || '');
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to load quote');
    }
  };

  const statusClass = (s: string) => `status-${s.toLowerCase()}`;

  return (
    <div className="tab-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Quotes</h1>
        <button className="btn btn-primary" onClick={() => (building ? resetDraft() : setBuilding(true))}>
          {building ? 'Cancel' : <><IconPlus size={16} /> New Quote</>}
        </button>
      </div>

      {/* ---------- Builder ---------- */}
      {building && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title">New Multi-Service Quote</span>
          </div>

          <div className="quote-form-grid">
            <div className="form-group">
              <label className="form-label">Business Entity (client)</label>
              <select className="form-select" value={entityId} onChange={e => setEntityId(e.target.value)}>
                <option value="">Select entity…</option>
                {entities.map(e => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Invoicing</label>
              <div className="mode-toggle">
                <button
                  type="button"
                  className={`mode-btn ${invoiceMode === 'split' ? 'active' : ''}`}
                  onClick={() => setInvoiceMode('split')}
                >
                  Split — one invoice per line
                </button>
                <button
                  type="button"
                  className={`mode-btn ${invoiceMode === 'combined' ? 'active' : ''}`}
                  onClick={() => setInvoiceMode('combined')}
                >
                  Combined — one invoice
                </button>
              </div>
              <p className="form-hint">
                {invoiceMode === 'split'
                  ? 'On acceptance each line becomes its own job and is invoiced separately (all share the LC PO).'
                  : 'On acceptance the whole quote becomes one job, invoiced as a single amount.'}
              </p>
            </div>
          </div>

          <div className="card-header" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
            <span className="card-title">Line items</span>
            <button className="btn btn-secondary btn-sm" onClick={addLine}><IconPlus size={14} /> Add line</button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Site</th>
                  <th style={{ width: '28%' }}>Service</th>
                  <th>MW</th>
                  <th>Client £/MW</th>
                  <th>Line amount</th>
                  <th>Margin</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map(l => {
                  const c = lineCalc(l);
                  const margin = c.amount - c.cost;
                  const svc = serviceOf(l.service_id);
                  return (
                    <tr key={l.key}>
                      <td>
                        <select className="form-select" value={l.site_id} onChange={e => setLine(l.key, { site_id: e.target.value })}>
                          <option value="">Select site…</option>
                          {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.mw_output} MW)</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="form-select" value={l.service_id} onChange={e => setLine(l.key, { service_id: e.target.value })}>
                          <option value="">Select service…</option>
                          {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.short_code})</option>)}
                        </select>
                      </td>
                      <td>{c.mw ? `${c.mw} MW` : '—'}</td>
                      <td>{svc ? `£${svc.client_rate_per_mw}` : '—'}</td>
                      <td><strong>{c.amount ? fmt(c.amount) : '—'}</strong></td>
                      <td style={{ color: margin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {c.amount ? fmt(margin) : '—'}
                      </td>
                      <td>
                        <button className="icon-btn" onClick={() => removeLine(l.key)} disabled={lines.length === 1} title="Remove line">
                          <IconTrash size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="quote-totals">
            <div><span>Subbie cost</span><strong>{fmt(totals.cost)}</strong></div>
            <div><span>Total quote</span><strong style={{ fontSize: '1.25rem' }}>{fmt(totals.amount)}</strong></div>
            <div>
              <span>Margin</span>
              <strong style={{ color: totals.amount - totals.cost >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {fmt(totals.amount - totals.cost)}
                {totals.amount > 0 && ` (${(((totals.amount - totals.cost) / totals.amount) * 100).toFixed(1)}%)`}
              </strong>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={resetDraft}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !canSave}>
              {saving ? 'Creating…' : 'Create Quote'}
            </button>
          </div>
        </div>
      )}

      {/* ---------- List ---------- */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">All Quotes</span>
        </div>
        {loading ? (
          <p style={{ color: 'var(--ink-muted)', padding: '1rem' }}>Loading…</p>
        ) : quotes.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', padding: '1rem' }}>No quotes yet. Create one to get started.</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Entity</th>
                  <th>Lines</th>
                  <th>Invoicing</th>
                  <th>Total</th>
                  <th>Client PO</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(q)}>
                    <td><strong>{q.quote_ref}</strong></td>
                    <td>{q.entity_name}</td>
                    <td>{q.line_count}</td>
                    <td>{q.invoice_mode === 'split' ? 'Split' : 'Combined'}</td>
                    <td>{fmt(q.total_amount)}</td>
                    <td>{q.client_po_number || '—'}</td>
                    <td><span className={`status-pill ${statusClass(q.status)}`}>{q.status}</span></td>
                    <td>
                      <button className="icon-btn" onClick={e => { e.stopPropagation(); handleDelete(q); }} title="Delete">
                        <IconTrash size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Detail / Accept ---------- */}
      {openQuote && (
        <div className="modal-overlay" onClick={() => setOpenQuote(null)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-title">{openQuote.quote_ref}</span>
                <div className="modal-subtitle">{openQuote.entity_name} · {openQuote.invoice_mode === 'split' ? 'Split invoicing' : 'Combined invoicing'}</div>
              </div>
              <button className="modal-close" onClick={() => setOpenQuote(null)}><IconX size={18} /></button>
            </div>

            <div className="modal-section">
              <div className="modal-section-title">Line items</div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Site</th><th>Service</th><th>MW</th><th>Amount</th><th>Subbie</th><th>Job</th></tr>
                  </thead>
                  <tbody>
                    {(openQuote.lines || []).map((l: QuoteLine) => (
                      <tr key={l.id}>
                        <td>{l.site_name}</td>
                        <td>{l.service_name}</td>
                        <td>{l.mw_output}</td>
                        <td>{fmt(l.line_amount)}</td>
                        <td>{fmt(l.subbie_cost)}</td>
                        <td>{l.job_id ? <span className="status-pill status-paid">Linked</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="quote-totals">
                <div><span>Total</span><strong>{fmt(openQuote.total_amount)}</strong></div>
              </div>
            </div>

            {openQuote.status !== 'Accepted' ? (
              <div className="modal-section">
                <div className="modal-section-title">Accept quote</div>
                <p className="form-hint" style={{ marginBottom: '0.75rem' }}>
                  {openQuote.invoice_mode === 'split'
                    ? `This will create ${openQuote.lines?.length || 0} separate jobs, each invoiced individually.`
                    : 'This will create one job covering the whole quote, invoiced as a single amount.'}
                </p>
                <div className="form-group">
                  <label className="form-label">Client PO number (LC)</label>
                  <input className="form-input" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="e.g. LC-1234" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={() => setOpenQuote(null)}>Close</button>
                  <button className="btn btn-primary" onClick={handleAccept}><IconCheckCircle size={16} /> Accept &amp; create jobs</button>
                </div>
              </div>
            ) : (
              <div className="modal-section">
                <div className="modal-section-title">Accepted</div>
                <p className="form-hint">
                  Jobs created and linked. Client PO: <strong>{openQuote.client_po_number || '—'}</strong>
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setOpenQuote(null)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
