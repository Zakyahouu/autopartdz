import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ArrowRight, AlertCircle, Lock } from 'lucide-react';

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
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--admin-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: 'min(400px, 100%)',
        backgroundColor: 'var(--admin-surface)',
        border: '1px solid var(--admin-border)',
        borderRadius: 'var(--admin-radius)',
        boxShadow: 'var(--admin-shadow-sm)',
        padding: 32,
      }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div className="admin-brand-icon" style={{ width: 32, height: 32 }}>
            <ShieldCheck size={18} strokeWidth={2.5} />
          </div>
          <div>
            <div className="admin-brand-title" style={{ fontSize: 16 }}>
              autopart<span>dz</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--admin-text-muted)' }}>
              Document Management Console
            </div>
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--admin-text-primary)' }}>
            Admin Sign In
          </h1>
          <p style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginTop: 4 }}>
            Enter your credentials to access the admin catalog.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="admin-alert admin-alert-error" role="alert" style={{ marginBottom: 16 }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="admin-form-group">
            <label htmlFor="login-email" className="admin-form-label">
              Email Address <span className="required">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              className="admin-input"
              autoComplete="email"
              placeholder="admin@autopartdz.dz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="login-password" className="admin-form-label">
              Password <span className="required">*</span>
            </label>
            <input
              id="login-password"
              type="password"
              className="admin-input"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          <button
            type="submit"
            className="btn-admin-primary"
            style={{
              marginTop: 6,
              height: 40,
              justifyContent: 'center',
              width: '100%',
              fontSize: 14,
            }}
            disabled={busy}
          >
            {busy ? (
              <>
                <span className="admin-spinner" />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
