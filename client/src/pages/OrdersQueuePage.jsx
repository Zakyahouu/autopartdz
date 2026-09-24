import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  RotateCcw,
  PlusCircle,
  ArrowRight,
  Filter,
} from 'lucide-react';

export default function OrdersQueuePage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' | 'confirmed' | 'all'
  const [search, setSearch] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
    const { ok, data } = await apiFetch(`/orders${query}`);
    if (ok && Array.isArray(data)) {
      setOrders(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchCode = o.trackingCode?.toLowerCase().includes(q);
      const matchName = o.clientName?.toLowerCase().includes(q);
      const matchPhone = o.phone?.toLowerCase().includes(q);
      const matchVin = o.vin?.toLowerCase().includes(q);
      return matchCode || matchName || matchPhone || matchVin;
    });
  }, [orders, search]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="admin-status" style={{ background: 'rgba(234, 88, 12, 0.1)', color: '#ea580c' }}>
            <Clock size={12} strokeWidth={2.2} />
            <span>Pending Review</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="admin-status is-active">
            <CheckCircle2 size={12} strokeWidth={2.2} />
            <span>Confirmed</span>
          </span>
        );
      case 'completed':
        return (
          <span className="admin-status" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
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
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--admin-text-primary)' }}>
            Orders Management
          </h1>
          <p style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginTop: 2 }}>
            Review, verify customs documentation sources, and confirm incoming client import demands.
          </p>
        </div>
      </div>

      {/* Toolbar: Status Filter and Search */}
      <div className="admin-toolbar">
        <div className="admin-filter-tabs">
          <button
            type="button"
            className={`admin-filter-tab ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Pending Review
          </button>
          <button
            type="button"
            className={`admin-filter-tab ${statusFilter === 'confirmed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('confirmed')}
          >
            Confirmed
          </button>
          <button
            type="button"
            className={`admin-filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Orders
          </button>
        </div>

        <div className="admin-search-wrapper">
          <Search size={15} className="admin-search-icon" />
          <input
            type="search"
            className="admin-search-input"
            placeholder="Search tracking code, client, phone, VIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
              <th className="align-center" style={{ width: 130 }}>Status</th>
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
                  No orders found in this view.
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
