import { NavLink } from 'react-router-dom';
import { ClipboardList, FolderKanban, ShieldCheck } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/admin/orders', icon: ClipboardList, label: 'Orders' },
  { to: '/admin/catalog', icon: FolderKanban, label: 'Catalog' },
];

export default function Sidebar() {
  return (
    <aside className="admin-sidebar" aria-label="Admin navigation">
      {/* Brand Header */}
      <div className="admin-sidebar-header">
        <div className="admin-brand-icon">
          <ShieldCheck size={16} strokeWidth={2.5} />
        </div>
        <div>
          <div className="admin-brand-title">
            autopart<span>dz</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="admin-sidebar-nav">
        <div className="admin-nav-section-label">Management</div>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={17} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Footer info */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--admin-border)',
        fontSize: '11.5px',
        color: 'var(--admin-text-muted)',
      }}>
        <span>Admin Platform v1.0</span>
      </div>
    </aside>
  );
}
