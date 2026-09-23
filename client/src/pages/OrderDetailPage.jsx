import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  Plus,
  ShieldCheck,
  User,
  Car,
  FileText,
  RotateCcw,
  X,
  ExternalLink,
  Send,
  Printer,
  Upload,
  Copy,
  Check,
  RefreshCw,
  Paperclip,
  Download,
  ThumbsUp,
  ThumbsDown,
  Package,
  Truck,
  MapPin,
} from 'lucide-react';

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Line source changes: map of lineId -> source ('local' | 'china')
  const [lineSources, setLineSources] = useState({});
  // China Associates list
  const [chinaAssociates, setChinaAssociates] = useState([]);
  // Line assignees: map of lineId -> userId
  const [lineAssignees, setLineAssignees] = useState({});

  // Proxy progression modals
  const [proxyShipLine, setProxyShipLine] = useState(null);
  const [proxyShipTrackingCode, setProxyShipTrackingCode] = useState('');
  const [proxyShipNote, setProxyShipNote] = useState('');
  const [proxyShipFile, setProxyShipFile] = useState(null);
  const [proxyShipBusy, setProxyShipBusy] = useState(false);
  const [proxyShipError, setProxyShipError] = useState('');

  const [proxyPrintLine, setProxyPrintLine] = useState(null);
  const [proxyPrintNote, setProxyPrintNote] = useState('');
  const [proxyPrintFile, setProxyPrintFile] = useState(null);
  const [proxyPrintBusy, setProxyPrintBusy] = useState(false);
  const [proxyPrintError, setProxyPrintError] = useState('');

  const [proxyDelayLine, setProxyDelayLine] = useState(null);
  const [proxyDelayIsDelayed, setProxyDelayIsDelayed] = useState(false);
  const [proxyDelayNote, setProxyDelayNote] = useState('');
  const [proxyDelayBusy, setProxyDelayBusy] = useState(false);
  const [proxyDelayError, setProxyDelayError] = useState('');

  // Review (approve / reject) modal
  const [reviewLine, setReviewLine] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('approve');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Mark-Arrived busy state (per line)
  const [arrivedBusyId, setArrivedBusyId] = useState(null);

  // Order-level fulfillment busy
  const [fulfillmentBusy, setFulfillmentBusy] = useState(false);

  const [copiedTracking, setCopiedTracking] = useState('');

  // Add line modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [catalogDocs, setCatalogDocs] = useState([]);
  const [selectedAddDocId, setSelectedAddDocId] = useState('');
  const [selectedAddMode, setSelectedAddMode] = useState('original_only');
  const [selectedAddSource, setSelectedAddSource] = useState('local');

  // Delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Attach file modal
  const [attachModalLine, setAttachModalLine] = useState(null);
  const [attachFile, setAttachFile] = useState(null);
  const [attachNote, setAttachNote] = useState('');
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachError, setAttachError] = useState('');

  const loadOrderDetail = async () => {
    setLoading(true);
    const { ok, data } = await apiFetch(`/orders/${id}`);
    if (ok && data) {
      setOrder(data);
      // Initialize line sources & assignees
      const sources = {};
      const assignees = {};
      (data.lines || []).forEach((l) => {
        sources[l._id] = l.source;
        assignees[l._id] = l.assignedChinaAccountId?._id || l.assignedChinaAccountId || '';
      });
      setLineSources(sources);
      setLineAssignees(assignees);
    } else {
      setError(data?.error || 'Failed to load order details.');
    }
    setLoading(false);
  };

  const loadCatalog = async () => {
    const { ok, data } = await apiFetch('/document-types');
    if (ok && Array.isArray(data)) {
      setCatalogDocs(data.filter((d) => d.active));
    }
  };

  const loadChinaAssociates = async () => {
    const { ok, data } = await apiFetch('/users?role=china_associate&active=true');
    if (ok && Array.isArray(data)) {
      setChinaAssociates(data);
    }
  };

  useEffect(() => {
    loadOrderDetail();
    loadCatalog();
    loadChinaAssociates();
  }, [id]);

  const handleSourceChange = (lineId, newSource) => {
    setLineSources((prev) => ({
      ...prev,
      [lineId]: newSource === '' ? null : newSource,
    }));
  };

  const handleAssigneeChange = async (lineId, newAssigneeId) => {
    setLineAssignees((prev) => ({
      ...prev,
      [lineId]: newAssigneeId,
    }));

    // If order is already confirmed, persist assignment immediately via PATCH /orders/:id/lines/:lineId/assign
    if (order && order.status !== 'pending') {
      const res = await apiFetch(`/orders/${id}/lines/${lineId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ chinaAccountId: newAssigneeId || null }),
      });
      if (res.ok) {
        loadOrderDetail();
      } else {
        alert(res.data?.error || 'Failed to update line assignment.');
      }
    }
  };

  const handleRemoveLine = async (lineId) => {
    if (!window.confirm('Are you sure you want to remove this document line from the order?')) {
      return;
    }
    setActionLoading(true);
    const res = await apiFetch(`/orders/${id}/confirm`, {
      method: 'PATCH',
      body: JSON.stringify({
        removeLineIds: [lineId],
      }),
    });
    setActionLoading(false);
    if (res.ok) {
      loadOrderDetail();
    } else {
      alert(res.data?.error || 'Failed to remove line.');
    }
  };

  const handleAddLineSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAddDocId) return;

    setActionLoading(true);
    const res = await apiFetch(`/orders/${id}/confirm`, {
      method: 'PATCH',
      body: JSON.stringify({
        addLineItems: [
          {
            documentTypeId: selectedAddDocId,
            translationMode: selectedAddMode,
            source: selectedAddSource,
          },
        ],
      }),
    });
    setActionLoading(false);

    if (res.ok) {
      setAddModalOpen(false);
      setSelectedAddDocId('');
      loadOrderDetail();
    } else {
      alert(res.data?.error || 'Failed to add document line.');
    }
  };

  const handleConfirmOrder = async () => {
    // Check if any line has an unset source
    const currentLines = order.lines || [];
    const missingSources = currentLines.filter((l) => !lineSources[l._id]);

    if (missingSources.length > 0) {
      alert(
        `Cannot confirm order: ${missingSources.length} document line(s) must have a valid source ("Local" or "China"). Please assign all sources first.`
      );
      return;
    }

    // Part B rule: A china-source line cannot be left unassigned once source = 'china' is set
    const missingAssignees = currentLines.filter(
      (l) => lineSources[l._id] === 'china' && !lineAssignees[l._id]
    );

    if (missingAssignees.length > 0) {
      alert(
        `Cannot confirm order: All China-sourced document lines must be assigned to an active China associate. ${missingAssignees.length} line(s) missing assignment.`
      );
      return;
    }

    setActionLoading(true);
    // Submit all updated sources and assignees, triggering confirmation
    const lineUpdates = Object.entries(lineSources).map(([lineId, source]) => ({
      lineId,
      source,
      assignedChinaAccountId: source === 'china' ? lineAssignees[lineId] || null : null,
    }));

    const res = await apiFetch(`/orders/${id}/confirm`, {
      method: 'PATCH',
      body: JSON.stringify({
        lineUpdates,
      }),
    });
    setActionLoading(false);

    if (res.ok) {
      loadOrderDetail();
    } else {
      alert(res.data?.error || 'Failed to confirm order.');
    }
  };

  // Proxy ship submit
  const handleProxyShipSubmit = async (e) => {
    e.preventDefault();
    if (!proxyShipTrackingCode.trim()) {
      setProxyShipError('Shipping tracking code is required.');
      return;
    }
    setProxyShipBusy(true);
    setProxyShipError('');
    try {
      const formData = new FormData();
      formData.append('shippingTrackingCode', proxyShipTrackingCode.trim());
      if (proxyShipNote.trim()) formData.append('note', proxyShipNote.trim());
      if (proxyShipFile) formData.append('file', proxyShipFile);

      const token = localStorage.getItem('autopartdz_token');
      const res = await fetch(`/api/order-lines/${proxyShipLine._id}/ship`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark line as shipped');

      setProxyShipLine(null);
      setProxyShipTrackingCode('');
      setProxyShipNote('');
      setProxyShipFile(null);
      loadOrderDetail();
    } catch (err) {
      setProxyShipError(err.message);
    } finally {
      setProxyShipBusy(false);
    }
  };

  // Proxy print submit
  const handleProxyPrintSubmit = async (e) => {
    e.preventDefault();
    setProxyPrintBusy(true);
    setProxyPrintError('');
    try {
      const formData = new FormData();
      if (proxyPrintNote.trim()) formData.append('note', proxyPrintNote.trim());
      if (proxyPrintFile) formData.append('file', proxyPrintFile);

      const token = localStorage.getItem('autopartdz_token');
      const res = await fetch(`/api/order-lines/${proxyPrintLine._id}/mark-printed`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark line as printed');

      setProxyPrintLine(null);
      setProxyPrintNote('');
      setProxyPrintFile(null);
      loadOrderDetail();
    } catch (err) {
      setProxyPrintError(err.message);
    } finally {
      setProxyPrintBusy(false);
    }
  };

  // Proxy delay submit
  const handleProxyDelaySubmit = async (e) => {
    e.preventDefault();
    setProxyDelayBusy(true);
    setProxyDelayError('');
    try {
      const { ok, data } = await apiFetch(`/order-lines/${proxyDelayLine._id}/delay`, {
        method: 'PATCH',
        body: JSON.stringify({
          isDelayed: proxyDelayIsDelayed,
          note: proxyDelayNote.trim(),
        }),
      });
      if (!ok) throw new Error(data?.error || 'Failed to update delay status');

      setProxyDelayLine(null);
      setProxyDelayNote('');
      loadOrderDetail();
    } catch (err) {
      setProxyDelayError(err.message);
    } finally {
      setProxyDelayBusy(false);
    }
  };

  // ── Review (Approve / Reject) submit ─────────────────────────────────────
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (reviewDecision === 'reject' && !reviewNote.trim()) {
      setReviewError('A note is required when rejecting — the associate needs to know what to fix.');
      return;
    }
    setReviewBusy(true);
    setReviewError('');
    try {
      const { ok, data } = await apiFetch(`/order-lines/${reviewLine._id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision: reviewDecision, note: reviewNote.trim() }),
      });
      if (!ok) throw new Error(data?.error || 'Failed to submit review.');
      setReviewLine(null);
      setReviewNote('');
      await loadOrderDetail();
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewBusy(false);
    }
  };

  // ── Mark Arrived at Office ─────────────────────────────────────────────────
  const handleMarkArrived = async (lineId) => {
    setArrivedBusyId(lineId);
    try {
      const { ok, data } = await apiFetch(`/order-lines/${lineId}/mark-arrived`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!ok) throw new Error(data?.error || 'Failed to mark line as arrived.');
      await loadOrderDetail();
    } catch (err) {
      alert(err.message);
    } finally {
      setArrivedBusyId(null);
    }
  };

  // ── Fulfillment actions (package / dispatch / deliver) ─────────────────────
  const handleFulfillment = async (action) => {
    setFulfillmentBusy(true);
    try {
      const { ok, data } = await apiFetch(`/orders/${id}/${action}`, { method: 'POST' });
      if (!ok) throw new Error(data?.error || `Failed to ${action} order.`);
      await loadOrderDetail();
    } catch (err) {
      alert(err.message);
    } finally {
      setFulfillmentBusy(false);
    }
  };

  // Attach document file submit (without status change)
  const handleAttachSubmit = async (e) => {
    e.preventDefault();
    if (!attachFile) {
      setAttachError('Please select a file to attach.');
      return;
    }
    setAttachBusy(true);
    setAttachError('');
    try {
      const formData = new FormData();
      formData.append('file', attachFile);
      if (attachNote.trim()) formData.append('note', attachNote.trim());

      const token = localStorage.getItem('autopartdz_token');
      const res = await fetch(`/api/order-lines/${attachModalLine._id}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to attach file');

      setAttachModalLine(null);
      setAttachFile(null);
      setAttachNote('');
      loadOrderDetail();
    } catch (err) {
      setAttachError(err.message);
    } finally {
      setAttachBusy(false);
    }
  };

  // Download / View file helper
  const handleDownloadFile = async (fileId, filename) => {
    try {
      const token = localStorage.getItem('autopartdz_token');
      const res = await fetch(`/api/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to retrieve file.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (err) {
      alert(err.message || 'Error downloading file');
    }
  };

  const handleCopyTracking = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedTracking(code);
    setTimeout(() => setCopiedTracking(''), 2000);
  };

  const handleDeleteOrder = async () => {
    setActionLoading(true);
    const res = await apiFetch(`/orders/${id}`, {
      method: 'DELETE',
    });
    setActionLoading(false);

    if (res.ok) {
      navigate('/admin/orders');
    } else {
      alert(res.data?.error || 'Failed to delete order.');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--admin-text-secondary)' }}>
        <span className="admin-spinner" style={{ marginBottom: 12 }} />
        <div>Loading order dossier…</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="admin-alert admin-alert-error" style={{ margin: '20px 0' }}>
        <AlertTriangle size={16} />
        <span>{error || 'Order not found.'}</span>
      </div>
    );
  }

  const isPending = order.status === 'pending';
  const lines = order.lines || [];
  const linesMissingSourceCount = lines.filter((l) => !lineSources[l._id]).length;

  return (
    <div>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/admin/orders" className="btn-admin-secondary" style={{ padding: '6px 10px' }}>
            <ArrowLeft size={14} />
            <span>Orders Queue</span>
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>
            Order <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--admin-accent)' }}>{order.trackingCode}</span>
          </h1>
          {order.orderType === 'correction' ? (
            <span className="admin-doc-chip" style={{ color: '#ea580c', borderColor: '#fdba74' }}>
              <RotateCcw size={11} style={{ marginRight: 4 }} />
              Correction Order
            </span>
          ) : (
            <span className="admin-doc-chip" style={{ color: 'var(--admin-accent)', borderColor: 'var(--admin-accent-subtle)' }}>
              New Import Demand
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isPending && (
            <button
              type="button"
              className="btn-admin-icon danger"
              title="Delete pending order"
              onClick={() => setDeleteModalOpen(true)}
              disabled={actionLoading}
            >
              <Trash2 size={15} />
            </button>
          )}

          {isPending && (
            <button
              type="button"
              className="btn-admin-primary"
              onClick={handleConfirmOrder}
              disabled={actionLoading || linesMissingSourceCount > 0}
              title={linesMissingSourceCount > 0 ? 'Assign all line sources before confirming' : 'Confirm Order'}
            >
              <CheckCircle2 size={15} />
              <span>Confirm Order</span>
            </button>
          )}

          {/* Fulfillment actions — one primary action shown at a time */}
          {order.status === 'ready_for_dispatch' && (
            <button
              type="button"
              className="btn-admin-primary"
              onClick={() => handleFulfillment('package')}
              disabled={fulfillmentBusy}
              style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
            >
              <Package size={15} />
              <span>{fulfillmentBusy ? 'Saving…' : 'Package Order'}</span>
            </button>
          )}

          {order.status === 'packaged' && (
            <button
              type="button"
              className="btn-admin-primary"
              onClick={() => handleFulfillment('dispatch')}
              disabled={fulfillmentBusy}
              style={{ backgroundColor: '#0891b2', borderColor: '#0891b2' }}
            >
              <Truck size={15} />
              <span>{fulfillmentBusy ? 'Saving…' : 'Dispatch to Client'}</span>
            </button>
          )}

          {order.status === 'sent_to_client' && (
            <button
              type="button"
              className="btn-admin-primary"
              onClick={() => handleFulfillment('deliver')}
              disabled={fulfillmentBusy}
              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
            >
              <MapPin size={15} />
              <span>{fulfillmentBusy ? 'Saving…' : 'Mark Delivered'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Linked Order Callout if Correction */}
      {order.orderType === 'correction' && order.linkedOrderId && (
        <div className="admin-alert" style={{ background: 'rgba(234, 88, 12, 0.08)', borderColor: '#fdba74', color: '#ea580c', marginBottom: 16 }}>
          <RotateCcw size={16} style={{ flexShrink: 0 }} />
          <span>
            This is a correction order linked to original order{' '}
            <Link
              to={`/admin/orders/${order.linkedOrderId._id}`}
              style={{ fontWeight: 700, color: '#c2410c', textDecoration: 'underline', fontFamily: 'var(--font-mono)' }}
            >
              {order.linkedOrderId.trackingCode}
            </Link>
            . Client has flagged specific documents for amendment.
          </span>
        </div>
      )}

      {/* Source Warning Banner */}
      {isPending && linesMissingSourceCount > 0 && (
        <div className="admin-alert admin-alert-error" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong>Action Required:</strong> {linesMissingSourceCount} document line(s) have an unassigned source (e.g. from a &quot;Mixed&quot; catalog document). Please select <strong>Local</strong> or <strong>China</strong> for each line to enable confirmation.
          </span>
        </div>
      )}

      {/* Status & Overview Bar */}
      <div className="admin-card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Status
            </div>
            <div style={{ marginTop: 2 }}>
              <span className={`admin-status ${
                order.status === 'confirmed' ? 'is-active' :
                order.status === 'delivered' ? 'is-active' : ''
              }`} style={{
                color:
                  order.status === 'in_progress' ? '#d97706' :
                  order.status === 'ready_for_dispatch' ? '#7c3aed' :
                  order.status === 'packaged' ? '#0891b2' :
                  order.status === 'sent_to_client' ? '#0891b2' :
                  order.status === 'delivered' ? '#16a34a' :
                  undefined,
              }}>
                {['confirmed','delivered'].includes(order.status) ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                <span style={{ textTransform: 'capitalize' }}>{order.status.replace(/_/g, ' ')}</span>
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Submitted At
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-primary)', marginTop: 2 }}>
              {new Date(order.createdAt).toLocaleString('en-GB')}
            </div>
          </div>

          {order.confirmedAt && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Confirmed By
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-primary)', marginTop: 2 }}>
                {order.confirmedBy?.name || 'Admin'} ({new Date(order.confirmedAt).toLocaleDateString('en-GB')})
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Information Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Client Card */}
        <div className="admin-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, borderBottom: '1px solid var(--admin-border)', paddingBottom: 10 }}>
            <User size={16} color="var(--admin-accent)" />
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>
              Client Information
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 12px', fontSize: 13 }}>
            <span style={{ color: 'var(--admin-text-secondary)' }}>Full Name:</span>
            <span style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
              {order.firstName} {order.lastName}
            </span>

            <span style={{ color: 'var(--admin-text-secondary)' }}>Phone:</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{order.phone}</span>

            <span style={{ color: 'var(--admin-text-secondary)' }}>Wilaya:</span>
            <span>{order.wilaya}</span>

            <span style={{ color: 'var(--admin-text-secondary)' }}>Full Address:</span>
            <span>{order.address}</span>

            <span style={{ color: 'var(--admin-text-secondary)' }}>Email:</span>
            <span>{order.email || '—'}</span>

            <span style={{ color: 'var(--admin-text-secondary)' }}>Passport No:</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{order.passportNumber || '—'}</span>

            {order.note && (
              <>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Notes:</span>
                <span style={{ fontStyle: 'italic', color: 'var(--admin-text-secondary)' }}>{order.note}</span>
              </>
            )}
          </div>
        </div>

        {/* Vehicle Card */}
        <div className="admin-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, borderBottom: '1px solid var(--admin-border)', paddingBottom: 10 }}>
            <Car size={16} color="var(--admin-accent)" />
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>
              Vehicle Specifications
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 12px', fontSize: 13 }}>
            <span style={{ color: 'var(--admin-text-secondary)' }}>Chassis VIN:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--admin-accent)' }}>
              {order.vin}
            </span>

            <span style={{ color: 'var(--admin-text-secondary)' }}>Make / Model:</span>
            <span>{order.carModel || '—'}</span>

            <span style={{ color: 'var(--admin-text-secondary)' }}>Category:</span>
            <span>{order.carCategoryId?.name || 'Custom'}</span>

            <span style={{ color: 'var(--admin-text-secondary)' }}>Forwarder / Agency:</span>
            <span>{order.importAgency || '—'}</span>
          </div>
        </div>
      </div>

      {/* Document Lines Management */}
      <div className="admin-card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>
              Document Lines ({lines.length})
            </h2>
            <p style={{ fontSize: 12, color: 'var(--admin-text-secondary)', marginTop: 2 }}>
              Finalize document selection and define fulfillment source per line.
            </p>
          </div>

          {isPending && (
            <button
              type="button"
              className="btn-admin-secondary"
              onClick={() => setAddModalOpen(true)}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              <Plus size={14} />
              <span>Add Document Line</span>
            </button>
          )}
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Document</th>
              <th style={{ width: 170 }}>Translation Mode</th>
              <th className="align-right" style={{ width: 110 }}>Client Fee</th>
              <th className="align-right" style={{ width: 110 }}>Cost Price</th>
              <th style={{ width: 220 }}>Fulfillment & Assignee</th>
              <th className="align-center" style={{ width: 100 }}>Status</th>
              <th className="align-right" style={{ width: 130 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-table-empty">
                  No document lines on this order.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const currentSource = lineSources[line._id];
                const isSourceUnset = !currentSource;
                const currentAssignee = lineAssignees[line._id];
                const isChinaWithoutAssignee = currentSource === 'china' && !currentAssignee;

                return (
                  <tr key={line._id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                        {line.documentTypeId?.fullName || line.documentTypeId?.shortName || 'Document'}
                      </div>
                      {line.documentTypeId?.code && (
                        <span className="admin-doc-chip" style={{ fontSize: 10, padding: '1px 5px', marginTop: 2 }}>
                          {line.documentTypeId.code}
                        </span>
                      )}
                      {line.correctionReason && (
                        <div style={{ marginTop: 4, fontSize: 11.5, color: '#ea580c', background: 'rgba(234, 88, 12, 0.08)', padding: '4px 8px', borderRadius: 4 }}>
                          <strong>Correction Reason:</strong> {line.correctionReason}
                        </div>
                      )}

                      {/* Uploaded Documents List */}
                      {line.uploadedFiles && line.uploadedFiles.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FileText size={11} />
                            <span>Uploaded Files ({line.uploadedFiles.length}):</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {line.uploadedFiles.map((f) => {
                              const uploaderName = f.uploadedByUserId?.name || 'User';
                              const uploaderRole = f.uploadedByUserId?.role ? `(${f.uploadedByUserId.role})` : '';
                              const uploadDate = f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString() : '';
                              const fileSizeKb = f.size ? `${Math.round(f.size / 1024)} KB` : '';
                              return (
                                <div
                                  key={f._id}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    backgroundColor: 'var(--admin-surface-2, #f8fafc)',
                                    border: '1px solid var(--admin-border, #e2e8f0)',
                                    borderRadius: 4,
                                    padding: '2px 8px',
                                    fontSize: 11,
                                  }}
                                >
                                  <FileText size={12} color="var(--admin-accent)" />
                                  <span style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }} title={f.filename}>
                                    {f.filename}
                                  </span>
                                  <span style={{ fontSize: 10, color: 'var(--admin-text-secondary)' }}>
                                    {fileSizeKb && `(${fileSizeKb})`} • {uploaderName} {uploaderRole} • {uploadDate}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(f._id, f.filename)}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                      color: 'var(--admin-accent)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: 2,
                                    }}
                                    title="View or download document"
                                  >
                                    <Download size={12} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </td>

                    <td>
                      <span className="admin-badge" style={{ fontSize: 11.5 }}>
                        {line.translationMode === 'original_only'
                          ? 'Original Only'
                          : line.translationMode === 'original_plus_translation'
                          ? 'Original + Translation'
                          : 'Translation Only'}
                      </span>
                    </td>

                    <td className="align-right" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {line.clientPrice?.toLocaleString()} DZD
                    </td>

                    <td className="align-right" style={{ fontFamily: 'var(--font-mono)', color: 'var(--admin-text-muted)' }}>
                      {line.costPrice?.toLocaleString()} DZD
                    </td>

                    <td>
                      {isPending ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <select
                            className="admin-select"
                            value={currentSource || ''}
                            onChange={(e) => handleSourceChange(line._id, e.target.value)}
                            style={{
                              fontSize: 12,
                              height: 32,
                              borderColor: isSourceUnset ? 'var(--admin-accent)' : undefined,
                              background: isSourceUnset ? 'rgba(168, 35, 27, 0.05)' : undefined,
                            }}
                          >
                            <option value="">— Select Source (Required) —</option>
                            <option value="local">Local (Algeria Print)</option>
                            <option value="china">China (Shipped)</option>
                          </select>

                          {currentSource === 'china' && (
                            <select
                              className="admin-select"
                              value={currentAssignee || ''}
                              onChange={(e) => handleAssigneeChange(line._id, e.target.value)}
                              style={{
                                fontSize: 11.5,
                                height: 30,
                                borderColor: isChinaWithoutAssignee ? '#f59e0b' : undefined,
                                background: isChinaWithoutAssignee ? 'rgba(245, 158, 11, 0.08)' : undefined,
                              }}
                            >
                              <option value="">— Assign China Associate (Required) —</option>
                              {chinaAssociates.map((u) => (
                                <option key={u._id} value={u._id}>
                                  {u.name} ({u.email})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span className={`admin-badge ${line.source === 'local' ? 'is-active' : ''}`}>
                              {line.source === 'local' ? 'Local Print' : 'China Shipped'}
                            </span>
                            {line.source === 'china' && (
                              <span
                                className="admin-doc-chip"
                                style={{
                                  fontSize: 11,
                                  background: line.assignedChinaAccountId ? '#f1f5f9' : '#fef3c7',
                                  color: line.assignedChinaAccountId ? '#334155' : '#b45309',
                                }}
                              >
                                {line.assignedChinaAccountId?.name ? line.assignedChinaAccountId.name : 'Unassigned'}
                              </span>
                            )}
                          </div>
                          {line.shippingTrackingCode && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                              <span style={{ color: 'var(--admin-text-secondary)' }}>Tracking:</span>
                              <span style={{ fontWeight: 600 }}>{line.shippingTrackingCode}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyTracking(line.shippingTrackingCode)}
                                title="Copy tracking code"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 1 }}
                              >
                                {copiedTracking === line.shippingTrackingCode ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="align-center">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <span className="admin-status">
                          <span>{line.status}</span>
                        </span>
                        {line.isDelayed && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 4,
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: '#dc2626',
                            }}
                          >
                            DELAYED
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="align-right">
                      {isPending ? (
                        <button
                          type="button"
                          className="btn-admin-icon danger"
                          title="Remove document line"
                          onClick={() => handleRemoveLine(line._id)}
                          disabled={actionLoading || lines.length <= 1}
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                          {/* Attach File (without status change) */}
                          <button
                            type="button"
                            className="btn-admin-secondary"
                            onClick={() => {
                              setAttachModalLine(line);
                              setAttachFile(null);
                              setAttachNote('');
                              setAttachError('');
                            }}
                            style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title="Attach document scan / file to line"
                          >
                            <Paperclip size={11} />
                            <span>Attach</span>
                          </button>

                          {/* Admin Proxy Sourcing / Printing / Delay Actions */}
                          {line.source === 'china' && ['needed', 'sent_to_china', 'needs_correction'].includes(line.status) && (
                            <button
                              type="button"
                              className="btn-admin-secondary"
                              onClick={() => {
                                setProxyShipLine(line);
                                setProxyShipTrackingCode('');
                                setProxyShipNote('');
                                setProxyShipFile(null);
                                setProxyShipError('');
                              }}
                              style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title="Ship on behalf of China (Proxy)"
                            >
                              <Send size={11} />
                              <span>Ship</span>
                            </button>
                          )}

                          {/* ── Phase 5: Review buttons for shipped china lines ── */}
                          {line.source === 'china' && line.status === 'shipped' && (
                            <>
                              {/* File visibility warning if no files */}
                              {(!line.uploadedFiles || line.uploadedFiles.length === 0) && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: '#dc2626',
                                    background: 'rgba(220,38,38,0.08)',
                                    border: '1px solid rgba(220,38,38,0.25)',
                                    borderRadius: 4,
                                    padding: '2px 6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                  title="No file uploaded — review carefully before approving"
                                >
                                  <AlertTriangle size={10} /> No file
                                </span>
                              )}
                              <button
                                type="button"
                                className="btn-admin-secondary"
                                onClick={() => {
                                  setReviewLine(line);
                                  setReviewDecision('approve');
                                  setReviewNote('');
                                  setReviewError('');
                                }}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  borderColor: '#16a34a',
                                  color: '#16a34a',
                                }}
                                title="Approve shipment — mark arrived at office"
                              >
                                <ThumbsUp size={11} />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                className="btn-admin-secondary"
                                onClick={() => {
                                  setReviewLine(line);
                                  setReviewDecision('reject');
                                  setReviewNote('');
                                  setReviewError('');
                                }}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  borderColor: '#dc2626',
                                  color: '#dc2626',
                                }}
                                title="Reject — send back to China associate for correction"
                              >
                                <ThumbsDown size={11} />
                                <span>Reject</span>
                              </button>
                              <button
                                type="button"
                                className="btn-admin-secondary"
                                onClick={() => {
                                  setProxyDelayLine(line);
                                  setProxyDelayIsDelayed(!line.isDelayed);
                                  setProxyDelayNote('');
                                  setProxyDelayError('');
                                }}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  borderColor: line.isDelayed ? '#16a34a' : '#f59e0b',
                                  color: line.isDelayed ? '#16a34a' : '#b45309',
                                }}
                                title="Toggle transit delay flag"
                              >
                                <AlertTriangle size={11} />
                                <span>{line.isDelayed ? 'Clear Delay' : 'Flag Delay'}</span>
                              </button>
                            </>
                          )}

                          {/* ── Phase 5: needs_correction label with rejection note ── */}
                          {line.status === 'needs_correction' && (() => {
                            const rejEntry = [...(line.activityLog || [])].reverse().find(e => e.action === 'rejected');
                            return (
                              <div style={{
                                fontSize: 11,
                                background: 'rgba(220,38,38,0.07)',
                                border: '1px solid rgba(220,38,38,0.25)',
                                borderRadius: 4,
                                padding: '4px 8px',
                                color: '#dc2626',
                                maxWidth: 200,
                              }}>
                                <div style={{ fontWeight: 700, marginBottom: 2 }}>⚠ Needs Correction</div>
                                {rejEntry?.note && (
                                  <div style={{ color: '#7f1d1d' }}>Admin note: {rejEntry.note}</div>
                                )}
                                <div style={{ color: '#92400e', marginTop: 2 }}>Awaiting re-shipment from China</div>
                              </div>
                            );
                          })()}

                          {line.source === 'local' && line.status === 'needed' && (
                            <button
                              type="button"
                              className="btn-admin-secondary"
                              onClick={() => {
                                setProxyPrintLine(line);
                                setProxyPrintNote('');
                                setProxyPrintFile(null);
                                setProxyPrintError('');
                              }}
                              style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title="Mark document printed locally"
                            >
                              <Printer size={11} />
                              <span>Mark Printed</span>
                            </button>
                          )}

                          {/* ── Phase 5: Mark Arrived for local printed lines ── */}
                          {line.source === 'local' && line.status === 'printed' && (
                            <button
                              type="button"
                              className="btn-admin-secondary"
                              onClick={() => handleMarkArrived(line._id)}
                              disabled={arrivedBusyId === line._id}
                              style={{
                                padding: '4px 8px',
                                fontSize: 11,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                borderColor: '#7c3aed',
                                color: '#7c3aed',
                              }}
                              title="Mark document as arrived at office"
                            >
                              <MapPin size={11} />
                              <span>{arrivedBusyId === line._id ? 'Saving…' : 'Mark Arrived'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Document Line Modal */}
      {addModalOpen && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setAddModalOpen(false); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 500 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Add Document Line</h2>
              <button type="button" className="btn-admin-icon" onClick={() => setAddModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddLineSubmit}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    Document Type <span className="required">*</span>
                  </label>
                  <select
                    className="admin-select"
                    value={selectedAddDocId}
                    onChange={(e) => setSelectedAddDocId(e.target.value)}
                    required
                  >
                    <option value="">— Select Document —</option>
                    {catalogDocs.map((doc) => (
                      <option key={doc._id} value={doc._id}>
                        {doc.shortName} {doc.code ? `(${doc.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Translation Mode</label>
                  <select
                    className="admin-select"
                    value={selectedAddMode}
                    onChange={(e) => setSelectedAddMode(e.target.value)}
                  >
                    <option value="original_only">Original Only</option>
                    <option value="original_plus_translation">Original + Translation</option>
                    <option value="translation_only">Translation Only</option>
                  </select>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Fulfillment Source</label>
                  <select
                    className="admin-select"
                    value={selectedAddSource}
                    onChange={(e) => setSelectedAddSource(e.target.value)}
                  >
                    <option value="local">Local (Algeria)</option>
                    <option value="china">China</option>
                  </select>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="btn-admin-secondary" onClick={() => setAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-admin-primary" disabled={actionLoading || !selectedAddDocId}>
                  Add to Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Order Confirmation Modal */}
      {deleteModalOpen && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setDeleteModalOpen(false); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 440 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Delete Order Permanently</h2>
              <button type="button" className="btn-admin-icon" onClick={() => setDeleteModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', fontSize: 13.5, color: 'var(--admin-text-secondary)', lineHeight: 1.6 }}>
              Are you sure you want to permanently delete order <strong style={{ color: 'var(--admin-text-primary)' }}>{order.trackingCode}</strong>?
              <br /><br />
              <strong style={{ color: 'var(--admin-accent)' }}>Warning:</strong> This is a hard delete and will cascade to delete all {lines.length} document line(s) associated with this order. This action cannot be undone.
            </div>

            <div className="admin-modal-footer">
              <button type="button" className="btn-admin-secondary" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-admin-primary"
                onClick={handleDeleteOrder}
                disabled={actionLoading}
              >
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proxy Ship Document Modal (Admin Fallback) */}
      {proxyShipLine && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setProxyShipLine(null); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 480 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Ship Line on Behalf of China</h2>
              <button type="button" className="btn-admin-icon" onClick={() => setProxyShipLine(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleProxyShipSubmit}>
              <div className="admin-modal-body">
                <div style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginBottom: 16 }}>
                  Recording shipment for <strong>{proxyShipLine.documentTypeId?.fullName || 'Document'}</strong> (WhatsApp/WeChat Proxy Fallback).
                </div>

                {proxyShipError && (
                  <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={14} />
                    <span>{proxyShipError}</span>
                  </div>
                )}

                <div className="admin-form-group">
                  <label className="admin-form-label">
                    Courier Tracking Code <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="e.g. SF-EXPRESS-998877, DHL-123456"
                    value={proxyShipTrackingCode}
                    onChange={(e) => setProxyShipTrackingCode(e.target.value)}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">
                    Upload Waybill / Airway Scan (Optional, max 12MB)
                  </label>
                  <input
                    type="file"
                    className="admin-input"
                    onChange={(e) => setProxyShipFile(e.target.files?.[0] || null)}
                    style={{ padding: '6px' }}
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Internal Note (Optional)</label>
                  <textarea
                    className="admin-textarea"
                    rows={2}
                    placeholder="e.g. Tracking code confirmed via associate chat..."
                    value={proxyShipNote}
                    onChange={(e) => setProxyShipNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="btn-admin-secondary" onClick={() => setProxyShipLine(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-admin-primary" disabled={proxyShipBusy}>
                  {proxyShipBusy ? 'Saving…' : 'Record Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proxy Print Local Document Modal */}
      {proxyPrintLine && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setProxyPrintLine(null); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 480 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Mark Local Document Printed</h2>
              <button type="button" className="btn-admin-icon" onClick={() => setProxyPrintLine(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleProxyPrintSubmit}>
              <div className="admin-modal-body">
                <div style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginBottom: 16 }}>
                  Marking <strong>{proxyPrintLine.documentTypeId?.fullName || 'Document'}</strong> as printed and ready locally.
                </div>

                {proxyPrintError && (
                  <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={14} />
                    <span>{proxyPrintError}</span>
                  </div>
                )}

                <div className="admin-form-group">
                  <label className="admin-form-label">
                    Upload Scanned Print / Proof (Optional, max 12MB)
                  </label>
                  <input
                    type="file"
                    className="admin-input"
                    onChange={(e) => setProxyPrintFile(e.target.files?.[0] || null)}
                    style={{ padding: '6px' }}
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Office Note (Optional)</label>
                  <textarea
                    className="admin-textarea"
                    rows={2}
                    placeholder="e.g. Printed at main agency desk..."
                    value={proxyPrintNote}
                    onChange={(e) => setProxyPrintNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="btn-admin-secondary" onClick={() => setProxyPrintLine(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-admin-primary" disabled={proxyPrintBusy}>
                  {proxyPrintBusy ? 'Saving…' : 'Mark Printed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proxy Delay Toggle Modal */}
      {proxyDelayLine && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setProxyDelayLine(null); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 460 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {proxyDelayIsDelayed ? 'Flag Document Transit Delay' : 'Clear Transit Delay'}
              </h2>
              <button type="button" className="btn-admin-icon" onClick={() => setProxyDelayLine(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleProxyDelaySubmit}>
              <div className="admin-modal-body">
                <div style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginBottom: 16 }}>
                  {proxyDelayIsDelayed ? (
                    <span>
                      Flagging this line as <strong>Delayed</strong> will show an amber warning on the public tracking portal to notify the importer.
                    </span>
                  ) : (
                    <span>Clearing the delay flag indicates transit has normalized.</span>
                  )}
                </div>

                {proxyDelayError && (
                  <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={14} />
                    <span>{proxyDelayError}</span>
                  </div>
                )}

                <div className="admin-form-group">
                  <label className="admin-form-label">Delay Reason / Note (Optional)</label>
                  <textarea
                    className="admin-textarea"
                    rows={2}
                    placeholder="e.g. Customs inspection flight backlog in Dubai..."
                    value={proxyDelayNote}
                    onChange={(e) => setProxyDelayNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="btn-admin-secondary" onClick={() => setProxyDelayLine(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-admin-primary"
                  disabled={proxyDelayBusy}
                  style={{
                    backgroundColor: proxyDelayIsDelayed ? '#dc2626' : '#16a34a',
                    borderColor: proxyDelayIsDelayed ? '#dc2626' : '#16a34a',
                  }}
                >
                  {proxyDelayBusy ? 'Saving…' : proxyDelayIsDelayed ? 'Confirm Delay Flag' : 'Clear Delay Flag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach Document File Modal (Admin) */}
      {attachModalLine && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setAttachModalLine(null); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 480 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Attach Document to Line</h2>
              <button type="button" className="btn-admin-icon" onClick={() => setAttachModalLine(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAttachSubmit}>
              <div className="admin-modal-body">
                <div style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginBottom: 16 }}>
                  Attaching file to <strong>{attachModalLine.documentTypeId?.fullName || 'Document'}</strong> without changing the line status.
                </div>

                {attachError && (
                  <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={14} />
                    <span>{attachError}</span>
                  </div>
                )}

                <div className="admin-form-group">
                  <label className="admin-form-label">
                    Select File (Max 12MB) <span className="required">*</span>
                  </label>
                  <input
                    type="file"
                    className="admin-input"
                    onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                    style={{ padding: '6px' }}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Note / Description (Optional)</label>
                  <textarea
                    className="admin-textarea"
                    rows={2}
                    placeholder="e.g. Corrected scan, official stamped copy..."
                    value={attachNote}
                    onChange={(e) => setAttachNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="btn-admin-secondary" onClick={() => setAttachModalLine(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-admin-primary" disabled={attachBusy}>
                  {attachBusy ? 'Uploading…' : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Phase 5: Review Modal (Approve / Reject) ─────────────────────── */}
      {reviewLine && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setReviewLine(null); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 500 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {reviewDecision === 'approve' ? 'Approve Shipment' : 'Reject & Request Correction'}
              </h2>
              <button type="button" className="btn-admin-icon" onClick={() => setReviewLine(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit}>
              <div className="admin-modal-body">
                {/* Uploaded files — must be visible before making decision */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--admin-text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>
                    Uploaded Files ({(reviewLine.uploadedFiles || []).length})
                  </div>
                  {(!reviewLine.uploadedFiles || reviewLine.uploadedFiles.length === 0) ? (
                    <div className="admin-alert admin-alert-error" style={{ padding: '8px 12px' }}>
                      <AlertTriangle size={14} />
                      <span>No file has been uploaded for this line. Review carefully before approving.</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {reviewLine.uploadedFiles.map((f) => (
                        <div
                          key={f._id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: 'var(--admin-surface-2, #f8fafc)',
                            border: '1px solid var(--admin-border)',
                            borderRadius: 6,
                            padding: '6px 10px',
                            fontSize: 12,
                          }}
                        >
                          <FileText size={14} color="var(--admin-accent)" />
                          <span style={{ flex: 1, fontWeight: 600 }} title={f.filename}>{f.filename}</span>
                          <span style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                            {f.size ? `${Math.round(f.size / 1024)} KB` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(f._id, f.filename)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--admin-accent)', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}
                            title="Download / View"
                          >
                            <Download size={13} /> View
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Decision toggle */}
                <div className="admin-form-group">
                  <label className="admin-form-label">Decision <span className="required">*</span></label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setReviewDecision('approve')}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: 6,
                        border: `2px solid ${reviewDecision === 'approve' ? '#16a34a' : 'var(--admin-border)'}`,
                        background: reviewDecision === 'approve' ? 'rgba(22,163,74,0.08)' : 'transparent',
                        color: reviewDecision === 'approve' ? '#16a34a' : 'var(--admin-text-secondary)',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <ThumbsUp size={14} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewDecision('reject')}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: 6,
                        border: `2px solid ${reviewDecision === 'reject' ? '#dc2626' : 'var(--admin-border)'}`,
                        background: reviewDecision === 'reject' ? 'rgba(220,38,38,0.08)' : 'transparent',
                        color: reviewDecision === 'reject' ? '#dc2626' : 'var(--admin-text-secondary)',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <ThumbsDown size={14} /> Reject
                    </button>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">
                    {reviewDecision === 'reject' ? 'Rejection Note (Required — China associate will see this)' : 'Note (Optional)'}
                    {reviewDecision === 'reject' && <span className="required"> *</span>}
                  </label>
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    placeholder={reviewDecision === 'reject'
                      ? 'Explain exactly what needs to be corrected and re-shipped…'
                      : 'Optional approval note…'}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    required={reviewDecision === 'reject'}
                  />
                </div>

                {reviewError && (
                  <div className="admin-alert admin-alert-error" style={{ marginBottom: 4 }}>
                    <AlertTriangle size={14} />
                    <span>{reviewError}</span>
                  </div>
                )}
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="btn-admin-secondary" onClick={() => setReviewLine(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-admin-primary"
                  disabled={reviewBusy || (reviewDecision === 'reject' && !reviewNote.trim())}
                  style={{
                    backgroundColor: reviewDecision === 'approve' ? '#16a34a' : '#dc2626',
                    borderColor: reviewDecision === 'approve' ? '#16a34a' : '#dc2626',
                  }}
                >
                  {reviewBusy ? 'Saving…' : reviewDecision === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
