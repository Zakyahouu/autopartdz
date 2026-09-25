import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import { LogOut, User } from 'lucide-react';

export default function AdminShell() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
  if (location.pathname.startsWith('/admin/orders/') && location.pathname !== '/admin/orders') {
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
