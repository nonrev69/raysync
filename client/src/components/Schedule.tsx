import { useState, useEffect } from 'react';
import api from '../api';
import { IconPlus, IconTrash, IconX, IconCheckCircle } from './icons';
import type { RecurringPlan, DueWork, Site, Service, Frequency } from '../types';

interface ScheduleProps {
  sites: Site[];
  services: Service[];
  refresh: () => void;
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FREQUENCIES: { value: Frequency; label: string; help: string }[] = [
  { value: 'monthly', label: 'Monthly', help: 'every month in season' },
  { value: 'quarterly', label: 'Quarterly', help: 'every 3 months' },
  { value: 'biannual', label: 'Twice a year', help: 'every 6 months' },
  { value: 'annual', label: 'Annual', help: 'once a year' },
  { value: 'one-off', label: 'One-off', help: 'not recurring' },
];

const fmt = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Format a season window, tolerating wrap-around (e.g. Nov → Feb). */
function seasonLabel(start: number, end: number): string {
  if (start === 1 && end === 12) return 'Year-round';
  return `${MONTHS[start - 1]}–${MONTHS[end - 1]}`;
}

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export default function Schedule({ sites, services, refresh, showToast }: ScheduleProps) {
  const [plans, setPlans] = useState<RecurringPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Plan editor
  const [editing, setEditing] = useState<RecurringPlan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});

  // Seasonal generation
  const [period, setPeriod] = useState(thisMonth());
  const [due, setDue] = useState<DueWork | null>(null);
  const [dueLoading, setDueLoading] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState<'split' | 'combined'>('split');
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    try {
      setPlans(await api.getRecurringPlans());
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const previewDue = async (p: string) => {
    setDueLoading(true);
    try {
      setDue(await api.getDueWork(p));
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to preview schedule');
      setDue(null);
    } finally {
      setDueLoading(false);
    }
  };

  useEffect(() => { previewDue(period); }, [period]);

  const startNew = () => {
    setEditing(null);
    setForm({ frequency: 'monthly', season_start_month: 4, season_end_month: 9, notes: '' });
    setShowForm(true);
  };

  const startEdit = (p: RecurringPlan) => {
    setEditing(p);
    setForm({
      frequency: p.frequency,
      season_start_month: p.season_start_month,
      season_end_month: p.season_end_month,
      is_active: p.is_active,
      notes: p.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await api.updateRecurringPlan(editing.id, form);
        showToast?.('success', 'Schedule updated.');
      } else {
        if (!form.site_id || !form.service_id) {
          showToast?.('error', 'Choose a site and a service.');
          return;
        }
        await api.createRecurringPlan(form);
        showToast?.('success', 'Schedule added.');
      }
      setShowForm(false);
      setEditing(null);
      await loadPlans();
      await previewDue(period);
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to save');
    }
  };

  const handleDelete = async (p: RecurringPlan) => {
    if (!confirm(`Remove the ${p.service_name} schedule for ${p.site_name}?`)) return;
    try {
      await api.deleteRecurringPlan(p.id);
      showToast?.('info', 'Schedule removed.');
      await loadPlans();
      await previewDue(period);
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to remove');
    }
  };

  const handleGenerate = async () => {
    if (!due || due.total_due === 0) return;
    setGenerating(true);
    try {
      const res = await api.generatePlan(period, invoiceMode);
      showToast?.(
        'success',
        res.quotes_created > 0
          ? `Created ${res.quotes_created} draft quote${res.quotes_created === 1 ? '' : 's'} covering ${res.lines_scheduled} scheduled job${res.lines_scheduled === 1 ? '' : 's'}.`
          : (res.message || 'Nothing due for this period.')
      );
      await loadPlans();
      await previewDue(period);
      refresh();
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const activeCount = plans.filter(p => p.is_active).length;

  return (
    <div className="tab-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Maintenance Schedule</h1>
          <p className="form-hint" style={{ marginTop: '0.25rem' }}>
            The predictable work — recurring plans that generate the seasonal quote.
          </p>
        </div>
        <button className="btn btn-primary" onClick={startNew}><IconPlus size={16} /> Add schedule</button>
      </div>

      {/* ---------- Seasonal generator ---------- */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Seasonal plan</span>
          <div className="period-picker">
            <button className="btn btn-secondary btn-sm" onClick={() => setPeriod(shiftMonth(period, -1))}>&larr;</button>
            <input
              type="month"
              className="form-input"
              style={{ width: 'auto' }}
              value={period}
              onChange={e => e.target.value && setPeriod(e.target.value)}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => setPeriod(shiftMonth(period, 1))}>&rarr;</button>
          </div>
        </div>

        {dueLoading ? (
          <p className="form-hint">Checking the schedule…</p>
        ) : !due || due.total_due === 0 ? (
          <div className="empty-state">
            <IconCheckCircle size={22} />
            <p>Nothing scheduled for <strong>{periodLabel(period)}</strong>.</p>
            <p className="form-hint">
              Either this month is outside the season windows, or the work has already been generated.
            </p>
          </div>
        ) : (
          <>
            <div className="due-summary">
              <div><span>Due</span><strong>{due.total_due} job{due.total_due === 1 ? '' : 's'}</strong></div>
              <div><span>Across</span><strong>{due.groups.length} client {due.groups.length === 1 ? 'entity' : 'entities'}</strong></div>
              <div><span>Value</span><strong>{fmt(due.total_value)}</strong></div>
            </div>

            {due.groups.map(g => (
              <div key={g.entity_id} className="due-group">
                <div className="due-group-head">
                  <span className="due-group-name">{g.entity_name} <span className="form-hint">({g.entity_code})</span></span>
                  <span className="due-group-total">{fmt(g.total)}</span>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr><th>Site</th><th>Service</th><th>MW</th><th>Amount</th><th>Why due</th></tr>
                    </thead>
                    <tbody>
                      {g.lines.map(l => (
                        <tr key={l.id}>
                          <td>{l.site_name}</td>
                          <td>{l.service_name}</td>
                          <td>{l.mw_output}</td>
                          <td>{fmt(l.lineAmount)}</td>
                          <td className="form-hint">{l.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <div className="due-actions">
              <div className="mode-toggle" style={{ maxWidth: 420 }}>
                <button
                  type="button"
                  className={`mode-btn ${invoiceMode === 'split' ? 'active' : ''}`}
                  onClick={() => setInvoiceMode('split')}
                >
                  Split invoices
                </button>
                <button
                  type="button"
                  className={`mode-btn ${invoiceMode === 'combined' ? 'active' : ''}`}
                  onClick={() => setInvoiceMode('combined')}
                >
                  Combined invoices
                </button>
              </div>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating…' : `Generate ${due.groups.length} draft quote${due.groups.length === 1 ? '' : 's'}`}
              </button>
            </div>
            <p className="form-hint" style={{ marginTop: '0.5rem' }}>
              Creates one draft quote per client entity. Review them in the <strong>Quotes</strong> tab
              before sending — nothing is issued to the client from here.
            </p>
          </>
        )}
      </div>

      {/* ---------- Plan list ---------- */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recurring plans ({activeCount} active of {plans.length})</span>
        </div>
        {loading ? (
          <p className="form-hint">Loading…</p>
        ) : plans.length === 0 ? (
          <p className="form-hint">No schedules yet. Add one to start planning ahead.</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Site</th><th>Service</th><th>Frequency</th><th>Season</th>
                  <th>Subbie</th><th>Last generated</th><th>Active</th><th />
                </tr>
              </thead>
              <tbody>
                {plans.map(p => (
                  <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                    <td>{p.site_name}</td>
                    <td>{p.service_name} <span className="form-hint">({p.short_code})</span></td>
                    <td>{FREQUENCIES.find(f => f.value === p.frequency)?.label || p.frequency}</td>
                    <td>{seasonLabel(p.season_start_month, p.season_end_month)}</td>
                    <td>{p.subbie_name}</td>
                    <td className="form-hint">{p.last_generated_date || 'never'}</td>
                    <td>{p.is_active ? '✓' : '—'}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => startEdit(p)}>Edit</button>
                      <button className="icon-btn" style={{ marginLeft: '0.375rem' }} onClick={() => handleDelete(p)} title="Remove">
                        <IconTrash size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Plan form ---------- */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Edit schedule' : 'Add schedule'}</span>
              <button className="modal-close" onClick={() => setShowForm(false)}><IconX size={18} /></button>
            </div>

            <div className="modal-body">
              {!editing && (
                <>
                  <div className="form-group">
                    <label className="form-label">Site</label>
                    <select className="form-select" value={form.site_id || ''} onChange={e => setForm({ ...form, site_id: e.target.value })}>
                      <option value="">Select site…</option>
                      {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.mw_output} MW)</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Service</label>
                    <select className="form-select" value={form.service_id || ''} onChange={e => setForm({ ...form, service_id: e.target.value })}>
                      <option value="">Select service…</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.short_code})</option>)}
                    </select>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">How often?</label>
                <select className="form-select" value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}>
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label} — {f.help}</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Season starts</label>
                  <select className="form-select" value={form.season_start_month} onChange={e => setForm({ ...form, season_start_month: parseInt(e.target.value, 10) })}>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Season ends</label>
                  <select className="form-select" value={form.season_end_month} onChange={e => setForm({ ...form, season_end_month: parseInt(e.target.value, 10) })}>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
              <p className="form-hint">
                Work is only scheduled inside this window. Jan–Dec = year-round.
                A window that ends before it starts wraps across the new year.
              </p>

              {editing && (
                <div className="form-group">
                  <label className="form-label">
                    <input
                      type="checkbox"
                      checked={!!form.is_active}
                      onChange={e => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                      style={{ marginRight: '0.5rem', accentColor: 'var(--brand-green)' }}
                    />
                    Active (include in seasonal generation)
                  </label>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional…" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
