import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Camera,
  Upload,
  FileText,
  Check,
  Copy,
  AlertTriangle,
  Search,
  LogOut,
  RefreshCw,
  X,
  Download,
  Package,
  RotateCcw,
  Car,
  MapPin,
  CreditCard,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';

export default function ChinaPortalPage() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [statusFilter, setStatusFilter] = useState('my_tasks');
  const [searchQuery, setSearchQuery] = useState('');

  // Accordion expanded state: map of orderKey -> boolean
  const [expandedOrders, setExpandedOrders] = useState({});

  // Busy states
  const [claimBusyId, setClaimBusyId] = useState(null);
  const [ackBusyId, setAckBusyId] = useState(null);

  // Attach Modal State
  const [attachModalLine, setAttachModalLine] = useState(null);
  const [attachFile, setAttachFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [attachTrackingCode, setAttachTrackingCode] = useState('');
  const [attachNote, setAttachNote] = useState('');
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachError, setAttachError] = useState('');

  // Clipboard copy feedback
  const [copiedKey, setCopiedKey] = useState('');

  const fileInputRef = useRef(null);

  const fetchLines = async () => {
    try {
      setLoading(true);
      setError('');
      const authToken = token || localStorage.getItem('autopartdz_token');
      const res = await fetch('/api/china/lines?view=all', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to load assigned lines queue');
      }
      const data = await res.json();
      const rawLines = Array.isArray(data) ? data : [];
      setLines(rawLines);

      // Default expand all orders on initial fetch
      const initExpanded = {};
      rawLines.forEach((l) => {
        const k = l.order?.trackingCode || l.order?.vin || 'other';
        initExpanded[k] = true;
      });
      setExpandedOrders(initExpanded);
    } catch (err) {
      console.error('[China lines error]', err);
      setError(err.message || 'Error fetching lines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (user.role !== 'china_associate' && user.role !== 'admin') {
      navigate('/admin/orders', { replace: true });
      return;
    }
    fetchLines();
  }, [user, token, navigate]);

  // Object URL preview for images
  useEffect(() => {
    if (!attachFile) {
      setFilePreviewUrl(null);
      return;
    }
    if (attachFile.type && attachFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(attachFile);
      setFilePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFilePreviewUrl(null);
    }
  }, [attachFile]);

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const toggleOrderAccordion = (key) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const expandAll = (keys) => {
    const next = {};
    keys.forEach((k) => {
      next[k] = true;
    });
    setExpandedOrders(next);
  };

  const collapseAll = () => {
    setExpandedOrders({});
  };

  // Claim Task from Open Pool
  const handleClaim = async (line) => {
    try {
      setClaimBusyId(line.id);
      setError('');
      const authToken = token || localStorage.getItem('autopartdz_token');
      const res = await fetch(`/api/order-lines/${line.id}/claim`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error('This task was already claimed by another associate or is no longer available.');
        }
        throw new Error(data.error || 'Failed to claim task.');
      }
      setSuccessToast(`Claimed "${line.documentType?.fullName || 'Document'}" successfully! Please acknowledge receipt.`);
      setTimeout(() => setSuccessToast(''), 5000);
      await fetchLines();
      setStatusFilter('my_tasks');
    } catch (err) {
      setError(err.message || 'Error claiming task');
    } finally {
      setClaimBusyId(null);
    }
  };

  // Acknowledge Receipt of Task
  const handleAcknowledge = async (line) => {
    try {
      setAckBusyId(line.id);
      setError('');
      const authToken = token || localStorage.getItem('autopartdz_token');
      const res = await fetch(`/api/order-lines/${line.id}/acknowledge`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to acknowledge receipt.');
      }
      setSuccessToast(`Receipt confirmed for "${line.documentType?.fullName || 'Document'}".`);
      setTimeout(() => setSuccessToast(''), 4000);
      await fetchLines();
    } catch (err) {
      setError(err.message || 'Error acknowledging receipt');
    } finally {
      setAckBusyId(null);
    }
  };

  const openAttachModal = (line) => {
    setAttachModalLine(line);
    setAttachFile(null);
    setFilePreviewUrl(null);
    setAttachTrackingCode(line.trackingCode || '');
    setAttachNote('');
    setAttachError('');
  };

  const closeAttachModal = () => {
    if (attachBusy) return;
    setAttachModalLine(null);
    setAttachFile(null);
    setFilePreviewUrl(null);
    setAttachTrackingCode('');
    setAttachNote('');
    setAttachError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 12 * 1024 * 1024) {
        setAttachError('File is too large (maximum size is 12MB).');
        return;
      }
      setAttachError('');
      setAttachFile(file);
    }
  };

  const handleAttachSubmit = async (e) => {
    e.preventDefault();
    if (!attachFile) {
      setAttachError('Please select a file or take a photo.');
      return;
    }

    try {
      setAttachBusy(true);
      setAttachError('');
      const formData = new FormData();
      formData.append('file', attachFile);
      if (attachTrackingCode.trim()) formData.append('trackingCode', attachTrackingCode.trim());
      if (attachNote.trim()) formData.append('note', attachNote.trim());

      const authToken = token || localStorage.getItem('autopartdz_token');
      const res = await fetch(`/api/order-lines/${attachModalLine.id}/attach`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to attach document');

      closeAttachModal();
      setSuccessToast('Document attached and submitted for review!');
      setTimeout(() => setSuccessToast(''), 4000);
      await fetchLines();
    } catch (err) {
      setAttachError(err.message);
    } finally {
      setAttachBusy(false);
    }
  };

  const handleDownloadFile = async (fileId, filename) => {
    try {
      const authToken = token || localStorage.getItem('autopartdz_token');
      const res = await fetch(`/api/files/${fileId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
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

  // Filter Counts
  const countMine = lines.filter((l) => l.isMine || (!l.isClaimable && l.assignedAssociate)).length;
  const countOpen = lines.filter((l) => l.isClaimable).length;
  const countNeeded = lines.filter(
    (l) => (l.isMine || (!l.isClaimable && l.assignedAssociate)) && l.status === 'needed'
  ).length;
  const countAttached = lines.filter(
    (l) => (l.isMine || (!l.isClaimable && l.assignedAssociate)) && l.status === 'attached'
  ).length;
  const countTotal = lines.length;

  // Filtered Lines
  const filteredLines = lines.filter((line) => {
    const isAssignedToMe = line.isMine || (!line.isClaimable && line.assignedAssociate);

    if (statusFilter === 'my_tasks' && !isAssignedToMe) return false;
    if (statusFilter === 'open' && !line.isClaimable) return false;
    if (statusFilter === 'needed' && (!isAssignedToMe || line.status !== 'needed')) return false;
    if (statusFilter === 'attached' && (!isAssignedToMe || line.status !== 'attached')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const vinMatch = line.order?.vin?.toLowerCase().includes(q);
      const orderTrackMatch = line.order?.trackingCode?.toLowerCase().includes(q);
      const modelMatch = line.order?.carModel?.toLowerCase().includes(q);
      const clientMatch = `${line.order?.firstName || ''} ${line.order?.lastName || ''}`.toLowerCase().includes(q);
      const passMatch = line.order?.passportNumber?.toLowerCase().includes(q);
      const docMatch = line.documentType?.fullName?.toLowerCase().includes(q);
      const codeMatch = line.documentType?.code?.toLowerCase().includes(q);
      const trackMatch = line.trackingCode?.toLowerCase().includes(q);
      return (
        vinMatch ||
        orderTrackMatch ||
        modelMatch ||
        clientMatch ||
        passMatch ||
        docMatch ||
        codeMatch ||
        trackMatch
      );
    }
    return true;
  });

  // Group filtered lines by Order
  const orderGroupsMap = {};
  filteredLines.forEach((line) => {
    const key = line.order?.trackingCode || line.order?.vin || 'unknown';
    if (!orderGroupsMap[key]) {
      orderGroupsMap[key] = {
        key,
        order: line.order || {},
        lines: [],
      };
    }
    orderGroupsMap[key].lines.push(line);
  });
  const groupedOrders = Object.values(orderGroupsMap);
  const allOrderKeys = groupedOrders.map((g) => g.key);

  return (
    <div
      dir="ltr"
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 20px',
          height: 54,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: '#a8231b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            DZ
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
              China Sourcing Portal
            </span>
            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
              {user?.name || 'Associate'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#64748b',
            fontSize: 12,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
          title="Sign out"
        >
          <LogOut size={13} />
          <span>Sign Out</span>
        </button>
      </header>

      {/* ── Main Container ─────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '16px 16px 48px 16px' }}>
        {/* Title, Search & Global Actions */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Operations Worklist
              </h1>
              <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0 0' }}>
                Manage delegated documents and overseas fulfillment
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => expandAll(allOrderKeys)}
                style={{
                  padding: '5px 9px',
                  borderRadius: 5,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: 11.5,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
                title="Expand all orders"
              >
                <Maximize2 size={12} />
                <span>Expand All</span>
              </button>

              <button
                type="button"
                onClick={collapseAll}
                style={{
                  padding: '5px 9px',
                  borderRadius: 5,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: 11.5,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
                title="Collapse all orders"
              >
                <Minimize2 size={12} />
                <span>Collapse All</span>
              </button>

              <button
                type="button"
                onClick={fetchLines}
                disabled={loading}
                style={{
                  height: 30,
                  width: 30,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 5,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                title="Refresh list"
              >
                <RefreshCw size={13} className={loading ? 'spin-animate' : ''} />
              </button>
            </div>
          </div>

          {/* ── Segmented Tabs ──────── */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              backgroundColor: '#f1f5f9',
              padding: 3,
              borderRadius: 6,
              marginBottom: 12,
              overflowX: 'auto',
            }}
          >
            <button
              type="button"
              onClick={() => setStatusFilter('my_tasks')}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: statusFilter === 'my_tasks' ? 700 : 500,
                border: 'none',
                borderRadius: 4,
                backgroundColor: statusFilter === 'my_tasks' ? '#ffffff' : 'transparent',
                color: statusFilter === 'my_tasks' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                boxShadow: statusFilter === 'my_tasks' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>My Tasks</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: statusFilter === 'my_tasks' ? '#a8231b' : '#94a3b8' }}>
                ({countMine})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('open')}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: statusFilter === 'open' ? 700 : 500,
                border: 'none',
                borderRadius: 4,
                backgroundColor: statusFilter === 'open' ? '#ffffff' : 'transparent',
                color: statusFilter === 'open' ? '#047857' : '#64748b',
                cursor: 'pointer',
                boxShadow: statusFilter === 'open' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Sparkles size={11} color={countOpen > 0 ? '#059669' : '#94a3b8'} />
              <span>Claim Pool</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: countOpen > 0 ? '#059669' : '#94a3b8' }}>
                ({countOpen})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('needed')}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: statusFilter === 'needed' ? 700 : 500,
                border: 'none',
                borderRadius: 4,
                backgroundColor: statusFilter === 'needed' ? '#ffffff' : 'transparent',
                color: statusFilter === 'needed' ? '#b45309' : '#64748b',
                cursor: 'pointer',
                boxShadow: statusFilter === 'needed' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>Action Needed</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: statusFilter === 'needed' ? '#b45309' : '#94a3b8' }}>
                ({countNeeded})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('attached')}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: statusFilter === 'attached' ? 700 : 500,
                border: 'none',
                borderRadius: 4,
                backgroundColor: statusFilter === 'attached' ? '#ffffff' : 'transparent',
                color: statusFilter === 'attached' ? '#1d4ed8' : '#64748b',
                cursor: 'pointer',
                boxShadow: statusFilter === 'attached' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>Under Review</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: statusFilter === 'attached' ? '#1d4ed8' : '#94a3b8' }}>
                ({countAttached})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: statusFilter === 'all' ? 700 : 500,
                border: 'none',
                borderRadius: 4,
                backgroundColor: statusFilter === 'all' ? '#ffffff' : 'transparent',
                color: statusFilter === 'all' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                boxShadow: statusFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <span>All ({countTotal})</span>
            </button>
          </div>

          {/* ── Search Input ──────── */}
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search by client name, passport, VIN, order code, or doc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: 38,
                padding: '0 12px 0 34px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* ── Feedback Alerts ──────────────────────────────────────────────── */}
        {successToast && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              fontSize: 12,
              marginBottom: 12,
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

        {error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 12,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Loading State ────────────────────────────────────────────────── */}
        {loading && (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: '#64748b',
              backgroundColor: '#ffffff',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <RefreshCw size={20} className="spin-animate" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 13, fontWeight: 500 }}>Loading operations worklist...</div>
          </div>
        )}

        {/* ── Empty State ──────────────────────────────────────────────────── */}
        {!loading && groupedOrders.length === 0 && (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <Package size={32} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>No tasks found</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
              {statusFilter === 'open'
                ? 'No open tasks available to claim at this moment.'
                : statusFilter === 'my_tasks'
                ? 'You have no assigned tasks in your personal worklist.'
                : `No tasks found matching current filter.`}
            </div>
            {statusFilter !== 'open' && countOpen > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('open')}
                style={{
                  marginTop: 12,
                  padding: '6px 14px',
                  borderRadius: 5,
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Sparkles size={13} />
                <span>View {countOpen} Open Task(s) in Claim Pool</span>
              </button>
            )}
          </div>
        )}

        {/* ── Grouped Orders List ──────────────────────────────────────────── */}
        {!loading && groupedOrders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groupedOrders.map((group) => {
              const isExpanded = Boolean(expandedOrders[group.key]);
              const orderInfo = group.order || {};
              const clientFullName = `${orderInfo.firstName || ''} ${orderInfo.lastName || ''}`.trim() || 'Client';

              const orderClaimableCount = group.lines.filter((l) => l.isClaimable).length;
              const orderActionNeededCount = group.lines.filter((l) => l.status === 'needed' && !l.isClaimable).length;
              const orderUnackCount = group.lines.filter(
                (l) => (l.isMine || (!l.isClaimable && l.assignedAssociate)) && !l.isAcknowledged
              ).length;

              return (
                <div
                  key={group.key}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Order Accordion Header */}
                  <div
                    onClick={() => toggleOrderAccordion(group.key)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isExpanded ? '#f8fafc' : '#ffffff',
                      borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                      transition: 'background-color 0.15s ease',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 240 }}>
                      <div style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              backgroundColor: '#e2e8f0',
                              color: '#0f172a',
                              padding: '1px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {orderInfo.trackingCode || group.key}
                          </span>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                            {clientFullName}
                          </span>
                        </div>

                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{orderInfo.carBrand ? `${orderInfo.carBrand} ` : ''}{orderInfo.carModel || 'Vehicle'}</span>
                          {orderInfo.vin && (
                            <>
                              <span>•</span>
                              <span style={{ fontFamily: 'monospace' }}>VIN: {orderInfo.vin}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Status tags */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {orderClaimableCount > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 4,
                            backgroundColor: '#ecfdf5',
                            color: '#047857',
                            border: '1px solid #a7f3d0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Sparkles size={11} />
                          <span>{orderClaimableCount} to claim</span>
                        </span>
                      )}

                      {orderUnackCount > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 4,
                            backgroundColor: '#fffbeb',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                          }}
                        >
                          {orderUnackCount} awaiting ack
                        </span>
                      )}

                      {orderActionNeededCount > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 4,
                            backgroundColor: '#fef2f2',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                          }}
                        >
                          {orderActionNeededCount} action needed
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: '2px 7px',
                          borderRadius: 4,
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                        }}
                      >
                        {group.lines.length} doc{group.lines.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Quiet Client Dossier Bar */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: 5,
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: 11.5,
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <CreditCard size={13} color="#64748b" />
                          <span style={{ color: '#64748b' }}>Passport:</span>
                          <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>
                            {orderInfo.passportNumber || '—'}
                          </strong>
                          {orderInfo.passportNumber && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(orderInfo.passportNumber, `pass-${group.key}`);
                              }}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '1px 3px', color: copiedKey === `pass-${group.key}` ? '#16a34a' : '#94a3b8' }}
                              title="Copy Passport"
                            >
                              {copiedKey === `pass-${group.key}` ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                          )}
                        </div>

                        {orderInfo.address && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 160 }}>
                            <MapPin size={13} color="#64748b" style={{ flexShrink: 0 }} />
                            <span style={{ color: '#64748b' }}>Address:</span>
                            <span style={{ color: '#0f172a', fontWeight: 500, wordBreak: 'break-word' }}>
                              {orderInfo.address}
                            </span>
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Car size={13} color="#64748b" />
                          <span style={{ color: '#64748b' }}>VIN:</span>
                          <strong style={{ fontFamily: 'monospace', color: '#a8231b' }}>
                            {orderInfo.vin || '—'}
                          </strong>
                          {orderInfo.vin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(orderInfo.vin, `vin-${group.key}`);
                              }}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '1px 3px', color: copiedKey === `vin-${group.key}` ? '#16a34a' : '#94a3b8' }}
                              title="Copy VIN"
                            >
                              {copiedKey === `vin-${group.key}` ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Documents List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {group.lines.map((line) => {
                          const isClaimable = line.isClaimable;
                          const isNeeded = line.status === 'needed';
                          const isAttached = line.status === 'attached';
                          const hasRejection = Boolean(line.lastRejectionNote);
                          const isAssignedToMe = line.isMine || (!line.isClaimable && line.assignedAssociate);
                          const needsAcknowledgment = isAssignedToMe && !line.isAcknowledged;

                          return (
                            <div
                              key={line.id}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 6,
                                border: '1px solid #e2e8f0',
                                backgroundColor: isClaimable ? '#fcfdfd' : '#ffffff',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: 8,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
                                  <FileText size={15} color={isClaimable ? '#059669' : '#0284c7'} />
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                                      {line.documentType?.fullName || 'Customs Document'}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>
                                      {line.documentType?.code ? `Code: ${line.documentType.code}` : ''}
                                      {line.translationMode === 'original_plus_translation'
                                        ? ' • Orig + Translation'
                                        : line.translationMode === 'translation_only'
                                        ? ' • Translation Only'
                                        : ' • Original Only'}
                                    </div>
                                  </div>
                                </div>

                                {/* Right Side Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {isClaimable ? (
                                    <button
                                      type="button"
                                      onClick={() => handleClaim(line)}
                                      disabled={claimBusyId === line.id}
                                      style={{
                                        padding: '4px 12px',
                                        borderRadius: 5,
                                        border: 'none',
                                        backgroundColor: '#059669',
                                        color: '#ffffff',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        cursor: claimBusyId === line.id ? 'not-allowed' : 'pointer',
                                      }}
                                    >
                                      {claimBusyId === line.id ? (
                                        <RefreshCw size={12} className="spin-animate" />
                                      ) : (
                                        <Sparkles size={12} />
                                      )}
                                      <span>Claim Task</span>
                                    </button>
                                  ) : (
                                    <>
                                      {needsAcknowledgment ? (
                                        <button
                                          type="button"
                                          onClick={() => handleAcknowledge(line)}
                                          disabled={ackBusyId === line.id}
                                          style={{
                                            padding: '4px 10px',
                                            borderRadius: 5,
                                            border: 'none',
                                            backgroundColor: '#b45309',
                                            color: '#ffffff',
                                            fontSize: 11.5,
                                            fontWeight: 600,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            cursor: ackBusyId === line.id ? 'not-allowed' : 'pointer',
                                          }}
                                          title="Confirm receipt to start working on this task"
                                        >
                                          {ackBusyId === line.id ? (
                                            <RefreshCw size={12} className="spin-animate" />
                                          ) : (
                                            <Check size={12} />
                                          )}
                                          <span>Acknowledge</span>
                                        </button>
                                      ) : (
                                        line.isAcknowledged && (
                                          <span
                                            style={{
                                              fontSize: 11,
                                              color: '#16a34a',
                                              fontWeight: 600,
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 3,
                                            }}
                                          >
                                            <Check size={11} /> Ack
                                          </span>
                                        )
                                      )}

                                      {isNeeded ? (
                                        <button
                                          type="button"
                                          onClick={() => openAttachModal(line)}
                                          style={{
                                            padding: '4px 10px',
                                            borderRadius: 5,
                                            border: 'none',
                                            backgroundColor: '#a8231b',
                                            color: '#ffffff',
                                            fontSize: 11.5,
                                            fontWeight: 600,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            cursor: 'pointer',
                                          }}
                                        >
                                          <Camera size={12} />
                                          <span>Attach</span>
                                        </button>
                                      ) : isAttached ? (
                                        <span
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            padding: '2px 7px',
                                            borderRadius: 4,
                                            backgroundColor: '#eff6ff',
                                            color: '#1d4ed8',
                                            border: '1px solid #bfdbfe',
                                          }}
                                        >
                                          Awaiting Review
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            padding: '2px 7px',
                                            borderRadius: 4,
                                            backgroundColor: '#f0fdf4',
                                            color: '#16a34a',
                                            border: '1px solid #bbf7d0',
                                          }}
                                        >
                                          {line.status}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Rejection Note */}
                              {hasRejection && (
                                <div
                                  style={{
                                    padding: '5px 8px',
                                    borderRadius: 4,
                                    backgroundColor: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    color: '#991b1b',
                                    fontSize: 11.5,
                                  }}
                                >
                                  <strong>Revision Requested:</strong> {line.lastRejectionNote}
                                </div>
                              )}

                              {/* Attached File Chip */}
                              {line.uploadedFiles && line.uploadedFiles.length > 0 && (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    backgroundColor: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    fontSize: 11,
                                    width: 'fit-content',
                                  }}
                                >
                                  <FileText size={12} color="#a8231b" />
                                  <span style={{ fontWeight: 500, color: '#0f172a' }}>
                                    {line.uploadedFiles[0]?.filename}
                                  </span>
                                  {line.trackingCode && (
                                    <span style={{ color: '#64748b' }}>({line.trackingCode})</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(line.uploadedFiles[0].id, line.uploadedFiles[0].filename)}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#a8231b',
                                      cursor: 'pointer',
                                      padding: '1px 3px',
                                    }}
                                    title="Download File"
                                  >
                                    <Download size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Attach Modal with Mobile Camera Capture ────────────────────────── */}
      {attachModalLine && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAttachModal();
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 10,
              width: '100%',
              maxWidth: 480,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 20,
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Attach Document
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                  {attachModalLine.documentType?.fullName}
                </div>
              </div>
              <button
                type="button"
                onClick={closeAttachModal}
                disabled={attachBusy}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {attachError && (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 5,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AlertTriangle size={14} />
                <span>{attachError}</span>
              </div>
            )}

            <form onSubmit={handleAttachSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {!attachFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: 8,
                    padding: '20px 14px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Camera size={24} color="#a8231b" />
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                    Take Photo or Select File
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>
                    Camera, image or PDF (Max 12MB)
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    padding: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {filePreviewUrl ? (
                    <img
                      src={filePreviewUrl}
                      alt="Preview"
                      style={{
                        width: '100%',
                        maxHeight: 180,
                        objectFit: 'contain',
                        borderRadius: 4,
                        backgroundColor: '#0f172a',
                      }}
                    />
                  ) : (
                    <div style={{ padding: 12, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                      <FileText size={24} color="#a8231b" style={{ margin: '0 auto 4px' }} />
                      <div>{attachFile.name}</div>
                      <div>{Math.round(attachFile.size / 1024)} KB</div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11.5, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                      {attachFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <RotateCcw size={11} /> Retake
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                  Waybill / Tracking Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SF-EXPRESS-998877"
                  value={attachTrackingCode}
                  onChange={(e) => setAttachTrackingCode(e.target.value)}
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 5,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                  Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Original stamped document"
                  value={attachNote}
                  onChange={(e) => setAttachNote(e.target.value)}
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 5,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={closeAttachModal}
                  disabled={attachBusy}
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 5,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: attachBusy ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={attachBusy || !attachFile}
                  style={{
                    flex: 2,
                    height: 36,
                    borderRadius: 5,
                    border: 'none',
                    backgroundColor: attachBusy || !attachFile ? '#cbd5e1' : '#a8231b',
                    color: '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: attachBusy || !attachFile ? 'not-allowed' : 'pointer',
                  }}
                >
                  {attachBusy ? (
                    <>
                      <RefreshCw size={13} className="spin-animate" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={13} />
                      <span>Confirm & Attach</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
