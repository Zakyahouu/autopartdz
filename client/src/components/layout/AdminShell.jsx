import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';

export default function AdminShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--page)',
      }}>
        <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="console-layout">
      <Sidebar />
      <main className="console-main">
        <Outlet />
      </main>
    </div>
  );
}
