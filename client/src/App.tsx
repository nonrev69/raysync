import { useState, useEffect, useCallback } from 'react';
import api from './api';
import type { User, Site, Service, BusinessEntity, Subcontractor, ContactMatrix } from './types';
import Dashboard from './components/Dashboard';
import Schedule from './components/Schedule';
import QuoteBuilder from './components/QuoteBuilder';
import Quoting from './components/Quoting';
import Jobs from './components/Jobs';
import History from './components/History';
import Calendar from './components/Calendar';
import Reconciliation from './components/Reconciliation';
import Settings from './components/Settings';
import Login from './components/Login';
import { useToast } from './components/Toast';

type Tab = 'dashboard' | 'schedule' | 'quotes' | 'quoting' | 'jobs' | 'history' | 'calendar' | 'reconciliation' | 'settings';

function App() {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('raysync_token'));
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('raysync_theme') === 'dark');
  const [sites, setSites] = useState<Site[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [entities, setEntities] = useState<BusinessEntity[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [contactMatrix, setContactMatrix] = useState<ContactMatrix[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('raysync_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Set API token
  useEffect(() => {
    api.setToken(token);
  }, [token]);

  // Check auth on mount
  useEffect(() => {
    if (token) {
      api.me()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('raysync_token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  // Load master data
  const loadMasterData = useCallback(async () => {
    try {
      const [sitesRes, servicesRes, entitiesRes, subsRes, cmRes] = await Promise.all([
        api.getSites(),
        api.getServices(),
        api.getEntities(),
        api.getSubcontractors(),
        api.getContactMatrix(),
      ]);
      setSites(sitesRes);
      setServices(servicesRes);
      setEntities(entitiesRes);
      setSubcontractors(subsRes);
      setContactMatrix(cmRes);
    } catch (err) {
      console.error('Failed to load master data:', err);
    }
  }, []);

  useEffect(() => {
    if (user) loadMasterData();
  }, [user, loadMasterData, refreshKey]);

  const handleLogin = (newToken: string, newUser: User) => {
    localStorage.setItem('raysync_token', newToken);
    setToken(newToken);
    setUser(newUser);
    setError(null);
    showToast('success', `Welcome back, ${newUser.display_name}!`);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    localStorage.removeItem('raysync_token');
    setToken(null);
    setUser(null);
    showToast('info', 'You have been logged out.');
  };

  const refresh = () => setRefreshKey(k => k + 1);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading RaySync...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} error={error} setError={setError} />;
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { id: 'schedule', label: 'Schedule', icon: 'calendar' },
    { id: 'quotes', label: 'Quotes', icon: 'layers' },
    { id: 'quoting', label: 'Quick Quote', icon: 'file-text' },
    { id: 'jobs', label: 'Jobs', icon: 'briefcase' },
    { id: 'history', label: 'History', icon: 'clock' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'reconciliation', label: 'Reconciliation', icon: 'check-circle' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo">R</div>
          <span className="brand-name">RaySync</span>
        </div>
        <nav className="header-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)} title="Toggle theme">
            {darkMode ? 'Light' : 'Dark'}
          </button>
          <div className="user-info">
            <span className="user-name">{user.display_name}</span>
            <span className="user-role">{user.role}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            Logout
          </button>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'dashboard' && <Dashboard sites={sites} services={services} entities={entities} subcontractors={subcontractors} contactMatrix={contactMatrix} refresh={refresh} onNavigate={(tab) => setActiveTab(tab as Tab)} showToast={showToast} />}
        {activeTab === 'schedule' && <Schedule sites={sites} services={services} refresh={refresh} showToast={showToast} />}
        {activeTab === 'quotes' && <QuoteBuilder sites={sites} services={services} entities={entities} refresh={refresh} showToast={showToast} />}
        {activeTab === 'quoting' && <Quoting sites={sites} services={services} entities={entities} subcontractors={subcontractors} contactMatrix={contactMatrix} refresh={refresh} />}
        {activeTab === 'jobs' && <Jobs sites={sites} services={services} entities={entities} subcontractors={subcontractors} contactMatrix={contactMatrix} refresh={refresh} />}
        {activeTab === 'history' && <History sites={sites} services={services} entities={entities} subcontractors={subcontractors} contactMatrix={contactMatrix} refresh={refresh} />}
        {activeTab === 'calendar' && <Calendar sites={sites} services={services} entities={entities} subcontractors={subcontractors} contactMatrix={contactMatrix} refresh={refresh} />}
        {activeTab === 'reconciliation' && <Reconciliation sites={sites} services={services} entities={entities} subcontractors={subcontractors} contactMatrix={contactMatrix} refresh={refresh} />}
        {activeTab === 'settings' && <Settings sites={sites} services={services} entities={entities} subcontractors={subcontractors} contactMatrix={contactMatrix} refresh={refresh} />}
      </main>
    </div>
  );
}

export default App;
