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
  User,
  Car,
  FileText,
  RotateCcw,
  X,
  Copy,
  Check,
  Paperclip,
  Download,
  Package,
  Truck,
  MapPin,
  Lock,
  UserX,
  Printer,
  Building2,
  Globe,
  Sparkles,
} from 'lucide-react';

const getStatusBadge = (status) => {
  switch (status) {
    case 'needed':
      return {
        label: 'Action Needed',
        icon: <Clock size={12} />,
        color: '#b45309',
        bg: '#fef3c7',
        border: '#fcd34d',
      };
    case 'attached':
      return {
        label: 'Attached — Review Ready',
        icon: <FileText size={12} />,
        color: '#1d4ed8',
        bg: '#dbeafe',
        border: '#bfdbfe',
      };
    case 'ready':
      return {
        label: 'Ready / Locked',
        icon: <CheckCircle2 size={12} />,
        color: '#15803d',
        bg: '#dcfce7',
        border: '#bbf7d0',
      };
    case 'packaged':
      return {
        label: 'Packaged',
        icon: <Package size={12} />,
        color: '#0e7490',
        bg: '#cffafe',
        border: '#a5f3fc',
      };
    case 'sent_to_client':
      return {
        label: 'Dispatched',
        icon: <Truck size={12} />,
        color: '#0369a1',
        bg: '#e0f2fe',
        border: '#bae6fd',
      };
    case 'delivered':
      return {
        label: 'Delivered',
        icon: <MapPin size={12} />,
        color: '#047857',
        bg: '#d1fae5',
        border: '#a7f3d0',
      };
    case 'completed':
      return {
        label: 'Completed',
        icon: <CheckCircle2 size={12} />,
        color: '#047857',
        bg: '#d1fae5',
        border: '#a7f3d0',
      };
    default:
      return {
        label: status ? status.replace(/_/g, ' ') : 'Unknown',
        icon: <Clock size={12} />,
        color: 'var(--admin-text-secondary)',
        bg: 'var(--admin-surface-2)',
        border: 'var(--admin-border)',
      };
  }
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Associates list (active users)
  const [associates, setAssociates] = useState([]);
  const [delegateModalLine, setDelegateModalLine] = useState(null);
  const [delegateBusy, setDelegateBusy] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // Lock modal (approve / reject attached line)
  const [lockLine, setLockLine] = useState(null);
  const [lockApprove, setLockApprove] = useState(true);
  const [lockNote, setLockNote] = useState('');
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState('');

  // Admin attach modal
  const [adminAttachLine, setAdminAttachLine] = useState(null);
  const [adminAttachFile, setAdminAttachFile] = useState(null);
  const [adminAttachTracking, setAdminAttachTracking] = useState('');
  const [adminAttachNote, setAdminAttachNote] = useState('');
  const [adminAttachBusy, setAdminAttachBusy] = useState(false);
  const [adminAttachError, setAdminAttachError] = useState('');

  // Revoke Assignment Modal
  const [revokeLine, setRevokeLine] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeError, setRevokeError] = useState('');

  // Order-level fulfillment busy
  const [fulfillmentBusy, setFulfillmentBusy] = useState(false);

  const [copiedTracking, setCopiedTracking] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'action_needed' | 'ready'

  // Add line modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [catalogDocs, setCatalogDocs] = useState([]);
  const [selectedAddDocId, setSelectedAddDocId] = useState('');
  const [selectedAddMode, setSelectedAddMode] = useState('original_only');

  // Delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Reject correction modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectError, setRejectError] = useState('');

  const loadOrderDetail = async () => {
    setLoading(true);
    const { ok, data } = await apiFetch(`/orders/${id}`);
    if (ok && data) {
      setOrder(data);
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

  const loadAssociates = async () => {
    const { ok, data } = await apiFetch('/users?active=true');
    if (ok && Array.isArray(data)) {
      setAssociates(data.filter((u) => u.role === 'china_associate' || u.role === 'admin'));
    }
  };

  useEffect(() => {
    loadOrderDetail();
    loadCatalog();
    loadAssociates();
  }, [id]);

  const handleDelegation = async (lineId, targetMode, targetAssociateId = null) => {
    try {
      setDelegateBusy(true);
      const payload = {
        delegationMode: targetMode,
        associateId: targetMode === 'specific' ? targetAssociateId : null,
      };
      const res = await apiFetch(`/orders/${id}/lines/${lineId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(res.data?.error || 'Failed to update document routing.');
      }
      setSuccessToast(
        targetMode === 'none'
          ? 'Moved document to Local Station (Algiers).'
          : targetMode === 'open'
          ? 'Delegated document to China Open Claim Pool.'
          : 'Delegated document to China associate.'
      );
      setTimeout(() => setSuccessToast(''), 4000);
      setDelegateModalLine(null);
      await loadOrderDetail();
    } catch (err) {
      alert(err.message || 'Error updating document routing');
    } finally {
      setDelegateBusy(false);
    }
  };

  const handleRevokeSubmit = async (e) => {
    e.preventDefault();
    if (!revokeReason.trim()) {
      setRevokeError('A reason is required to revoke assignment.');
      return;
    }
    setRevokeBusy(true);
    setRevokeError('');
    try {
      const { ok, data } = await apiFetch(`/order-lines/${revokeLine._id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: revokeReason.trim() }),
      });
      if (!ok) throw new Error(data?.error || 'Failed to revoke line assignment.');
      setRevokeLine(null);
      setRevokeReason('');
      await loadOrderDetail();
    } catch (err) {
      setRevokeError(err.message);
    } finally {
      setRevokeBusy(false);
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
    setActionLoading(true);
    const lineUpdates = (order?.lines || []).map((l) => ({
      lineId: l._id,
      delegationMode: l.delegationMode || (l.assignedAssociateId ? 'specific' : 'none'),
      associateId: l.assignedAssociateId?._id || l.assignedAssociateId || null,
    }));

    const res = await apiFetch(`/orders/${id}/confirm`, {
      method: 'PATCH',
      body: JSON.stringify({ lineUpdates }),
    });
    setActionLoading(false);
    if (res.ok) {
      setSuccessToast('Order confirmed successfully!');
      setTimeout(() => setSuccessToast(''), 4000);
      loadOrderDetail();
    } else {
      alert(res.data?.error || 'Failed to confirm order.');
    }
  };

  const handleLockSubmit = async (e) => {
    e.preventDefault();
    if (!lockApprove && !lockNote.trim()) {
      setLockError('A note is required when rejecting.');
      return;
    }
    setLockBusy(true);
    setLockError('');
    try {
      const { ok, data } = await apiFetch(`/order-lines/${lockLine._id}/lock`, {
        method: 'POST',
        body: JSON.stringify({ approve: lockApprove, note: lockNote.trim() }),
      });
      if (!ok) throw new Error(data?.error || 'Failed to lock line.');
      setLockLine(null);
      setLockNote('');
      await loadOrderDetail();
    } catch (err) {
      setLockError(err.message);
    } finally {
      setLockBusy(false);
    }
  };

  const handleAdminAttachSubmit = async (e) => {
    e.preventDefault();
    if (!adminAttachFile) {
      setAdminAttachError('Please select a file.');
      return;
    }
    setAdminAttachBusy(true);
    setAdminAttachError('');
    try {
      const formData = new FormData();
      formData.append('file', adminAttachFile);
      if (adminAttachTracking.trim()) formData.append('trackingCode', adminAttachTracking.trim());
      if (adminAttachNote.trim()) formData.append('note', adminAttachNote.trim());

      const token = localStorage.getItem('autopartdz_token');
      const res = await fetch(`/api/order-lines/${adminAttachLine._id}/attach`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to attach document.');

      setAdminAttachLine(null);
      setAdminAttachFile(null);
      setAdminAttachTracking('');
      setAdminAttachNote('');
      await loadOrderDetail();
    } catch (err) {
      setAdminAttachError(err.message);
    } finally {
      setAdminAttachBusy(false);
    }
  };

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

  const handleRejectOrder = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setRejectError('A reason is required to reject this order.');
      return;
    }
    setRejectBusy(true);
    setRejectError('');
    try {
      const { ok, data } = await apiFetch(`/orders/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!ok) throw new Error(data?.error || 'Failed to reject correction order.');
      setRejectModalOpen(false);
      setRejectReason('');
      await loadOrderDetail();
    } catch (err) {
      setRejectError(err.message);
    } finally {
      setRejectBusy(false);
    }
  };

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

  const handleOpenFile = async (fileId) => {
    try {
      const token = localStorage.getItem('autopartdz_token');
      const res = await fetch(`/api/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to retrieve file.');
      const blob = await res.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      window.open(fileUrl, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(fileUrl), 60000);
    } catch (err) {
      alert(err.message || 'Error opening file');
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
  const chinaAssociates = associates.filter((u) => u.role === 'china_associate');

  const statusPriority = {
    needed: 1,
    attached: 2,
    ready: 3,
    packaged: 4,
    sent_to_client: 5,
    delivered: 6,
    completed: 7,
  };

  const sortedLines = [...lines].sort((a, b) => {
    const pa = statusPriority[a.status] || 99;
    const pb = statusPriority[b.status] || 99;
    return pa - pb;
  });

  const displayedLines = sortedLines.filter((l) => {
    if (filterTab === 'action_needed') {
      return ['needed', 'attached'].includes(l.status);
    }
    if (filterTab === 'ready') {
      return !['needed', 'attached'].includes(l.status);
    }
    return true;
  });

  const isChina = (l) =>
    l.delegationMode === 'open' ||
    l.delegationMode === 'specific' ||
    Boolean(l.assignedAssociateId);

  const localLines = displayedLines.filter((l) => !isChina(l));
  const chinaLines = displayedLines.filter((l) => isChina(l));

  const actionNeededCount = lines.filter((l) => ['needed', 'attached'].includes(l.status)).length;
  const readyCount = lines.filter((l) => !['needed', 'attached'].includes(l.status)).length;

  const isExcluded = (line, uId) =>
    (line.excludedAssociateIds || []).some((ex) => (ex._id || ex).toString() === uId.toString());

  // Streamlined Document Card (Clean, calm, un-overwhelming)
  const renderDocCard = (line, isChinaGroup) => {
    const statusCfg = getStatusBadge(line.status);
    const rejectionNote =
      line.lastRejectionNote ||
      [...(line.activityLog || [])].reverse().find((e) => e.action === 'rejected')?.note;

    return (
      <div
        key={line._id}
        style={{
          backgroundColor: 'var(--admin-surface, #ffffff)',
          border: '1px solid var(--admin-border, #e2e8f0)',
          borderRadius: 8,
          padding: '12px 14px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          transition: 'all 0.15s ease',
        }}
      >
        {/* Card Header: Doc Name, Category, Badges */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--admin-text-primary)' }}>
                {line.documentTypeId?.fullName || line.documentTypeId?.shortName || 'Document'}
              </span>
              {line.documentTypeId?.code && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontFamily: 'monospace',
                    padding: '1px 5px',
                    borderRadius: 4,
                    backgroundColor: 'var(--admin-surface-2, #f1f5f9)',
                    color: 'var(--admin-text-muted)',
                  }}
                >
                  {line.documentTypeId.code}
                </span>
              )}
            </div>
            {line.documentTypeId?.category && (
              <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 2 }}>
                {line.documentTypeId.category}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 12,
                backgroundColor: statusCfg.bg,
                color: statusCfg.color,
                border: `1px solid ${statusCfg.border}`,
              }}
            >
              {statusCfg.icon}
              <span>{statusCfg.label}</span>
            </span>

            {isPending && (
              <button
                type="button"
                className="btn-admin-icon danger"
                title="Remove document line"
                onClick={() => handleRemoveLine(line._id)}
                disabled={actionLoading || lines.length <= 1}
                style={{ padding: 3 }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* China Delegation Status (Compact & Clean) */}
        {isChinaGroup && (
          <div
            style={{
              marginTop: 8,
              padding: '5px 8px',
              borderRadius: 6,
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 11.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {line.delegationMode === 'open' && !line.assignedAssociateId ? (
                <span style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={12} color="#059669" />
                  <span>Open Claim Pool (Unclaimed)</span>
                </span>
              ) : line.assignedAssociateId ? (
                <span style={{ color: '#1d4ed8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <User size={12} />
                  <span>{line.assignedAssociateId.name || 'Associate'}</span>
                  {line.acknowledgedAt ? (
                    <span style={{ color: '#16a34a', fontWeight: 500, fontSize: 11 }}>• Confirmed ✓</span>
                  ) : (
                    <span style={{ color: '#d97706', fontWeight: 500, fontSize: 11 }}>• Awaiting Ack</span>
                  )}
                </span>
              ) : null}
            </div>

            {line.assignedAssociateId && (
              <button
                type="button"
                onClick={() => {
                  setRevokeLine(line);
                  setRevokeReason('');
                  setRevokeError('');
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#dc2626',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '1px 4px',
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
                title="Revoke associate assignment and reopen to pool"
              >
                <UserX size={11} />
                <span>Revoke</span>
              </button>
            )}
          </div>
        )}

        {/* Audit Note (if revoked) */}
        {line.revokedAt && (
          <div
            style={{
              marginTop: 6,
              padding: '3px 8px',
              borderRadius: 4,
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              fontSize: 11,
              color: '#991b1b',
            }}
          >
            Reopened by {line.revokedBy?.name || 'Admin'} ("{line.revocationReason}")
          </div>
        )}

        {/* Revision / Rejection Note */}
        {line.status === 'needed' && rejectionNote && (
          <div
            style={{
              marginTop: 6,
              padding: '5px 8px',
              borderRadius: 5,
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              fontSize: 11.5,
              color: '#991b1b',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlertTriangle size={13} color="#dc2626" style={{ flexShrink: 0 }} />
            <div>
              <strong>Note:</strong> {rejectionNote}
            </div>
          </div>
        )}

        {/* Attached Files (Compact Chips) */}
        {line.uploadedFiles && line.uploadedFiles.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {line.uploadedFiles.map((f) => (
              <div
                key={f._id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 8px',
                  backgroundColor: 'var(--admin-surface-2, #f8fafc)',
                  border: '1px solid var(--admin-border, #e2e8f0)',
                  borderRadius: 4,
                  fontSize: 11.5,
                }}
              >
                <FileText size={12} color="#0284c7" />
                <span
                  style={{
                    maxWidth: 160,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                    color: 'var(--admin-text-primary)',
                  }}
                >
                  {f.filename}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>
                  ({Math.round((f.size || 0) / 1024)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenFile(f._id)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '1px 3px', color: '#0284c7' }}
                  title="Print or view"
                >
                  <Printer size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadFile(f._id, f.filename)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '1px 3px', color: '#64748b' }}
                  title="Download file"
                >
                  <Download size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Card Footer: Routing Dropdown & Action Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px solid var(--admin-border-subtle, #f1f5f9)',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!isChinaGroup ? (
              <button
                type="button"
                onClick={() => setDelegateModalLine(line)}
                disabled={delegateBusy}
                style={{
                  padding: '4px 10px',
                  borderRadius: 5,
                  border: '1px solid #fed7aa',
                  backgroundColor: '#fff7ed',
                  color: '#c2410c',
                  fontSize: 11.5,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: delegateBusy ? 'not-allowed' : 'pointer',
                }}
                title="Delegate to China (Open Pool or Associate)"
              >
                <Globe size={12} color="#ea580c" />
                <span>Delegate to China 🇨🇳 →</span>
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => handleDelegation(line._id, 'none')}
                  disabled={delegateBusy}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 5,
                    border: '1px solid #bae6fd',
                    backgroundColor: '#f0f9ff',
                    color: '#0369a1',
                    fontSize: 11.5,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: delegateBusy ? 'not-allowed' : 'pointer',
                  }}
                  title="Move document back to Local Station (Algiers)"
                >
                  <Building2 size={12} color="#0284c7" />
                  <span>← Move to Local 🇩🇿</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDelegateModalLine(line)}
                  disabled={delegateBusy}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 5,
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    fontSize: 11,
                    cursor: delegateBusy ? 'not-allowed' : 'pointer',
                  }}
                  title="Change China associate assignment or reopen to pool"
                >
                  Reassign
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {line.status === 'needed' && (
              <button
                type="button"
                className="btn-admin-primary"
                onClick={() => {
                  setAdminAttachLine(line);
                  setAdminAttachFile(null);
                  setAdminAttachTracking(line.trackingCode || '');
                  setAdminAttachNote('');
                  setAdminAttachError('');
                }}
                style={{ padding: '4px 12px', fontSize: 11.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <Paperclip size={13} />
                <span>Attach</span>
              </button>
            )}

            {line.status === 'attached' && (
              <button
                type="button"
                className="btn-admin-primary"
                onClick={() => {
                  setLockLine(line);
                  setLockApprove(true);
                  setLockNote('');
                  setLockError('');
                }}
                style={{
                  padding: '4px 12px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  backgroundColor: '#16a34a',
                  borderColor: '#16a34a',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Lock size={13} />
                <span>Review & Lock</span>
              </button>
            )}

            {['ready', 'packaged', 'sent_to_client', 'delivered', 'completed'].includes(line.status) && (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} />
                <span>Locked</span>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const clientDisplayName =
    `${order?.firstName || ''} ${order?.lastName || ''}`.trim() || order?.clientName || 'Client';

  return (
    <div>

      {/* ── Top Header & Global Actions ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/admin/orders" className="btn-admin-secondary" style={{ padding: '6px 10px' }}>
            <ArrowLeft size={14} />
            <span>Queue</span>
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>Order</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--admin-accent)' }}>{order.trackingCode}</span>
            {order.trackingCode && (
              <button
                type="button"
                onClick={() => handleCopyTracking(order.trackingCode)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '1px 3px', color: copiedTracking ? '#16a34a' : 'var(--admin-text-muted)' }}
                title="Copy tracking code"
              >
                {copiedTracking ? <Check size={13} /> : <Copy size={13} />}
              </button>
            )}
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
              disabled={actionLoading}
              title="Confirm Order"
            >
              <CheckCircle2 size={15} />
              <span>Confirm Order</span>
            </button>
          )}

          {isPending && (order.isCorrection || order.orderType === 'correction') && (
            <button
              type="button"
              className="btn-admin-secondary"
              onClick={() => {
                setRejectReason('');
                setRejectError('');
                setRejectModalOpen(true);
              }}
              disabled={actionLoading}
              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              title="Reject Correction Order (Terminal)"
            >
              <X size={15} />
              <span>Reject Claim</span>
            </button>
          )}

          {!isPending && order.status === 'ready_for_dispatch' && (
            <button
              type="button"
              className="btn-admin-primary"
              onClick={() => handleFulfillment('package')}
              disabled={fulfillmentBusy}
              style={{ backgroundColor: '#0e7490', borderColor: '#0e7490' }}
            >
              <Package size={15} />
              <span>Mark as Packaged</span>
            </button>
          )}

          {!isPending && order.status === 'packaged' && (
            <button
              type="button"
              className="btn-admin-primary"
              onClick={() => handleFulfillment('dispatch')}
              disabled={fulfillmentBusy}
              style={{ backgroundColor: '#0369a1', borderColor: '#0369a1' }}
            >
              <Truck size={15} />
              <span>Dispatch / Send to Client</span>
            </button>
          )}

          {!isPending && order.status === 'sent_to_client' && (
            <button
              type="button"
              className="btn-admin-primary"
              onClick={() => handleFulfillment('deliver')}
              disabled={fulfillmentBusy}
              style={{ backgroundColor: '#047857', borderColor: '#047857' }}
            >
              <MapPin size={15} />
              <span>Mark as Delivered</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: 12.5,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={15} color="#059669" />
          <span>{successToast}</span>
        </div>
      )}

      {/* ── Compact Order Dossier Summary Ribbon ────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          backgroundColor: 'var(--admin-surface, #ffffff)',
          borderRadius: 8,
          border: '1px solid var(--admin-border, #e2e8f0)',
          marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={14} color="#0284c7" />
            <span style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>
              {clientDisplayName}
            </span>
            {order.phone && <span style={{ color: 'var(--admin-text-muted)' }}>({order.phone})</span>}
          </div>

          {order.passportNumber && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--admin-text-secondary)' }}>
              <span>Passport:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                {order.passportNumber}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Car size={14} color="#0284c7" />
            <span style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
              {order.carBrand} {order.carModel}
            </span>
            {order.vin && (
              <span style={{ fontFamily: 'monospace', color: '#0284c7', fontSize: 11.5 }}>
                VIN: {order.vin}
              </span>
            )}
          </div>

          {(order.address || order.wilaya) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--admin-text-muted)', fontSize: 12 }}>
              <MapPin size={13} />
              <span>{order.address ? `${order.address}, ` : ''}{order.wilaya}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--admin-text-muted)' }}>
            Total Documents: <strong>{lines.length}</strong>
          </span>
        </div>
      </div>

      {/* ── Filter Tabs & Add Line Toolbar ──────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 4, backgroundColor: 'var(--admin-surface-2, #f1f5f9)', padding: 3, borderRadius: 6 }}>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: filterTab === 'all' ? 700 : 500,
              border: 'none',
              borderRadius: 4,
              backgroundColor: filterTab === 'all' ? '#ffffff' : 'transparent',
              color: filterTab === 'all' ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              boxShadow: filterTab === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            All Documents ({lines.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('action_needed')}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: filterTab === 'action_needed' ? 700 : 500,
              border: 'none',
              borderRadius: 4,
              backgroundColor: filterTab === 'action_needed' ? '#ffffff' : 'transparent',
              color: filterTab === 'action_needed' ? '#b45309' : '#64748b',
              cursor: 'pointer',
              boxShadow: filterTab === 'action_needed' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            Action Needed ({actionNeededCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('ready')}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: filterTab === 'ready' ? 700 : 500,
              border: 'none',
              borderRadius: 4,
              backgroundColor: filterTab === 'ready' ? '#ffffff' : 'transparent',
              color: filterTab === 'ready' ? '#15803d' : '#64748b',
              cursor: 'pointer',
              boxShadow: filterTab === 'ready' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            Ready / Locked ({readyCount})
          </button>
        </div>

        {isPending && (
          <button
            type="button"
            className="btn-admin-secondary"
            onClick={() => setAddModalOpen(true)}
            style={{ padding: '5px 12px', fontSize: 12 }}
          >
            <Plus size={13} />
            <span>Add Document Line</span>
          </button>
        )}
      </div>

      {/* ── Clean Split Workstation: Local Station (Left) & China Operations (Right) ─ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, alignItems: 'start', marginBottom: 24 }}>
        {/* Station A: Local Headquarters */}
        <div
          style={{
            backgroundColor: 'var(--admin-surface, #ffffff)',
            borderRadius: 10,
            border: '1px solid var(--admin-border, #e2e8f0)',
            padding: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '2px solid #0284c7', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={16} color="#0284c7" />
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
                🇩🇿 Local Station (Algiers)
              </h3>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, backgroundColor: '#e0f2fe', color: '#0284c7' }}>
                {localLines.length}
              </span>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--admin-text-muted)' }}>Self-Managed</span>
          </div>

          {localLines.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12, backgroundColor: 'var(--admin-surface-2, #f8fafc)', borderRadius: 6, border: '1px dashed #e2e8f0' }}>
              No documents assigned for local handling.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {localLines.map((l) => renderDocCard(l, false))}
            </div>
          )}
        </div>

        {/* Station B: China Operations */}
        <div
          style={{
            backgroundColor: 'var(--admin-surface, #ffffff)',
            borderRadius: 10,
            border: '1px solid var(--admin-border, #e2e8f0)',
            padding: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '2px solid #ea580c', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={16} color="#ea580c" />
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#c2410c' }}>
                🇨🇳 China Delegation Station
              </h3>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, backgroundColor: '#ffedd5', color: '#ea580c' }}>
                {chinaLines.length}
              </span>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--admin-text-muted)' }}>Overseas Sourcing</span>
          </div>

          {chinaLines.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12, backgroundColor: '#fff7ed', borderRadius: 6, border: '1px dashed #fed7aa' }}>
              No documents currently delegated to China.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chinaLines.map((l) => renderDocCard(l, true))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals: Add Line, Delete, Attach, Lock, Reject, Revoke ───────────── */}
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
                    onChange={(e) => {
                      const docId = e.target.value;
                      setSelectedAddDocId(docId);
                      setSelectedAddMode('original_only');
                    }}
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

      {deleteModalOpen && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setDeleteModalOpen(false); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 440 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Delete Order Permanently</h2>
              <button type="button" className="btn-admin-icon" onClick={() => setDeleteModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '20px', fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
              Are you sure you want to permanently delete order <strong>{order.trackingCode}</strong>? This action cannot be undone.
            </div>
            <div className="admin-modal-footer">
              <button type="button" className="btn-admin-secondary" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-admin-primary" onClick={handleDeleteOrder} disabled={actionLoading} style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}>
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}

      {adminAttachLine && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setAdminAttachLine(null); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 500 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Attach Document Directly</h2>
              <button type="button" className="btn-admin-icon" onClick={() => setAdminAttachLine(null)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAdminAttachSubmit}>
              <div className="admin-modal-body">
                {adminAttachError && (
                  <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={14} />
                    <span>{adminAttachError}</span>
                  </div>
                )}
                <div className="admin-form-group">
                  <label className="admin-form-label">Select File (Max 12MB) <span className="required">*</span></label>
                  <input type="file" className="admin-input" onChange={(e) => setAdminAttachFile(e.target.files?.[0] || null)} required />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Waybill / Tracking Code (Optional)</label>
                  <input type="text" className="admin-input" placeholder="e.g. DHL-123" value={adminAttachTracking} onChange={(e) => setAdminAttachTracking(e.target.value)} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Note (Optional)</label>
                  <textarea className="admin-textarea" rows={2} value={adminAttachNote} onChange={(e) => setAdminAttachNote(e.target.value)} />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-admin-secondary" onClick={() => setAdminAttachLine(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-admin-primary" disabled={adminAttachBusy || !adminAttachFile}>
                  {adminAttachBusy ? 'Uploading…' : 'Attach Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {revokeLine && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setRevokeLine(null); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 480 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626' }}>
                <UserX size={17} />
                <span>Revoke Assignment & Reopen Pool</span>
              </h2>
              <button type="button" className="btn-admin-icon" onClick={() => setRevokeLine(null)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRevokeSubmit}>
              <div className="admin-modal-body">
                <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
                  Revoking from <strong>{revokeLine.assignedAssociateId?.name || 'Associate'}</strong> will permanently exclude them from re-claiming this line, and immediately return it to the <strong>Open Claim Pool</strong> for other associates.
                </p>
                <div className="admin-form-group">
                  <label className="admin-form-label">Revocation Reason <span className="required">*</span></label>
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    placeholder="e.g. Unresponsive, reassignment requested..."
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    required
                  />
                </div>
                {revokeError && (
                  <div className="admin-alert admin-alert-error" style={{ marginBottom: 10 }}>
                    <AlertTriangle size={14} />
                    <span>{revokeError}</span>
                  </div>
                )}
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-admin-secondary" onClick={() => setRevokeLine(null)} disabled={revokeBusy}>
                  Cancel
                </button>
                <button type="submit" className="btn-admin-primary" disabled={revokeBusy || !revokeReason.trim()} style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}>
                  {revokeBusy ? 'Revoking…' : 'Revoke & Reopen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lockLine && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setLockLine(null); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 500 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {lockApprove ? 'Approve & Lock Document' : 'Reject Document & Request Revision'}
              </h2>
              <button type="button" className="btn-admin-icon" onClick={() => setLockLine(null)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleLockSubmit}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label className="admin-form-label">Decision <span className="required">*</span></label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setLockApprove(true)}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: 6,
                        border: `2px solid ${lockApprove ? '#16a34a' : 'var(--admin-border)'}`,
                        background: lockApprove ? 'rgba(22,163,74,0.08)' : 'transparent',
                        color: lockApprove ? '#16a34a' : 'var(--admin-text-secondary)',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      ✓ Approve & Lock
                    </button>
                    <button
                      type="button"
                      onClick={() => setLockApprove(false)}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: 6,
                        border: `2px solid ${!lockApprove ? '#dc2626' : 'var(--admin-border)'}`,
                        background: !lockApprove ? 'rgba(220,38,38,0.08)' : 'transparent',
                        color: !lockApprove ? '#dc2626' : 'var(--admin-text-secondary)',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      ✕ Reject & Request Revision
                    </button>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">
                    {!lockApprove ? 'Rejection Reason (Required — shown to associate)' : 'Note (Optional)'}
                    {!lockApprove && <span className="required"> *</span>}
                  </label>
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    placeholder={!lockApprove ? 'Explain what needs correction…' : 'Optional note…'}
                    value={lockNote}
                    onChange={(e) => setLockNote(e.target.value)}
                    required={!lockApprove}
                  />
                </div>
                {lockError && (
                  <div className="admin-alert admin-alert-error" style={{ marginBottom: 4 }}>
                    <AlertTriangle size={14} />
                    <span>{lockError}</span>
                  </div>
                )}
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-admin-secondary" onClick={() => setLockLine(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-admin-primary"
                  disabled={lockBusy || (!lockApprove && !lockNote.trim())}
                  style={{
                    backgroundColor: lockApprove ? '#16a34a' : '#dc2626',
                    borderColor: lockApprove ? '#16a34a' : '#dc2626',
                  }}
                >
                  {lockBusy ? 'Saving…' : lockApprove ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rejectModalOpen && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setRejectModalOpen(false); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 480 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title" style={{ color: '#dc2626' }}>Reject Correction Claim</h2>
              <button type="button" className="btn-admin-icon" onClick={() => setRejectModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRejectOrder}>
              <div className="admin-modal-body">
                <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
                  Rejecting this claim is terminal. The order will be marked as rejected.
                </p>
                <div className="admin-form-group">
                  <label className="admin-form-label">Rejection Reason <span className="required">*</span></label>
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    required
                  />
                </div>
                {rejectError && (
                  <div className="admin-alert admin-alert-error" style={{ marginTop: 8 }}>
                    <AlertTriangle size={14} />
                    <span>{rejectError}</span>
                  </div>
                )}
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-admin-secondary" onClick={() => setRejectModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-admin-primary" disabled={rejectBusy || !rejectReason.trim()} style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}>
                  {rejectBusy ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delegate to China Modal ─────────────────────────────────────── */}
      {delegateModalLine && (
        <div
          className="admin-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !delegateBusy) setDelegateModalLine(null);
          }}
        >
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 520 }}>
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🇨🇳 Delegate to China Operations</span>
                </h2>
                <div style={{ fontSize: 12, color: 'var(--admin-text-secondary)', marginTop: 2 }}>
                  {delegateModalLine.documentTypeId?.fullName || 'Customs Document'}
                  {delegateModalLine.documentTypeId?.code ? ` (${delegateModalLine.documentTypeId.code})` : ''}
                </div>
              </div>
              <button
                type="button"
                className="btn-admin-icon"
                onClick={() => setDelegateModalLine(null)}
                disabled={delegateBusy}
              >
                <X size={16} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Option A: Open Pool */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 8,
                  border: '1.5px solid #a7f3d0',
                  backgroundColor: '#f0fdf4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#065f46', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} color="#059669" />
                    <span>⚡ Post to Open Claim Pool (Recommended)</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#047857', marginTop: 3 }}>
                    Available to all active China associates. The first associate who claims it takes responsibility.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelegation(delegateModalLine._id, 'open')}
                  disabled={delegateBusy}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: delegateBusy ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {delegateBusy ? 'Posting…' : 'Post to Pool'}
                </button>
              </div>

              {/* Option B: Direct Assignment to an Associate */}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--admin-text-primary)', marginBottom: 8 }}>
                  Or Assign Directly to an Associate:
                </div>

                {chinaAssociates.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', padding: '10px 12px', border: '1px dashed #e2e8f0', borderRadius: 6 }}>
                    No active China associates registered in the system.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {chinaAssociates.map((u) => {
                      const excluded = isExcluded(delegateModalLine, u._id);
                      const isCurrent =
                        delegateModalLine.assignedAssociateId?._id === u._id ||
                        delegateModalLine.assignedAssociateId === u._id;
                      return (
                        <div
                          key={u._id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                            backgroundColor: isCurrent ? '#eff6ff' : '#ffffff',
                          }}
                        >
                          <div>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>
                              🇨🇳 {u.name}
                            </span>
                            {u.email && (
                              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>
                                ({u.email})
                              </span>
                            )}
                            {excluded && (
                              <span style={{ fontSize: 10.5, color: '#dc2626', marginLeft: 6, fontWeight: 600 }}>
                                (Previously Revoked)
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDelegation(delegateModalLine._id, 'specific', u._id)}
                            disabled={delegateBusy || excluded || isCurrent}
                            style={{
                              padding: '4px 12px',
                              borderRadius: 5,
                              border: isCurrent ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                              backgroundColor: isCurrent ? '#dbeafe' : '#ffffff',
                              color: isCurrent ? '#1d4ed8' : '#334155',
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: delegateBusy || excluded || isCurrent ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {isCurrent ? 'Assigned' : 'Assign'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-admin-secondary"
                onClick={() => setDelegateModalLine(null)}
                disabled={delegateBusy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
