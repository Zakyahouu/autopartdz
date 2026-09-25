import { NavLink } from 'react-router-dom';
import { ClipboardList, FolderKanban, ShieldCheck, LayoutGrid, Sparkles } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/admin/orders', icon: ClipboardList, label: 'Orders' },
  { to: '/admin/catalog', icon: FolderKanban, label: 'Catalog' },
  {
    to: '/admin/design-preview',
    icon: LayoutGrid,
    label: 'UI Concept Lab',
    badge: '3 Designs',
  },
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
        {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            style={to === '/admin/design-preview' ? {
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08), rgba(99, 102, 241, 0.08))',
              borderInlineStartColor: '#0284c7',
            } : undefined}
          >
            <Icon size={17} strokeWidth={2} color={to === '/admin/design-preview' ? '#0284c7' : undefined} />
            <span style={{ fontWeight: to === '/admin/design-preview' ? 600 : undefined }}>{label}</span>
            {badge && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 10,
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  letterSpacing: '0.02em',
                }}
              >
                {badge}
              </span>
            )}
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
