import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // If already logged in as admin, redirect immediately
  useEffect(() => {
    if (user?.role === 'admin') navigate('/admin/document-types', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const result = await login(email.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // AuthContext will update user → redirect fires via useEffect
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--page)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: 'min(420px, 100%)',
        background: 'var(--card)',
        border: '2px solid var(--ink)',
        borderRadius: 'var(--radius-console)',
        boxShadow: 'var(--shadow-paper)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '2px solid var(--ink)',
          background: 'var(--page-2)',
        }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)' }}>
            auto<span style={{ color: 'var(--stamp)' }}>part</span>dz
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-2)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Admin Console
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
              Sign in
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-2)' }}>
              Admin access only. Your session is verified on every request.
            </p>
          </div>

          {error && (
            <div className="console-alert console-alert-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Email <span className="required">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Password <span className="required">*</span>
            </label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: 4, minHeight: 44 }}
            disabled={busy}
          >
            {busy ? <><span className="spinner" />Signing in…</> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
