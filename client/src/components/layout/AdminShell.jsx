import { Outlet, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import { LogOut, User, Sparkles, LayoutGrid, SplitSquareVertical, Table as TableIcon, Columns } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function AdminShell() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeConcept, setActiveConcept] = useState(() => {
    return localStorage.getItem('autopartdz_order_detail_concept') || 'split';
  });

  useEffect(() => {
    const handleConceptUpdate = (e) => {
      const c = e.detail || localStorage.getItem('autopartdz_order_detail_concept') || 'split';
      setActiveConcept(c);
    };
    window.addEventListener('conceptChange', handleConceptUpdate);
    window.addEventListener('storage', handleConceptUpdate);
    return () => {
      window.removeEventListener('conceptChange', handleConceptUpdate);
      window.removeEventListener('storage', handleConceptUpdate);
    };
  }, []);

  const handleConceptClick = (concept) => {
    setActiveConcept(concept);
    localStorage.setItem('autopartdz_order_detail_concept', concept);
    window.dispatchEvent(new CustomEvent('conceptChange', { detail: concept }));
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--admin-bg)',
      }}>
        <span className="admin-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Determine breadcrumb current title
  let sectionTitle = 'Orders Queue';
  const isOrderDetail = location.pathname.startsWith('/admin/orders/') && location.pathname !== '/admin/orders';
  const isDesignPreview = location.pathname.includes('design-preview');

  if (isDesignPreview) {
    sectionTitle = 'UI Concept Lab';
  } else if (isOrderDetail) {
    sectionTitle = 'Order Detail';
  } else if (location.pathname.includes('catalog') || location.pathname.includes('document-types') || location.pathname.includes('car-categories')) {
    sectionTitle = 'Catalog';
  } else if (location.pathname === '/admin/orders' || location.pathname === '/admin') {
    sectionTitle = 'Orders Queue';
  }

  return (
    <div className="admin-layout" dir="ltr">
      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Workspace */}
      <div className="admin-workspace">
        {/* Top Bar */}
        <header className="admin-topbar">
          <div className="admin-topbar-breadcrumb">
            <span>Admin</span>
            <span>/</span>
            <span className="current">{sectionTitle}</span>
          </div>

          {/* Quick Concept Switcher Pill in Top Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineStart: 'auto', marginInlineEnd: 16 }}>
            {isOrderDetail ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: '#0f172a',
                  padding: '3px 6px',
                  borderRadius: 8,
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', paddingRight: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Sparkles size={11} />
                  <span>Layout:</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleConceptClick('split')}
                  style={{
                    border: 'none',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: activeConcept === 'split' ? '#38bdf8' : 'transparent',
                    color: activeConcept === 'split' ? '#0f172a' : '#94a3b8',
                  }}
                  title="Concept 1: Clean Split"
                >
                  1. Split
                </button>
                <button
                  type="button"
                  onClick={() => handleConceptClick('table')}
                  style={{
                    border: 'none',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: activeConcept === 'table' ? '#38bdf8' : 'transparent',
                    color: activeConcept === 'table' ? '#0f172a' : '#94a3b8',
                  }}
                  title="Concept 2: Executive Data Table"
                >
                  2. Table
                </button>
                <button
                  type="button"
                  onClick={() => handleConceptClick('dashboard')}
                  style={{
                    border: 'none',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: activeConcept === 'dashboard' ? '#38bdf8' : 'transparent',
                    color: activeConcept === 'dashboard' ? '#0f172a' : '#94a3b8',
                  }}
                  title="Concept 3: 2-Column Dashboard"
                >
                  3. Dashboard
                </button>
                <Link
                  to="/admin/design-preview"
                  style={{
                    fontSize: 11,
                    color: '#38bdf8',
                    textDecoration: 'none',
                    paddingLeft: 6,
                    borderLeft: '1px solid rgba(255,255,255,0.2)',
                  }}
                  title="View full comparison lab"
                >
                  Lab →
                </Link>
              </div>
            ) : (
              <Link
                to="/admin/design-preview"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 20,
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  transition: 'all 0.15s ease',
                }}
                title="Open the UI Concept Lab to preview 3 different Order Detail layouts"
              >
                <Sparkles size={13} color="#38bdf8" />
                <span>🎨 UI Concept Lab (3 Designs)</span>
              </Link>
            )}
          </div>

          <div className="admin-topbar-user">
            <div className="admin-user-info">
              <span className="admin-user-name">{user?.name || 'Administrator'}</span>
              <span className="admin-user-role">{user?.role?.replace('_', ' ')}</span>
            </div>

            <button
              type="button"
              className="admin-logout-btn"
              onClick={handleLogout}
              title="Sign out of admin console"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
