import { useState, useEffect } from 'react';
import api from '../api';
import type { Site, Service, BusinessEntity, Subcontractor, ContactMatrix, User } from '../types';

interface SettingsProps {
  sites: Site[];
  services: Service[];
  entities: BusinessEntity[];
  subcontractors: Subcontractor[];
  contactMatrix: ContactMatrix[];
  refresh: () => void;
}

export default function Settings({ sites, services, entities, subcontractors, contactMatrix, refresh }: SettingsProps) {
  const [activeSection, setActiveSection] = useState('sites');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeSection === 'users') {
      loadUsers();
    }
  }, [activeSection]);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const sections = [
    { id: 'sites', label: 'Sites' },
    { id: 'services', label: 'Services' },
    { id: 'entities', label: 'Business Entities' },
    { id: 'subcontractors', label: 'Subcontractors' },
    { id: 'contactMatrix', label: 'Contact Matrix' },
    { id: 'rateOverrides', label: 'Rate Overrides' },
    { id: 'users', label: 'Users' },
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      switch (activeSection) {
        case 'sites':
          if (editingItem) {
            await api.updateSite(editingItem.id, formData);
          } else {
            await api.createSite(formData);
          }
          break;
        case 'services':
          if (editingItem) {
            await api.updateService(editingItem.id, formData);
          } else {
            await api.createService(formData);
          }
          break;
        case 'entities':
          if (editingItem) {
            await api.updateEntity(editingItem.id, formData);
          } else {
            await api.createEntity(formData);
          }
          break;
        case 'subcontractors':
          if (editingItem) {
            await api.updateSubcontractor(editingItem.id, formData);
          } else {
            await api.createSubcontractor(formData);
          }
          break;
        case 'contactMatrix':
          await api.updateContactMatrix(editingItem.id, formData);
          break;
        case 'users':
          if (editingItem) {
            await api.updateUser(editingItem.id, formData);
          } else {
            await api.createUser(formData);
          }
          break;
      }
      setShowForm(false);
      setEditingItem(null);
      setFormData({});
      refresh();
      if (activeSection === 'users') loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      switch (activeSection) {
        case 'sites': await api.deleteSite(id); break;
        case 'services': await api.deleteService(id); break;
        case 'entities': await api.deleteEntity(id); break;
        case 'subcontractors': await api.deleteSubcontractor(id); break;
        case 'users': await api.deleteUser(id); break;
      }
      refresh();
      if (activeSection === 'users') loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const startEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowForm(true);
  };

  const startNew = () => {
    setEditingItem(null);
    setFormData({});
    setShowForm(true);
  };

  return (
    <div className="tab-content">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Settings</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.5rem' }}>
        {/* Sidebar */}
        <div className="card" style={{ padding: '0.75rem' }}>
          {sections.map(section => (
            <button
              key={section.id}
              className={`nav-btn ${activeSection === section.id ? 'active' : ''}`}
              style={{ width: '100%', textAlign: 'left', marginBottom: '0.25rem' }}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{sections.find(s => s.id === activeSection)?.label}</span>
            {activeSection !== 'contactMatrix' && activeSection !== 'rateOverrides' && (
              <button className="btn btn-primary btn-sm" onClick={startNew}>Add New</button>
            )}
          </div>

          {/* Sites */}
          {activeSection === 'sites' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>MW Output</th><th>Type</th><th>Entity</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {sites.map(site => (
                    <tr key={site.id}>
                      <td>{site.name}</td>
                      <td>{site.mw_output} MW</td>
                      <td>{site.site_type}</td>
                      <td>{site.entity_name}</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => startEdit(site)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(site.id)} style={{ marginLeft: '0.5rem' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Services */}
          {activeSection === 'services' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Code</th><th>Category</th><th>Client Rate/MW</th><th>Subbie Rate/MW</th><th>Subbie</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {services.map(svc => (
                    <tr key={svc.id}>
                      <td>{svc.name}</td>
                      <td>{svc.short_code}</td>
                      <td>{svc.category}</td>
                      <td>£{svc.client_rate_per_mw}</td>
                      <td>£{svc.subbie_rate_per_mw}</td>
                      <td>{svc.subbie_name}</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => startEdit(svc)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(svc.id)} style={{ marginLeft: '0.5rem' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Entities */}
          {activeSection === 'entities' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Code</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {entities.map(entity => (
                    <tr key={entity.id}>
                      <td>{entity.name}</td>
                      <td>{entity.code}</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => startEdit(entity)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(entity.id)} style={{ marginLeft: '0.5rem' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Subcontractors */}
          {activeSection === 'subcontractors' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Category</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {subcontractors.map(sub => (
                    <tr key={sub.id}>
                      <td>{sub.name}</td>
                      <td>{sub.contact_email}</td>
                      <td>{sub.service_category}</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => startEdit(sub)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(sub.id)} style={{ marginLeft: '0.5rem' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Contact Matrix */}
          {activeSection === 'contactMatrix' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Entity</th><th>Category</th><th>To Emails</th><th>CC Emails</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {contactMatrix.map(cm => (
                    <tr key={cm.id}>
                      <td>{cm.entity_name}</td>
                      <td>{cm.job_category}</td>
                      <td>{cm.to_emails}</td>
                      <td>{cm.cc_emails}</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => startEdit(cm)}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rate Overrides */}
          {activeSection === 'rateOverrides' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Site</th><th>Service</th><th>Client Rate</th><th>Subbie Rate</th><th>Effective Date</th></tr>
                </thead>
                <tbody>
                  {sites.map(site => (
                    services.map(svc => (
                      <tr key={`${site.id}-${svc.id}`}>
                        <td>{site.name}</td>
                        <td>{svc.name}</td>
                        <td>£{svc.client_rate_per_mw}</td>
                        <td>£{svc.subbie_rate_per_mw}</td>
                        <td>—</td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Users */}
          {activeSection === 'users' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Username</th><th>Display Name</th><th>Role</th><th>Email</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{user.display_name}</td>
                      <td><span className="status-pill status-authorised">{user.role}</span></td>
                      <td>{user.email || '—'}</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => startEdit(user)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(user.id)} style={{ marginLeft: '0.5rem' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editingItem ? 'Edit' : 'Add'} {sections.find(s => s.id === activeSection)?.label}</span>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {activeSection === 'sites' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">MW Output</label>
                    <input type="number" className="form-input" value={formData.mw_output || ''} onChange={e => setFormData({ ...formData, mw_output: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Site Type</label>
                    <select className="form-select" value={formData.site_type || 'solar'} onChange={e => setFormData({ ...formData, site_type: e.target.value })}>
                      <option value="solar">Solar</option>
                      <option value="wind">Wind</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Business Entity</label>
                    <select className="form-select" value={formData.business_entity_id || ''} onChange={e => setFormData({ ...formData, business_entity_id: e.target.value })}>
                      <option value="">Select entity...</option>
                      {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {activeSection === 'services' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Short Code</label>
                    <input className="form-input" value={formData.short_code || ''} onChange={e => setFormData({ ...formData, short_code: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input className="form-input" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Client Rate per MW</label>
                    <input type="number" className="form-input" value={formData.client_rate_per_mw || ''} onChange={e => setFormData({ ...formData, client_rate_per_mw: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subbie Rate per MW</label>
                    <input type="number" className="form-input" value={formData.subbie_rate_per_mw || ''} onChange={e => setFormData({ ...formData, subbie_rate_per_mw: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assigned Subcontractor</label>
                    <select className="form-select" value={formData.assigned_subbie_id || ''} onChange={e => setFormData({ ...formData, assigned_subbie_id: e.target.value })}>
                      <option value="">Select subcontractor...</option>
                      {subcontractors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {activeSection === 'entities' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Code</label>
                    <input className="form-input" value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value })} />
                  </div>
                </>
              )}

              {activeSection === 'subcontractors' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Email</label>
                    <input type="email" className="form-input" value={formData.contact_email || ''} onChange={e => setFormData({ ...formData, contact_email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Service Category</label>
                    <input className="form-input" value={formData.service_category || ''} onChange={e => setFormData({ ...formData, service_category: e.target.value })} />
                  </div>
                </>
              )}

              {activeSection === 'contactMatrix' && (
                <>
                  <div className="form-group">
                    <label className="form-label">To Emails (comma-separated)</label>
                    <input className="form-input" value={formData.to_emails || ''} onChange={e => setFormData({ ...formData, to_emails: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CC Emails (comma-separated)</label>
                    <input className="form-input" value={formData.cc_emails || ''} onChange={e => setFormData({ ...formData, cc_emails: e.target.value })} />
                  </div>
                </>
              )}

              {activeSection === 'users' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input className="form-input" value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Display Name</label>
                    <input className="form-input" value={formData.display_name || ''} onChange={e => setFormData({ ...formData, display_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select className="form-select" value={formData.role || 'editor'} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input type="password" className="form-input" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder={editingItem ? 'Leave blank to keep current' : ''} />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
