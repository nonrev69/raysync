import { useState } from 'react';
import api from '../api';
import type { Site, Service, BusinessEntity, Subcontractor, ContactMatrix } from '../types';

interface QuotingProps {
  sites: Site[];
  services: Service[];
  entities: BusinessEntity[];
  subcontractors: Subcontractor[];
  contactMatrix: ContactMatrix[];
  refresh: () => void;
}

export default function Quoting({ sites, services, refresh }: QuotingProps) {
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const site = sites.find(s => s.id === selectedSite);
  const service = services.find(s => s.id === selectedService);

  const quoteAmount = site && service ? site.mw_output * service.client_rate_per_mw : 0;
  const subbieCost = site && service ? site.mw_output * service.subbie_rate_per_mw : 0;
  const margin = quoteAmount - subbieCost;
  const marginPercent = quoteAmount > 0 ? (margin / quoteAmount * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite || !selectedService) {
      setError('Please select a site and service');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.createJob({ site_id: selectedSite, service_id: selectedService, notes });
      setSuccess('Quote created successfully!');
      setSelectedSite('');
      setSelectedService('');
      setNotes('');
      refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create quote');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-content">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Quoting</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Quote Form */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">New Quote</span>
          </div>

          {error && <div className="login-error">{error}</div>}
          {success && <div style={{ background: '#DCFCE7', color: '#166534', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '1rem' }}>{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Site</label>
              <select className="form-select" value={selectedSite} onChange={e => setSelectedSite(e.target.value)}>
                <option value="">Select a site...</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.mw_output} MW)</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Service</label>
              <select className="form-select" value={selectedService} onChange={e => setSelectedService(e.target.value)}>
                <option value="">Select a service...</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.short_code})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Quote'}
            </button>
          </form>
        </div>

        {/* Quote Preview */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Quote Preview</span>
          </div>

          {site && service ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--canvas-sunken)', borderRadius: 'var(--radius-md)' }}>
                <span>Site</span>
                <strong>{site.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--canvas-sunken)', borderRadius: 'var(--radius-md)' }}>
                <span>MW Output</span>
                <strong>{site.mw_output} MW</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--canvas-sunken)', borderRadius: 'var(--radius-md)' }}>
                <span>Service</span>
                <strong>{service.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--canvas-sunken)', borderRadius: 'var(--radius-md)' }}>
                <span>Client Rate</span>
                <strong>£{service.client_rate_per_mw}/MW</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--canvas-sunken)', borderRadius: 'var(--radius-md)' }}>
                <span>Subbie Rate</span>
                <strong>£{service.subbie_rate_per_mw}/MW</strong>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--action-blue-light)', borderRadius: 'var(--radius-md)' }}>
                <span>Quote Amount</span>
                <strong style={{ fontSize: '1.25rem' }}>£{quoteAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--canvas-sunken)', borderRadius: 'var(--radius-md)' }}>
                <span>Subbie Cost</span>
                <strong>£{subbieCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#DCFCE7', borderRadius: 'var(--radius-md)' }}>
                <span>Margin</span>
                <strong>£{margin.toLocaleString('en-GB', { minimumFractionDigits: 2 })} ({marginPercent.toFixed(1)}%)</strong>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '2rem' }}>
              Select a site and service to see quote preview
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
