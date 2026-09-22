import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/admin/document-types', icon: '📄', label: 'Document Types' },
  { to: '/admin/car-categories', icon: '🚗', label: 'Car Categories' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="console-sidebar" aria-label="Admin navigation">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-text">
          auto<span>part</span>dz
        </div>
        <div className="sidebar-logo-sub">Admin Console</div>
      </div>

      {/* Navigation */}
      <nav>
        <div className="sidebar-section-label">Catalog</div>
        <ul className="sidebar-nav" role="list">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <li key={to} className="sidebar-nav-item">
              <NavLink
                to={to}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <span className="sidebar-nav-icon" aria-hidden="true">{icon}</span>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user-name">{user?.name}</div>
        <div className="sidebar-user-role">{user?.role?.replace('_', ' ')}</div>
        <button
          className="btn btn-danger btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={handleLogout}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
