import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
  PlusCircle,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Package,
  Truck,
  MapPin,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';

const STATUS_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'ready_for_dispatch', label: 'Ready for Dispatch' },
  { key: 'packaged', label: 'Packaged' },
  { key: 'sent_to_client', label: 'Sent to Client' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All Orders' },
];

export default function OrdersQueuePage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending'); // Default tab: pending
  const [search, setSearch] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    const { ok, data } = await apiFetch('/orders');
    if (ok && Array.isArray(data)) {
      setOrders(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const counts = useMemo(() => {
    const c = { all: orders.length };
    STATUS_TABS.forEach((t) => {
      if (t.key !== 'all') c[t.key] = 0;
    });
    orders.forEach((o) => {
      if (c[o.status] !== undefined) c[o.status]++;
    });
    return c;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (statusFilter !== 'all') {
      list = list.filter((o) => o.status === statusFilter);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((o) => {
      const matchCode = o.trackingCode?.toLowerCase().includes(q);
      const matchName = o.clientName?.toLowerCase().includes(q);
      const matchPhone = o.phone?.toLowerCase().includes(q);
      const matchVin = o.vin?.toLowerCase().includes(q);
      return matchCode || matchName || matchPhone || matchVin;
    });
  }, [orders, statusFilter, search]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="admin-status" style={{ background: 'rgba(234, 88, 12, 0.1)', color: '#ea580c', borderColor: 'rgba(234, 88, 12, 0.25)' }}>
            <Clock size={12} strokeWidth={2.2} />
            <span>Pending Review</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="admin-status" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', borderColor: 'rgba(37, 99, 235, 0.25)' }}>
            <CheckCircle2 size={12} strokeWidth={2.2} />
            <span>Confirmed</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="admin-status" style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.25)' }}>
            <RefreshCw size={12} strokeWidth={2.2} />
            <span>In Progress</span>
          </span>
        );
      case 'ready_for_dispatch':
        return (
          <span className="admin-status" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', borderColor: 'rgba(124, 58, 237, 0.25)' }}>
            <ShieldCheck size={12} strokeWidth={2.2} />
            <span>Ready for Dispatch</span>
          </span>
        );
      case 'packaged':
        return (
          <span className="admin-status" style={{ background: 'rgba(8, 145, 178, 0.1)', color: '#0891b2', borderColor: 'rgba(8, 145, 178, 0.25)' }}>
            <Package size={12} strokeWidth={2.2} />
            <span>Packaged</span>
          </span>
        );
      case 'sent_to_client':
        return (
          <span className="admin-status" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', borderColor: 'rgba(2, 132, 199, 0.25)' }}>
            <Truck size={12} strokeWidth={2.2} />
            <span>Sent to Client</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="admin-status" style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', borderColor: 'rgba(5, 150, 105, 0.25)' }}>
            <MapPin size={12} strokeWidth={2.2} />
            <span>Delivered</span>
          </span>
        );
      case 'completed':
        return (
          <span className="admin-status is-active" style={{ background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', borderColor: 'rgba(22, 163, 74, 0.25)' }}>
            <CheckCircle2 size={12} strokeWidth={2.2} />
            <span>Completed</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="admin-status is-inactive" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
            <AlertCircle size={12} strokeWidth={2.2} />
            <span>Rejected</span>
          </span>
        );
      default:
        return (
          <span className="admin-status">
            <span>{status?.replace(/_/g, ' ') || 'Unknown'}</span>
          </span>
        );
    }
  };

  return (
    <div>
      {/* ── UI CONCEPT EXPLORATION BANNER ──────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderRadius: 12,
          marginBottom: 20,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={18} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>Order Detail UI Exploration: 3 New Layouts Ready</span>
              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, backgroundColor: '#38bdf8', color: '#0f172a', fontWeight: 800 }}>
                LIVE PREVIEW
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Compare <strong>1. Clean Split</strong>, <strong>2. Executive Table</strong>, and <strong>3. 2-Col Dashboard</strong>. Test them in the lab or click any order below.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link
            to="/admin/design-preview"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 6,
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              fontSize: 12.5,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(56, 189, 248, 0.3)',
            }}
          >
            <LayoutGrid size={14} />
            <span>Open UI Concept Lab →</span>
          </Link>
        </div>
      </div>

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--admin-text-primary)' }}>
            Orders Management
          </h1>
          <p style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginTop: 2 }}>
            Manage client orders across all production lifecycle stages from intake to delivery.
          </p>
        </div>
      </div>

      {/* Toolbar: Status Tabs and Search */}
      <div className="admin-toolbar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {/* Status Tabs Bar */}
          <div
            className="admin-filter-tabs"
            style={{
              overflowX: 'auto',
              maxWidth: '100%',
              whiteSpace: 'nowrap',
              padding: '4px',
              gap: 3,
            }}
          >
            {STATUS_TABS.map((tab) => {
              const isActive = statusFilter === tab.key;
              const count = counts[tab.key] || 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`admin-filter-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setStatusFilter(tab.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    backgroundColor: isActive ? 'var(--admin-surface-hover, #f1f5f9)' : 'transparent',
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '1px 6px',
                      borderRadius: 10,
                      backgroundColor: isActive ? 'var(--admin-accent)' : 'var(--admin-surface-2, #e2e8f0)',
                      color: isActive ? '#ffffff' : 'var(--admin-text-secondary)',
                      fontWeight: 700,
                      minWidth: 18,
                      textAlign: 'center',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="admin-search-wrapper" style={{ minWidth: 260 }}>
            <Search size={15} className="admin-search-icon" />
            <input
              type="search"
              className="admin-search-input"
              placeholder="Search code, client, phone, VIN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 140 }}>Tracking Code</th>
              <th style={{ width: 110 }}>Type</th>
              <th>Client Information</th>
              <th>Vehicle / Category</th>
              <th className="align-center" style={{ width: 110 }}>Documents</th>
              <th style={{ width: 140 }}>Created</th>
              <th className="align-center" style={{ width: 150 }}>Status</th>
              <th className="align-right" style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="admin-table-empty">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span className="admin-spinner" />
                    <span>Loading orders queue…</span>
                  </div>
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="8" className="admin-table-empty">
                  No orders found in status &ldquo;{STATUS_TABS.find((t) => t.key === statusFilter)?.label}&rdquo;.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order._id}>
                  <td>
                    <Link
                      to={`/admin/orders/${order._id}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: 13,
                        color: 'var(--admin-accent)',
                        textDecoration: 'none',
                      }}
                    >
                      {order.trackingCode}
                    </Link>
                  </td>

                  <td>
                    {order.orderType === 'correction' ? (
                      <span className="admin-doc-chip" style={{ color: '#ea580c', borderColor: '#fdba74' }}>
                        <RotateCcw size={10} style={{ marginRight: 3 }} />
                        Correction
                      </span>
                    ) : (
                      <span className="admin-doc-chip" style={{ color: 'var(--admin-accent)', borderColor: 'var(--admin-accent-subtle)' }}>
                        <PlusCircle size={10} style={{ marginRight: 3 }} />
                        New Demand
                      </span>
                    )}
                  </td>

                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                      {order.clientName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--admin-text-secondary)', marginTop: 1 }}>
                      {order.phone} — {order.wilaya}
                    </div>
                  </td>

                  <td>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--admin-text-primary)' }}>
                      {order.vin}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--admin-text-secondary)', marginTop: 1 }}>
                      {order.carModel || '—'} ({order.carCategoryName})
                    </div>
                  </td>

                  <td className="align-center">
                    <span className="admin-badge" style={{ fontSize: 12, padding: '2px 8px' }}>
                      {order.lineCount} line{order.lineCount === 1 ? '' : 's'}
                    </span>
                  </td>

                  <td style={{ fontSize: 12.5, color: 'var(--admin-text-secondary)' }}>
                    {new Date(order.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>

                  <td className="align-center">
                    {getStatusBadge(order.status)}
                  </td>

                  <td className="align-right">
                    <Link
                      to={`/admin/orders/${order._id}`}
                      className="btn-admin-secondary"
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>{order.status === 'pending' ? 'Review' : 'View'}</span>
                      <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
