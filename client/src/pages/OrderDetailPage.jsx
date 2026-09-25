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
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Printer,
  Send,
  Building2,
  Globe,
  Sparkles,
  Ban,
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

  // Associates list (all active users)
  const [associates, setAssociates] = useState([]);

  // Line delegations: map of lineId -> { delegationMode: 'none' | 'open' | 'specific', associateId: string | null }
  const [lineDelegations, setLineDelegations] = useState({});

  // Lock modal (approve / reject attached line)
  const [lockLine, setLockLine] = useState(null);
  const [lockApprove, setLockApprove] = useState(true);
  const [lockNote, setLockNote] = useState('');
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState('');

  // Admin attach modal (attach document to line directly)
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
      // Initialize delegations from line data
      const delegations = {};
      (data.lines || []).forEach((l) => {
        const aId = l.assignedAssociateId?._id || l.assignedAssociateId || '';
        const mode = l.delegationMode || (aId ? 'specific' : 'none');
        delegations[l._id] = {
          delegationMode: mode,
          associateId: aId ? aId.toString() : null,
        };
      });
      setLineDelegations(delegations);
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

  const handleDelegationChange = async (lineId, targetMode, targetAssociateId = null) => {
    setLineDelegations((prev) => ({
      ...prev,
      [lineId]: { delegationMode: targetMode, associateId: targetAssociateId },
    }));

    // If order is already confirmed / active, persist immediately via assign endpoint
    if (order && order.status !== 'pending') {
      const payload = {
        delegationMode: targetMode,
        associateId: targetMode === 'specific' ? targetAssociateId : null,
      };
      const res = await apiFetch(`/orders/${id}/lines/${lineId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await loadOrderDetail();
      } else {
        alert(res.data?.error || 'Failed to update line delegation.');
        await loadOrderDetail();
      }
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
    const lineUpdates = (order?.lines || []).map((l) => {
      const del = lineDelegations[l._id] || {
        delegationMode: l.delegationMode || (l.assignedAssociateId ? 'specific' : 'none'),
        associateId: l.assignedAssociateId?._id || l.assignedAssociateId || null,
      };
      return {
        lineId: l._id,
        delegationMode: del.delegationMode,
        associateId: del.associateId,
      };
    });

    const res = await apiFetch(`/orders/${id}/confirm`, {
      method: 'PATCH',
      body: JSON.stringify({ lineUpdates }),
    });
    setActionLoading(false);
    if (res.ok) loadOrderDetail();
    else alert(res.data?.error || 'Failed to confirm order.');
  };

  // ── Lock submit (admin: approve or reject an attached line) ──────────────
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

  // ── Admin attach submit (attach file to a line, triggers needed→attached) ─
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

  // ── Reject correction claim (terminal action) ─────────────────────────────
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

  // Open file in new tab for direct viewing and native printing
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

  // Group lines into:
  // 1) "Handling Locally" — delegationMode === 'none' and no associate
  // 2) "Delegated to China" — delegationMode === 'specific' or 'open'
  const localLines = displayedLines.filter((l) => {
    const del = lineDelegations[l._id];
    const mode = del ? del.delegationMode : (l.delegationMode || 'none');
    return mode === 'none' && !l.assignedAssociateId;
  });

  const chinaLines = displayedLines.filter((l) => {
    const del = lineDelegations[l._id];
    const mode = del ? del.delegationMode : (l.delegationMode || 'none');
    return mode === 'specific' || mode === 'open' || Boolean(l.assignedAssociateId);
  });

  const actionNeededCount = lines.filter((l) => ['needed', 'attached'].includes(l.status)).length;
  const readyCount = lines.filter((l) => !['needed', 'attached'].includes(l.status)).length;

  // Render a document card
  const renderDocumentCard = (line, isChinaGroup) => {
    const currentDel = lineDelegations[line._id] || {
      delegationMode: line.delegationMode || (line.assignedAssociateId ? 'specific' : 'none'),
      associateId: line.assignedAssociateId?._id || line.assignedAssociateId || null,
    };
    const currentSelectValue =
      currentDel.delegationMode === 'open'
        ? 'open'
        : currentDel.delegationMode === 'specific' && currentDel.associateId
        ? `specific:${currentDel.associateId}`
        : 'none';

    const statusCfg = getStatusBadge(line.status);
    const rejectionNote =
      line.lastRejectionNote ||
      [...(line.activityLog || [])].reverse().find((e) => e.action === 'rejected')?.note;

    const isExcluded = (uId) =>
      (line.excludedAssociateIds || []).some((ex) => (ex._id || ex).toString() === uId.toString());

    return (
      <div
        key={line._id}
        style={{
          backgroundColor: 'var(--admin-surface)',
          border: '1px solid var(--admin-border)',
          borderLeft: `4px solid ${
            line.status === 'needed' ? '#f59e0b' : line.status === 'attached' ? '#2563eb' : '#16a34a'
          }`,
          borderRadius: 8,
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          transition: 'border-color 0.15s ease',
        }}
      >
        {/* Card Header: Document Name, Badges, Status, and Delete Action */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--admin-text-primary)' }}>
                {line.documentTypeId?.fullName || line.documentTypeId?.shortName || 'Document'}
              </span>
              {line.documentTypeId?.code && (
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 7px',
                    borderRadius: 4,
                    backgroundColor: 'var(--admin-surface-2, #f1f5f9)',
                    border: '1px solid var(--admin-border, #e2e8f0)',
                    color: 'var(--admin-text-secondary)',
                  }}
                >
                  {line.documentTypeId.code}
                </span>
              )}
              {line.documentTypeId?.category && (
                <span style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                  • {line.documentTypeId.category}
                </span>
              )}
            </div>
          </div>

          {/* Right side: Prominent Status Badge + Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 20,
                backgroundColor: statusCfg.bg,
                color: statusCfg.color,
                border: `1px solid ${statusCfg.border}`,
              }}
            >
              {statusCfg.icon}
              <span>{statusCfg.label}</span>
            </span>

            {line.isDelayed && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: 4,
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#dc2626',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                }}
              >
                DELAYED
              </span>
            )}

            {isPending && (
              <button
                type="button"
                className="btn-admin-icon danger"
                title="Remove document line"
                onClick={() => handleRemoveLine(line._id)}
                disabled={actionLoading || lines.length <= 1}
                style={{ padding: 4 }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* China Delegation & Acknowledgment Status Bar (for China group) */}
        {isChinaGroup && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 6,
              backgroundColor: line.delegationMode === 'open' && !line.assignedAssociateId
                ? 'rgba(5, 150, 105, 0.08)'
                : 'rgba(37, 99, 235, 0.06)',
              border: `1px solid ${
                line.delegationMode === 'open' && !line.assignedAssociateId
                  ? 'rgba(5, 150, 105, 0.25)'
                  : 'rgba(37, 99, 235, 0.2)'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {line.delegationMode === 'open' && !line.assignedAssociateId ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#047857', fontWeight: 700 }}>
                  <Sparkles size={14} color="#059669" />
                  <span>Open Claim Pool (Unclaimed — visible to all China associates)</span>
                </span>
              ) : line.assignedAssociateId ? (
                <>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#1e40af', fontWeight: 600 }}>
                    <UserCheck size={14} color="#2563eb" />
                    <span>Assigned: <strong>{line.assignedAssociateId.name || 'Associate'}</strong></span>
                  </span>
                  <span>•</span>
                  {line.acknowledgedAt ? (
                    <span style={{ color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={13} />
                      <span>Receipt Confirmed ({new Date(line.acknowledgedAt).toLocaleString()})</span>
                    </span>
                  ) : (
                    <span style={{ color: '#b45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} />
                      <span>Not yet acknowledged by associate</span>
                    </span>
                  )}
                </>
              ) : null}
            </div>

            {/* Revoke button (Admin only, visible if an associate is assigned) */}
            {line.assignedAssociateId && (
              <button
                type="button"
                onClick={() => {
                  setRevokeLine(line);
                  setRevokeReason('');
                  setRevokeError('');
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid #fca5a5',
                  backgroundColor: '#ffffff',
                  color: '#dc2626',
                  fontSize: 11.5,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
                title="Revoke assignment and return line to China open claim pool"
              >
                <UserX size={12} />
                <span>Revoke & Reopen Pool</span>
              </button>
            )}
          </div>
        )}

        {/* Audit Note: Revocation History */}
        {line.revokedAt && (
          <div
            style={{
              marginTop: 8,
              padding: '6px 10px',
              borderRadius: 6,
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              fontSize: 11.5,
              color: '#991b1b',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ban size={12} color="#dc2626" />
            <span>
              <strong>Revocation Audit:</strong> Reopened to pool by {line.revokedBy?.name || 'Admin'} on {new Date(line.revokedAt).toLocaleDateString()} — Reason: "{line.revocationReason}"
            </span>
          </div>
        )}

        {/* Inline Correction Claim Note */}
        {line.correctionReason && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 6,
              backgroundColor: 'rgba(234, 88, 12, 0.08)',
              border: '1px solid rgba(234, 88, 12, 0.25)',
              fontSize: 12.5,
              color: '#c2410c',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <RotateCcw size={14} style={{ flexShrink: 0 }} />
            <span><strong>Client Correction Claim:</strong> {line.correctionReason}</span>
          </div>
        )}

        {/* Inline Rejection Note Callout */}
        {line.status === 'needed' && rejectionNote && (
          <div
            style={{
              marginTop: 10,
              padding: '10px 14px',
              borderRadius: 6,
              backgroundColor: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              fontSize: 13,
              color: '#991b1b',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <AlertTriangle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, lineHeight: 1.45 }}>
              <div style={{ fontWeight: 700, color: '#dc2626' }}>Document Rejected — Action Required</div>
              <div style={{ marginTop: 2, color: '#7f1d1d' }}>Note: {rejectionNote}</div>
              <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 4 }}>
                {line.assignedAssociateId
                  ? 'Awaiting corrected upload from assigned associate.'
                  : 'Attach corrected file or delegate to China associate.'}
              </div>
            </div>
          </div>
        )}

        {/* Uploaded / Attached Files List with PROMINENT Print Action */}
        {line.uploadedFiles && line.uploadedFiles.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {line.uploadedFiles.map((f) => (
              <div
                key={f._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'var(--admin-surface-2, #f8fafc)',
                  border: '1px solid var(--admin-border, #e2e8f0)',
                  borderRadius: 8,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200, flex: 1 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      backgroundColor: 'rgba(168, 35, 27, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--admin-accent)',
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--admin-text-primary)', wordBreak: 'break-all' }}>
                      {f.filename}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-secondary)', marginTop: 2 }}>
                      {f.size ? `${Math.round(f.size / 1024)} KB` : ''} • Uploaded by {f.uploadedByUserId?.name || 'User'} {f.uploadedByUserId?.role ? `(${f.uploadedByUserId.role})` : ''} • {f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                </div>

                {/* Print / View and Download buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="btn-admin-primary"
                    onClick={() => handleOpenFile(f._id)}
                    style={{
                      padding: '7px 14px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#1e293b',
                      borderColor: '#1e293b',
                    }}
                    title="Open file in new tab (native browser print)"
                  >
                    <Printer size={14} />
                    <span>Print / View</span>
                  </button>
                  <button
                    type="button"
                    className="btn-admin-secondary"
                    onClick={() => handleDownloadFile(f._id, f.filename)}
                    style={{
                      padding: '7px 12px',
                      fontSize: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                    title="Download document file directly"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action & Controls Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid var(--admin-border-subtle, #f1f5f9)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Delegation Control Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--admin-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <UserCheck size={13} />
                <span>Delegation:</span>
              </span>
              <select
                className="admin-select"
                value={currentSelectValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'none') {
                    handleDelegationChange(line._id, 'none', null);
                  } else if (val === 'open') {
                    handleDelegationChange(line._id, 'open', null);
                  } else if (val.startsWith('specific:')) {
                    const associateId = val.split(':')[1];
                    handleDelegationChange(line._id, 'specific', associateId);
                  }
                }}
                style={{
                  fontSize: 12,
                  height: 32,
                  padding: '2px 8px',
                  maxWidth: 240,
                  backgroundColor: currentDel.delegationMode !== 'none' ? 'rgba(37, 99, 235, 0.06)' : undefined,
                  borderColor: currentDel.delegationMode !== 'none' ? '#93c5fd' : undefined,
                  color: currentDel.delegationMode !== 'none' ? '#1d4ed8' : undefined,
                  fontWeight: currentDel.delegationMode !== 'none' ? 600 : 400,
                }}
              >
                <option value="none">Handle Locally (Admin / Self)</option>
                <option value="open">⚡ Open Pool (Any China Associate)</option>
                <optgroup label="China Associates">
                  {chinaAssociates.map((u) => {
                    const excluded = isExcluded(u._id);
                    return (
                      <option key={u._id} value={`specific:${u._id}`} disabled={excluded}>
                        🇨🇳 {u.name} {excluded ? '(Excluded from this line)' : ''}
                      </option>
                    );
                  })}
                </optgroup>
                <optgroup label="Admin Personnel">
                  {associates
                    .filter((u) => u.role !== 'china_associate')
                    .map((u) => (
                      <option key={u._id} value={`specific:${u._id}`}>
                        Admin: {u.name}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            {/* Courier Tracking Code Display */}
            {(line.trackingCode || line.shippingTrackingCode) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Tracking:</span>
                <span style={{ fontWeight: 600 }}>{line.trackingCode || line.shippingTrackingCode}</span>
                <button
                  type="button"
                  onClick={() => handleCopyTracking(line.trackingCode || line.shippingTrackingCode)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 1 }}
                  title="Copy tracking code"
                >
                  {copiedTracking === (line.trackingCode || line.shippingTrackingCode) ? (
                    <Check size={11} color="#16a34a" />
                  ) : (
                    <Copy size={11} />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                style={{
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 4px rgba(168, 35, 27, 0.2)',
                }}
              >
                <Paperclip size={16} />
                <span>Attach Document</span>
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
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#16a34a',
                  borderColor: '#16a34a',
                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)',
                }}
              >
                <Lock size={16} />
                <span>Review & Lock Document</span>
              </button>
            )}

            {['ready', 'packaged', 'sent_to_client', 'delivered', 'completed'].includes(line.status) && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#16a34a',
                  padding: '6px 12px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(22, 163, 74, 0.08)',
                  border: '1px solid rgba(22, 163, 74, 0.25)',
                }}
              >
                <CheckCircle2 size={15} />
                <span>Document Locked & Ready</span>
              </span>
            )}
          </div>
        </div>

        {/* Demoted Translation & Price Meta Info */}
        <div
          style={{
            marginTop: 10,
            fontSize: 11.5,
            color: 'var(--admin-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span>
            Translation:{' '}
            <strong>
              {line.translationMode === 'original_only'
                ? 'Original Only'
                : line.translationMode === 'original_plus_translation'
                ? 'Original + Translation'
                : 'Translation Only'}
            </strong>
          </span>
          <span>•</span>
          <span>
            Client Price:{' '}
            <strong style={{ fontFamily: 'var(--font-mono)' }}>
              {line.clientPrice?.toLocaleString() ?? 0} DZD
            </strong>
          </span>
          <span>•</span>
          <span>
            Cost Price:{' '}
            <strong style={{ fontFamily: 'var(--font-mono)' }}>
              {line.costPrice?.toLocaleString() ?? 0} DZD
            </strong>
          </span>
        </div>
      </div>
    );
  };

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
              disabled={actionLoading}
              title="Confirm Order"
            >
              <CheckCircle2 size={15} />
              <span>Confirm Order</span>
            </button>
          )}

          {/* Correction Order Reject Action (Terminal) */}
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

          {/* Fulfillment Actions for Active/Ready Orders */}
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

      {/* Main Order Dossier Grid */}
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

      {/* Document Dossier (Document-First Card List Grouped by Fulfillment Station) */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        {/* Header with Title and Filter Tabs */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--admin-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            backgroundColor: 'var(--admin-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="var(--admin-accent)" />
                <span>Document Dossier ({lines.length})</span>
              </h2>
              <p style={{ fontSize: 12, color: 'var(--admin-text-secondary)', marginTop: 2, marginBottom: 0 }}>
                Organized by fulfillment delegation: Local vs. China Operations.
              </p>
            </div>

            {/* Quick Status Filter Tabs */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                backgroundColor: 'var(--admin-surface-2, #f1f5f9)',
                padding: '3px',
                borderRadius: 6,
                border: '1px solid var(--admin-border)',
              }}
            >
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: filterTab === 'all' ? 700 : 500,
                  border: 'none',
                  borderRadius: 4,
                  backgroundColor: filterTab === 'all' ? 'var(--admin-surface, #ffffff)' : 'transparent',
                  color: filterTab === 'all' ? 'var(--admin-text-primary)' : 'var(--admin-text-secondary)',
                  cursor: 'pointer',
                  boxShadow: filterTab === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                All ({lines.length})
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
                  backgroundColor: filterTab === 'action_needed' ? 'var(--admin-surface, #ffffff)' : 'transparent',
                  color: filterTab === 'action_needed' ? '#b45309' : 'var(--admin-text-secondary)',
                  cursor: 'pointer',
                  boxShadow: filterTab === 'action_needed' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
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
                  backgroundColor: filterTab === 'ready' ? 'var(--admin-surface, #ffffff)' : 'transparent',
                  color: filterTab === 'ready' ? '#15803d' : 'var(--admin-text-secondary)',
                  cursor: 'pointer',
                  boxShadow: filterTab === 'ready' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Locked & Ready ({readyCount})
              </button>
            </div>
          </div>

          {isPending && (
            <button
              type="button"
              className="btn-admin-secondary"
              onClick={() => setAddModalOpen(true)}
              style={{ padding: '6px 14px', fontSize: 12.5 }}
            >
              <Plus size={14} />
              <span>Add Document Line</span>
            </button>
          )}
        </div>

        {/* Grouped Document Card List */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {lines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--admin-text-muted)' }}>
              No document lines on this order.
            </div>
          ) : (
            <>
              {/* ── SECTION 1: HANDLING LOCALLY ────────────────────────────────────────── */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: '2px solid var(--admin-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building2 size={16} color="var(--admin-accent)" />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>
                      Handling Locally (Headquarters)
                    </h3>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        backgroundColor: 'var(--admin-surface-2, #f1f5f9)',
                        color: 'var(--admin-text-secondary)',
                      }}
                    >
                      {localLines.length}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                    Managed directly without China associate delegation
                  </span>
                </div>

                {localLines.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 6,
                      backgroundColor: 'var(--admin-surface-2, #f8fafc)',
                      border: '1px dashed var(--admin-border)',
                      textAlign: 'center',
                      color: 'var(--admin-text-muted)',
                      fontSize: 12.5,
                    }}
                  >
                    No documents currently designated for local handling.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {localLines.map((line) => renderDocumentCard(line, false))}
                  </div>
                )}
              </div>

              {/* ── SECTION 2: DELEGATED TO CHINA ──────────────────────────────────────── */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: '2px solid #93c5fd',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe size={16} color="#2563eb" />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', margin: 0 }}>
                      Delegated to China Operations
                    </h3>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        backgroundColor: '#dbeafe',
                        color: '#1d4ed8',
                      }}
                    >
                      {chinaLines.length}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                    Assigned to specific associates or open in claim pool
                  </span>
                </div>

                {chinaLines.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 6,
                      backgroundColor: '#eff6ff',
                      border: '1px dashed #bfdbfe',
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: 12.5,
                    }}
                  >
                    No documents currently delegated to China operations. Select "Open Pool" or an associate to delegate.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {chinaLines.map((line) => renderDocumentCard(line, true))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
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
                        {doc.hasTranslation ? ' · with translation' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Translation Mode — options depend on the selected document */}
                {(() => {
                  const selectedDoc = catalogDocs.find((d) => d._id === selectedAddDocId);
                  const hasTranslation = selectedDoc?.hasTranslation ?? true;

                  if (!selectedAddDocId) {
                    return (
                      <div className="admin-form-group">
                        <label className="admin-form-label">Translation Mode</label>
                        <select className="admin-select" disabled>
                          <option>— Select a document first —</option>
                        </select>
                      </div>
                    );
                  }

                  if (!hasTranslation) {
                    return (
                      <div className="admin-form-group">
                        <label className="admin-form-label">Translation Mode</label>
                        <select className="admin-select" value="original_only" disabled>
                          <option value="original_only">Original Only</option>
                        </select>
                        <p style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 4 }}>
                          This document does not offer a translation service.
                        </p>
                      </div>
                    );
                  }

                  return (
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
                  );
                })()}
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
                style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
              >
                {actionLoading ? 'Deleting…' : 'Yes, Delete Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Attach Modal */}
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
                <div style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginBottom: 16 }}>
                  Attaching file for <strong>{adminAttachLine.documentTypeId?.fullName || 'Document'}</strong>.
                </div>

                {adminAttachError && (
                  <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={14} />
                    <span>{adminAttachError}</span>
                  </div>
                )}

                <div className="admin-form-group">
                  <label className="admin-form-label">
                    Select File (Max 12MB) <span className="required">*</span>
                  </label>
                  <input
                    type="file"
                    className="admin-input"
                    onChange={(e) => setAdminAttachFile(e.target.files?.[0] || null)}
                    style={{ padding: '6px' }}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Tracking Code (Optional)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="e.g. SF123456789"
                    value={adminAttachTracking}
                    onChange={(e) => setAdminAttachTracking(e.target.value)}
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Note / Description (Optional)</label>
                  <textarea
                    className="admin-textarea"
                    rows={2}
                    placeholder="e.g. Scanned copy received..."
                    value={adminAttachNote}
                    onChange={(e) => setAdminAttachNote(e.target.value)}
                  />
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

      {/* Revoke Assignment Modal */}
      {revokeLine && (
        <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setRevokeLine(null); }}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" style={{ width: 480 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
                <UserX size={18} />
                <span>Revoke Assignment & Reopen to Pool</span>
              </h2>
              <button type="button" className="btn-admin-icon" onClick={() => setRevokeLine(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRevokeSubmit}>
              <div className="admin-modal-body">
                <div style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
                  Revoking <strong>{revokeLine.documentTypeId?.fullName || 'Document'}</strong> from associate{' '}
                  <strong style={{ color: 'var(--admin-text-primary)' }}>{revokeLine.assignedAssociateId?.name || 'Associate'}</strong>.
                  <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 6, backgroundColor: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.25)', color: '#991b1b', fontSize: 12 }}>
                    <strong>Permanent Exclusion:</strong> This associate will be added to the exclusion list for this specific document and will NOT be able to claim or be re-assigned it. The document will immediately return to the <strong>Open Claim Pool</strong> for other China associates to claim.
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">
                    Revocation Reason <span className="required">*</span>
                  </label>
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    placeholder="e.g. Taking too long to fulfill, associate unresponsive, reassignment requested..."
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
                <button
                  type="submit"
                  className="btn-admin-primary"
                  disabled={revokeBusy || !revokeReason.trim()}
                  style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                >
                  {revokeBusy ? 'Revoking…' : 'Revoke & Reopen to Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lock Modal (Approve or Reject Attached Line) */}
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
                <div style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginBottom: 16 }}>
                  Reviewing <strong>{lockLine.documentTypeId?.fullName || 'Document'}</strong>.
                </div>

                {/* Show uploaded files preview */}
                {lockLine.uploadedFiles && lockLine.uploadedFiles.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--admin-text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>
                      Attached Files ({lockLine.uploadedFiles.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {lockLine.uploadedFiles.map((f) => (
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
                          <span style={{ flex: 1, fontWeight: 600 }}>{f.filename}</span>
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(f._id, f.filename)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--admin-accent)', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}
                          >
                            <Download size={13} /> View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decision toggle */}
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
                        background: lockApprove ? 'rgba(220, 252, 231, 0.5)' : 'transparent',
                        color: lockApprove ? '#16a34a' : 'var(--admin-text-secondary)',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <CheckCircle2 size={14} /> Approve & Lock
                    </button>
                    <button
                      type="button"
                      onClick={() => setLockApprove(false)}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: 6,
                        border: `2px solid ${!lockApprove ? '#dc2626' : 'var(--admin-border)'}`,
                        background: !lockApprove ? 'rgba(254, 242, 242, 0.5)' : 'transparent',
                        color: !lockApprove ? '#dc2626' : 'var(--admin-text-secondary)',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">
                    {!lockApprove ? 'Rejection Reason (Required — associate will see this)' : 'Note (Optional)'}
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

      {/* Reject Correction Modal */}
      {rejectModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal" style={{ maxWidth: 480 }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Reject Correction Claim</h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setRejectModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRejectOrder}>
              <div className="admin-modal-body">
                <p style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginBottom: 14 }}>
                  Rejecting this claim is terminal. The order will be marked as rejected and no further production actions will be permitted.
                </p>
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    Rejection Reason <span className="required">*</span>
                  </label>
                  <textarea
                    className="admin-textarea"
                    rows={4}
                    placeholder="Explain why this correction claim is rejected…"
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
                <button
                  type="button"
                  className="btn-admin-secondary"
                  onClick={() => setRejectModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-admin-primary"
                  disabled={rejectBusy || !rejectReason.trim()}
                  style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                >
                  {rejectBusy ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
