import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
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
  LayoutGrid,
  Table as TableIcon,
  Columns,
  SplitSquareVertical,
  HelpCircle,
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

  // Concept switcher: 'split' | 'table' | 'dashboard'
  const [searchParams] = useSearchParams();
  const [activeConcept, setActiveConcept] = useState(() => {
    return searchParams.get('concept') || localStorage.getItem('autopartdz_order_detail_concept') || 'split';
  });

  useEffect(() => {
    const paramConcept = searchParams.get('concept');
    if (paramConcept && ['split', 'table', 'dashboard'].includes(paramConcept)) {
      setActiveConcept(paramConcept);
      localStorage.setItem('autopartdz_order_detail_concept', paramConcept);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleConceptUpdate = (e) => {
      const c = e.detail || localStorage.getItem('autopartdz_order_detail_concept') || 'split';
      setActiveConcept(c);
    };
    window.addEventListener('conceptChange', handleConceptUpdate);
    window.addEventListener('storage', handleConceptUpdate);
    return () => {
      window.removeEventListener('conceptChange', handleConceptUpdate);
      window.removeEventListener('storage', handleConceptUpdate);
    };
  }, []);

  const handleConceptChange = (concept) => {
    setActiveConcept(concept);
    localStorage.setItem('autopartdz_order_detail_concept', concept);
    window.dispatchEvent(new CustomEvent('conceptChange', { detail: concept }));
  };

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Associates list (active users)
  const [associates, setAssociates] = useState([]);

  // Line delegations: map of lineId -> { delegationMode: 'none' | 'open' | 'specific', associateId: string | null }
  const [lineDelegations, setLineDelegations] = useState({});

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

  const isExcluded = (line, uId) =>
    (line.excludedAssociateIds || []).some((ex) => (ex._id || ex).toString() === uId.toString());

  // Helper for Delegation Select Dropdown
  const renderDelegationSelect = (line, isCompact = false) => {
    const currentDel = lineDelegations[line._id] || {
      delegationMode: line.delegationMode || (line.assignedAssociateId ? 'specific' : 'none'),
      associateId: line.assignedAssociateId?._id || line.assignedAssociateId || null,
    };
    const currentVal =
      currentDel.delegationMode === 'open'
        ? 'open'
        : currentDel.delegationMode === 'specific' && currentDel.associateId
        ? `specific:${currentDel.associateId}`
        : 'none';

    return (
      <select
        className="admin-select"
        value={currentVal}
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
          fontSize: isCompact ? 11 : 12,
          height: isCompact ? 28 : 32,
          padding: '2px 6px',
          maxWidth: isCompact ? 180 : 230,
          backgroundColor: currentDel.delegationMode !== 'none' ? 'rgba(37, 99, 235, 0.06)' : undefined,
          borderColor: currentDel.delegationMode !== 'none' ? '#93c5fd' : undefined,
          color: currentDel.delegationMode !== 'none' ? '#1d4ed8' : undefined,
          fontWeight: currentDel.delegationMode !== 'none' ? 600 : 400,
        }}
      >
        <option value="none">Local Station (Self)</option>
        <option value="open">⚡ Open Pool (China)</option>
        <optgroup label="China Associates">
          {chinaAssociates.map((u) => {
            const excluded = isExcluded(line, u._id);
            return (
              <option key={u._id} value={`specific:${u._id}`} disabled={excluded}>
                🇨🇳 {u.name} {excluded ? '(Excluded)' : ''}
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
    );
  };

  // Helper for Document Card (used in Concept 1 and Concept 3)
  const renderCard = (line, isChinaGroup) => {
    const statusCfg = getStatusBadge(line.status);
    const rejectionNote =
      line.lastRejectionNote ||
      [...(line.activityLog || [])].reverse().find((e) => e.action === 'rejected')?.note;

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
          padding: '14px 16px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        }}
      >
        {/* Card Header: Doc Name, Category, Badges */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--admin-text-primary)' }}>
                {line.documentTypeId?.fullName || line.documentTypeId?.shortName || 'Document'}
              </span>
              {line.documentTypeId?.code && (
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    padding: '1px 6px',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11.5,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 20,
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
                style={{ padding: 4 }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* China Delegation Bar (only in China section) */}
        {isChinaGroup && (
          <div
            style={{
              marginTop: 8,
              padding: '6px 10px',
              borderRadius: 6,
              backgroundColor:
                line.delegationMode === 'open' && !line.assignedAssociateId
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
              fontSize: 11.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {line.delegationMode === 'open' && !line.assignedAssociateId ? (
                <span style={{ color: '#047857', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={13} color="#059669" />
                  <span>Open Claim Pool (Unclaimed)</span>
                </span>
              ) : line.assignedAssociateId ? (
                <>
                  <span style={{ color: '#1e40af', fontWeight: 600 }}>
                    Assigned: <strong>{line.assignedAssociateId.name || 'Associate'}</strong>
                  </span>
                  <span>•</span>
                  {line.acknowledgedAt ? (
                    <span style={{ color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Check size={12} /> Receipt Confirmed
                    </span>
                  ) : (
                    <span style={{ color: '#b45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={12} /> Not yet acknowledged
                    </span>
                  )}
                </>
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
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: '1px solid #fca5a5',
                  backgroundColor: '#ffffff',
                  color: '#dc2626',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  cursor: 'pointer',
                }}
                title="Revoke associate assignment and reopen to pool"
              >
                <UserX size={11} />
                <span>Revoke & Reopen</span>
              </button>
            )}
          </div>
        )}

        {/* Audit Note: Revocation History */}
        {line.revokedAt && (
          <div
            style={{
              marginTop: 6,
              padding: '4px 8px',
              borderRadius: 4,
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              fontSize: 11,
              color: '#991b1b',
            }}
          >
            <strong>Revocation Audit:</strong> Reopened by {line.revokedBy?.name || 'Admin'} ("{line.revocationReason}")
          </div>
        )}

        {/* Rejection Note Callout */}
        {line.status === 'needed' && rejectionNote && (
          <div
            style={{
              marginTop: 8,
              padding: '8px 10px',
              borderRadius: 6,
              backgroundColor: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              fontSize: 12,
              color: '#991b1b',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <AlertTriangle size={14} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Revision Note:</strong> {rejectionNote}
            </div>
          </div>
        )}

        {/* Attached Files Strip */}
        {line.uploadedFiles && line.uploadedFiles.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {line.uploadedFiles.map((f) => (
              <div
                key={f._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  backgroundColor: 'var(--admin-surface-2, #f8fafc)',
                  border: '1px solid var(--admin-border, #e2e8f0)',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <FileText size={14} color="var(--admin-accent)" />
                  <span style={{ fontWeight: 600, color: 'var(--admin-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.filename}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                    ({Math.round((f.size || 0) / 1024)} KB)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn-admin-primary"
                    onClick={() => handleOpenFile(f._id)}
                    style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    title="Print or view"
                  >
                    <Printer size={12} />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    className="btn-admin-secondary"
                    onClick={() => handleDownloadFile(f._id, f.filename)}
                    style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    title="Download file"
                  >
                    <Download size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Controls & Delegation Footer */}
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
            <span style={{ fontSize: 11, color: 'var(--admin-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <UserCheck size={12} />
              <span>Delegation:</span>
            </span>
            {renderDelegationSelect(line)}
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
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Paperclip size={14} />
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
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, backgroundColor: '#16a34a', borderColor: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Lock size={14} />
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

  return (
    <div>
      {/* ── LIVE CONCEPT EXPLORATION SWITCHER (Requested by User) ───────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          backgroundColor: '#0f172a',
          borderRadius: 8,
          marginBottom: 16,
          color: '#ffffff',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LayoutGrid size={16} color="#38bdf8" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
              Concept Switcher (Exploration Mode)
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Switch between the 3 UI designs live on this order to select your preferred layout
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, backgroundColor: '#1e293b', padding: 3, borderRadius: 6 }}>
          <button
            type="button"
            onClick={() => handleConceptChange('split')}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              border: 'none',
              backgroundColor: activeConcept === 'split' ? '#38bdf8' : 'transparent',
              color: activeConcept === 'split' ? '#0f172a' : '#94a3b8',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <SplitSquareVertical size={13} />
            <span>1. Clean Split</span>
          </button>

          <button
            type="button"
            onClick={() => handleConceptChange('table')}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              border: 'none',
              backgroundColor: activeConcept === 'table' ? '#38bdf8' : 'transparent',
              color: activeConcept === 'table' ? '#0f172a' : '#94a3b8',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <TableIcon size={13} />
            <span>2. Executive Table</span>
          </button>

          <button
            type="button"
            onClick={() => handleConceptChange('dashboard')}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              border: 'none',
              backgroundColor: activeConcept === 'dashboard' ? '#38bdf8' : 'transparent',
              color: activeConcept === 'dashboard' ? '#0f172a' : '#94a3b8',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Columns size={13} />
            <span>3. 2-Col Dashboard</span>
          </button>

          <Link
            to="/admin/design-preview"
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: '1px solid rgba(56, 189, 248, 0.35)',
            }}
            title="Open side-by-side comparison lab"
          >
            <Sparkles size={13} />
            <span>Design Lab →</span>
          </Link>
        </div>
      </div>

      {/* ── Top Header & Global Actions ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/admin/orders" className="btn-admin-secondary" style={{ padding: '6px 10px' }}>
            <ArrowLeft size={14} />
            <span>Queue</span>
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

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* CONCEPT 1: CLEAN MODERN SPLIT (Local vs China Sections)                 */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeConcept === 'split' && (
        <div>
          {/* Client & Vehicle Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 18 }}>
            <div className="admin-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, borderBottom: '1px solid var(--admin-border)', paddingBottom: 6 }}>
                <User size={15} color="var(--admin-accent)" />
                <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>
                  Client Profile
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '6px 10px', fontSize: 12.5 }}>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Full Name:</span>
                <span style={{ fontWeight: 600 }}>{order.firstName} {order.lastName}</span>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Phone:</span>
                <span style={{ fontFamily: 'monospace' }}>{order.phone}</span>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Passport:</span>
                <span style={{ fontFamily: 'monospace' }}>{order.passportNumber || '—'}</span>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Address:</span>
                <span>{order.address}, {order.wilaya}</span>
              </div>
            </div>

            <div className="admin-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, borderBottom: '1px solid var(--admin-border)', paddingBottom: 6 }}>
                <Car size={15} color="var(--admin-accent)" />
                <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>
                  Vehicle Specifications
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '6px 10px', fontSize: 12.5 }}>
                <span style={{ color: 'var(--admin-text-secondary)' }}>VIN:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--admin-accent)' }}>{order.vin}</span>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Model:</span>
                <span>{order.carModel || '—'}</span>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Category:</span>
                <span>{order.carCategoryId?.name || 'Custom'}</span>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Forwarder:</span>
                <span>{order.importAgency || '—'}</span>
              </div>
            </div>
          </div>

          {/* Dossier Header with Filter Tabs */}
          <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--admin-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                backgroundColor: 'var(--admin-surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={16} color="var(--admin-accent)" />
                  <span>Document Dossier ({lines.length})</span>
                </h2>

                <div style={{ display: 'flex', gap: 2, backgroundColor: 'var(--admin-surface-2, #f1f5f9)', padding: 2, borderRadius: 6 }}>
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    style={{
                      padding: '3px 8px',
                      fontSize: 11.5,
                      fontWeight: filterTab === 'all' ? 700 : 500,
                      border: 'none',
                      borderRadius: 4,
                      backgroundColor: filterTab === 'all' ? '#ffffff' : 'transparent',
                      color: filterTab === 'all' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    All ({lines.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('action_needed')}
                    style={{
                      padding: '3px 8px',
                      fontSize: 11.5,
                      fontWeight: filterTab === 'action_needed' ? 700 : 500,
                      border: 'none',
                      borderRadius: 4,
                      backgroundColor: filterTab === 'action_needed' ? '#ffffff' : 'transparent',
                      color: filterTab === 'action_needed' ? '#b45309' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    Action Needed ({actionNeededCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('ready')}
                    style={{
                      padding: '3px 8px',
                      fontSize: 11.5,
                      fontWeight: filterTab === 'ready' ? 700 : 500,
                      border: 'none',
                      borderRadius: 4,
                      backgroundColor: filterTab === 'ready' ? '#ffffff' : 'transparent',
                      color: filterTab === 'ready' ? '#15803d' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    Ready ({readyCount})
                  </button>
                </div>
              </div>

              {isPending && (
                <button
                  type="button"
                  className="btn-admin-secondary"
                  onClick={() => setAddModalOpen(true)}
                  style={{ padding: '5px 12px', fontSize: 12 }}
                >
                  <Plus size={13} />
                  <span>Add Line</span>
                </button>
              )}
            </div>

            {/* Split Groups List */}
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Group 1: Local Station */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid var(--admin-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={15} color="var(--admin-accent)" />
                    <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
                      Local Headquarters Station
                    </h3>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 10, backgroundColor: '#f1f5f9', color: '#475569' }}>
                      {localLines.length}
                    </span>
                  </div>
                  <span style={{ fontSize: 11.5, color: '#64748b' }}>Managed directly without China delegation</span>
                </div>

                {localLines.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px dashed #e2e8f0' }}>
                    No documents marked for local handling.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {localLines.map((l) => renderCard(l, false))}
                  </div>
                )}
              </div>

              {/* Group 2: China Station */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #93c5fd' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Globe size={15} color="#2563eb" />
                    <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: 0, color: '#1e40af' }}>
                      Delegated to China Operations
                    </h3>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 10, backgroundColor: '#dbeafe', color: '#1d4ed8' }}>
                      {chinaLines.length}
                    </span>
                  </div>
                  <span style={{ fontSize: 11.5, color: '#64748b' }}>Assigned or in Open Claim Pool</span>
                </div>

                {chinaLines.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: 12, backgroundColor: '#eff6ff', borderRadius: 6, border: '1px dashed #bfdbfe' }}>
                    No documents currently delegated to China.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {chinaLines.map((l) => renderCard(l, true))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* CONCEPT 2: EXECUTIVE DATA TABLE (High Density Enterprise Table)         */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeConcept === 'table' && (
        <div>
          {/* Compact Dossier Header Ribbon */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#ffffff',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              fontSize: 12.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={15} color="var(--admin-accent)" />
              <strong>{order.firstName} {order.lastName}</strong>
              <span style={{ color: '#64748b' }}>({order.phone})</span>
              <span>•</span>
              <span style={{ color: '#64748b' }}>Passport: <strong style={{ color: '#0f172a' }}>{order.passportNumber || '—'}</strong></span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Car size={15} color="#2563eb" />
              <span>{order.carModel}</span>
              <span>•</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--admin-accent)' }}>VIN: {order.vin}</span>
            </div>

            {isPending && (
              <button
                type="button"
                className="btn-admin-secondary"
                onClick={() => setAddModalOpen(true)}
                style={{ padding: '4px 10px', fontSize: 11.5 }}
              >
                <Plus size={12} />
                <span>Add Document</span>
              </button>
            )}
          </div>

          {/* High-Density Data Table */}
          <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '10px 14px' }}>Document Name & Code</th>
                    <th style={{ padding: '10px 14px' }}>Fulfillment Station & Assignee</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Attached Files</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedLines.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        No document lines found.
                      </td>
                    </tr>
                  ) : (
                    displayedLines.map((line) => {
                      const statusCfg = getStatusBadge(line.status);
                      const isChina = line.delegationMode === 'open' || line.delegationMode === 'specific' || Boolean(line.assignedAssociateId);

                      return (
                        <tr key={line._id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                          {/* Document Name */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {line.documentTypeId?.fullName || line.documentTypeId?.shortName}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                              {line.documentTypeId?.code && <span style={{ fontFamily: 'monospace' }}>[{line.documentTypeId.code}] </span>}
                              {line.translationMode === 'original_plus_translation' ? 'Orig + Translation' : 'Original Only'}
                            </div>
                            {line.lastRejectionNote && line.status === 'needed' && (
                              <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>
                                ⚠️ Rejected: {line.lastRejectionNote}
                              </div>
                            )}
                          </td>

                          {/* Station & Delegation Dropdown */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {renderDelegationSelect(line, true)}
                              {isChina && line.assignedAssociateId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRevokeLine(line);
                                    setRevokeReason('');
                                    setRevokeError('');
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    padding: 2,
                                  }}
                                  title="Revoke associate assignment"
                                >
                                  <UserX size={13} />
                                </button>
                              )}
                            </div>
                            {isChina && (
                              <div style={{ fontSize: 11, marginTop: 2 }}>
                                {line.delegationMode === 'open' && !line.assignedAssociateId ? (
                                  <span style={{ color: '#047857', fontWeight: 600 }}>⚡ Open Claim Pool</span>
                                ) : line.acknowledgedAt ? (
                                  <span style={{ color: '#16a34a' }}>✓ Confirmed Receipt</span>
                                ) : (
                                  <span style={{ color: '#b45309' }}>⏳ Unacknowledged</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Status Pill */}
                          <td style={{ padding: '10px 14px' }}>
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
                          </td>

                          {/* Files */}
                          <td style={{ padding: '10px 14px' }}>
                            {line.uploadedFiles && line.uploadedFiles.length > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenFile(line.uploadedFiles[0]._id)}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#1e40af',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                  }}
                                  title="Print or view"
                                >
                                  <Printer size={12} />
                                  <span>View</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadFile(line.uploadedFiles[0]._id, line.uploadedFiles[0].filename)}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    padding: 2,
                                  }}
                                  title="Download file"
                                >
                                  <Download size={12} />
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 11 }}>No files</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
                                  style={{ padding: '4px 10px', fontSize: 11.5 }}
                                >
                                  <Paperclip size={12} />
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
                                  style={{ padding: '4px 10px', fontSize: 11.5, backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                                >
                                  <Lock size={12} />
                                  <span>Lock</span>
                                </button>
                              )}

                              {isPending && (
                                <button
                                  type="button"
                                  className="btn-admin-icon danger"
                                  onClick={() => handleRemoveLine(line._id)}
                                  disabled={actionLoading || lines.length <= 1}
                                  style={{ padding: 3 }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* CONCEPT 3: TWO-COLUMN DASHBOARD (Command Center Layout)                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeConcept === 'dashboard' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Left Column: Fixed Executive Profile */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="admin-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
                <User size={15} color="var(--admin-accent)" />
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Client Dossier</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div><span style={{ color: '#64748b' }}>Name:</span> <strong>{order.firstName} {order.lastName}</strong></div>
                <div><span style={{ color: '#64748b' }}>Phone:</span> <span style={{ fontFamily: 'monospace' }}>{order.phone}</span></div>
                <div><span style={{ color: '#64748b' }}>Passport:</span> <span style={{ fontFamily: 'monospace' }}>{order.passportNumber || '—'}</span></div>
                <div><span style={{ color: '#64748b' }}>Address:</span> {order.address}, {order.wilaya}</div>
              </div>
            </div>

            <div className="admin-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
                <Car size={15} color="#2563eb" />
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Vehicle Specs</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div><span style={{ color: '#64748b' }}>VIN:</span> <strong style={{ color: 'var(--admin-accent)', fontFamily: 'monospace' }}>{order.vin}</strong></div>
                <div><span style={{ color: '#64748b' }}>Model:</span> {order.carModel || '—'}</div>
                <div><span style={{ color: '#64748b' }}>Category:</span> {order.carCategoryId?.name || 'Custom'}</div>
              </div>
            </div>

            <div className="admin-card" style={{ padding: 14, backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Order Progress</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {readyCount} of {lines.length} Documents Ready
              </div>
              <div style={{ width: '100%', height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${lines.length > 0 ? (readyCount / lines.length) * 100 : 0}%`,
                    height: '100%',
                    backgroundColor: '#16a34a',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Document Workflow Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Documents Workflow</h2>
              {isPending && (
                <button
                  type="button"
                  className="btn-admin-secondary"
                  onClick={() => setAddModalOpen(true)}
                  style={{ padding: '4px 10px', fontSize: 11.5 }}
                >
                  <Plus size={12} />
                  <span>Add Line</span>
                </button>
              )}
            </div>

            {displayedLines.map((l) => {
              const isChina = l.delegationMode === 'open' || l.delegationMode === 'specific' || Boolean(l.assignedAssociateId);
              return renderCard(l, isChina);
            })}
          </div>
        </div>
      )}

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
    </div>
  );
}
