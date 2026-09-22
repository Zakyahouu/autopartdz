import { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── helpers ──────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('autopartdz_token');
}

function setToken(t) {
  if (t) localStorage.setItem('autopartdz_token', t);
  else localStorage.removeItem('autopartdz_token');
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ── sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ health }) {
  if (!health) {
    return (
      <div className="status-badge loading" role="status" aria-live="polite">
        <span className="status-dot" />
        Checking API…
      </div>
    );
  }
  const ok = health.status === 'ok';
  return (
    <div className={`status-badge ${ok ? 'ok' : 'error'}`} role="status" aria-live="polite">
      <span className="status-dot" />
      {ok ? 'API: OK' : 'API: unreachable'}
    </div>
  );
}

function HealthCard({ health, loading }) {
  return (
    <div className="card">
      <h2 className="card-title">
        <span className="icon">🩺</span>
        System Health
      </h2>
      <div className="health-details">
        <div className="health-row">
          <span className="label">API Server</span>
          <span className={`value ${loading ? 'loading' : health?.status === 'ok' ? 'ok' : 'error'}`}>
            {loading ? '…' : health?.status === 'ok' ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="health-row">
          <span className="label">MongoDB</span>
          <span className={`value ${loading ? 'loading' : health?.mongo === 'connected' ? 'ok' : 'error'}`}>
            {loading ? '…' : health?.mongo === 'connected' ? 'Connected' : (health?.mongo ?? 'Unknown')}
          </span>
        </div>
        {health?.timestamp && (
          <div className="health-row">
            <span className="label">Last checked</span>
            <span className="value" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              {new Date(health.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )}
        {health?.mongoError && (
          <div className="alert alert-error" style={{ marginTop: 8 }}>
            {health.mongoError}
          </div>
        )}
      </div>
    </div>
  );
}

function LoginCard({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { ok, data } = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!ok) {
        setError(data.error || 'Login failed.');
      } else {
        setToken(data.token);
        onLogin(data.user);
      }
    } catch {
      setError('Could not reach the API. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">
        <span className="icon">🔑</span>
        Admin Login
      </h2>
      <form className="form" onSubmit={handleSubmit} id="login-form" noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="form-input"
            type="email"
            autoComplete="email"
            placeholder="admin@autopartdz.dz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="form-input"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button
          id="login-submit"
          type="submit"
          className="btn btn-primary"
          disabled={loading || !email || !password}
        >
          {loading ? <span className="spinner" aria-hidden="true" /> : null}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

function ProfileCard({ user, onLogout }) {
  return (
    <div className="card">
      <h2 className="card-title">
        <span className="icon">👤</span>
        Logged In
      </h2>
      <div className="profile">
        <div className="profile-header">
          <span className="profile-name">{user.name}</span>
          <span className={`role-badge ${user.role}`}>
            {user.role === 'china_associate' ? 'China Associate' : user.role}
          </span>
        </div>
        <div className="profile-row">
          <span className="label">Email</span>
          <span className="value">{user.email}</span>
        </div>
        <div className="profile-row">
          <span className="label">Status</span>
          <span className="value" style={{ color: 'var(--success)' }}>Active</span>
        </div>
        <button
          id="logout-btn"
          className="btn btn-ghost"
          style={{ marginTop: 8, alignSelf: 'flex-start' }}
          onClick={onLogout}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────

export default function App() {
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Fetch health on mount
  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const { data } = await apiFetch('/health');
      setHealth(data);
    } catch {
      setHealth({ status: 'error', mongo: 'unreachable' });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Re-check health every 30 s
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Restore session from stored token
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiFetch('/auth/me').then(({ ok, data }) => {
      if (ok) setUser(data);
      else setToken(null); // token expired or invalid
    });
  }, []);

  const handleLogin = (u) => setUser(u);
  const handleLogout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          auto<span>part</span>dz
        </div>
        <div className="app-subtitle">Document Management Platform</div>
      </header>

      <StatusBadge health={health} />

      <main className="card-grid">
        <HealthCard health={health} loading={healthLoading} />
        {user ? (
          <ProfileCard user={user} onLogout={handleLogout} />
        ) : (
          <LoginCard onLogin={handleLogin} />
        )}
      </main>
    </div>
  );
}
