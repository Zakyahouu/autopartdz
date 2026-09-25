import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Camera,
  Upload,
  FileText,
  Check,
  Copy,
  Clock,
  AlertTriangle,
  Search,
  LogOut,
  RefreshCw,
  X,
  Download,
  Package,
  RotateCcw,
  User,
  Car,
  MapPin,
  CreditCard,
  CheckCircle2,
  Bell,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
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

  // Claim & Acknowledge Busy IDs
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

  // Handle object URL creation and cleanup for image preview
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

  // Submit Attach Action (needed → attached)
  const handleAttachSubmit = async (e) => {
    e.preventDefault();
    if (!attachFile) {
      setAttachError('Please take a photo or select a document file.');
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

  // Download / View File Helper
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
      const clientMatch = `${line.order?.firstName || ''} ${line.order?.lastName || ''}`
        .toLowerCase()
        .includes(q);
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

  // ── Two-Level Accordion: Group lines by Order / Vehicle / Client ─────────
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
      {/* ── Sticky Top Header ──── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 16px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: '#a8231b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            DZ
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
              China Ops Station
            </div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.2 }}>
              {user?.name || 'Associate'} {user?.role === 'admin' && '(Admin)'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          style={{
            minHeight: 40,
            padding: '0 12px',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#475569',
            fontSize: 12.5,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
          title="Sign out of console"
        >
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </header>

      {/* ── Main Content Container ─────────────────────────────────────────── */}
      <main style={{ maxWidth: 840, margin: '0 auto', padding: '16px 16px 48px 16px' }}>
        {/* Title, Search & Global Actions Bar */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Operations Queue
              </h1>
              <p style={{ fontSize: 12.5, color: '#64748b', margin: '2px 0 0 0' }}>
                Grouped by client & vehicle dossiers with collapsible document checklists
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => expandAll(allOrderKeys)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
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
                <Maximize2 size={13} />
                <span>Expand All</span>
              </button>

              <button
                type="button"
                onClick={collapseAll}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
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
                <Minimize2 size={13} />
                <span>Collapse All</span>
              </button>

              <button
                type="button"
                onClick={fetchLines}
                disabled={loading}
                style={{
                  minHeight: 36,
                  minWidth: 36,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                title="Refresh tasks"
              >
                <RefreshCw size={14} className={loading ? 'spin-animate' : ''} />
              </button>
            </div>
          </div>

          {/* ── Streamlined Filter Tabs ──────── */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 4,
              marginBottom: 12,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <button
              type="button"
              onClick={() => setStatusFilter('my_tasks')}
              style={{
                minHeight: 40,
                padding: '0 16px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: statusFilter === 'my_tasks' ? '#a8231b' : '#e2e8f0',
                backgroundColor: statusFilter === 'my_tasks' ? '#a8231b' : '#ffffff',
                color: statusFilter === 'my_tasks' ? '#ffffff' : '#475569',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>My Tasks</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  backgroundColor: statusFilter === 'my_tasks' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                  color: statusFilter === 'my_tasks' ? '#ffffff' : '#475569',
                  fontWeight: 700,
                }}
              >
                {countMine}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('open')}
              style={{
                minHeight: 40,
                padding: '0 16px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: statusFilter === 'open' ? '#059669' : countOpen > 0 ? '#6ee7b7' : '#e2e8f0',
                backgroundColor: statusFilter === 'open' ? '#059669' : countOpen > 0 ? '#ecfdf5' : '#ffffff',
                color: statusFilter === 'open' ? '#ffffff' : countOpen > 0 ? '#065f46' : '#475569',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Sparkles size={13} />
              <span>Open to Claim</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  backgroundColor: statusFilter === 'open' ? 'rgba(255,255,255,0.25)' : '#d1fae5',
                  color: statusFilter === 'open' ? '#ffffff' : '#047857',
                  fontWeight: 700,
                }}
              >
                {countOpen}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('needed')}
              style={{
                minHeight: 40,
                padding: '0 16px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: statusFilter === 'needed' ? '#b45309' : '#e2e8f0',
                backgroundColor: statusFilter === 'needed' ? '#fffbeb' : '#ffffff',
                color: statusFilter === 'needed' ? '#b45309' : '#475569',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Action Needed</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  backgroundColor: statusFilter === 'needed' ? '#fde68a' : '#f1f5f9',
                  color: statusFilter === 'needed' ? '#92400e' : '#475569',
                  fontWeight: 700,
                }}
              >
                {countNeeded}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('attached')}
              style={{
                minHeight: 40,
                padding: '0 16px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: statusFilter === 'attached' ? '#1d4ed8' : '#e2e8f0',
                backgroundColor: statusFilter === 'attached' ? '#eff6ff' : '#ffffff',
                color: statusFilter === 'attached' ? '#1d4ed8' : '#475569',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Awaiting Review</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  backgroundColor: statusFilter === 'attached' ? '#bfdbfe' : '#f1f5f9',
                  color: statusFilter === 'attached' ? '#1e40af' : '#475569',
                  fontWeight: 700,
                }}
              >
                {countAttached}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              style={{
                minHeight: 40,
                padding: '0 16px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: statusFilter === 'all' ? '#334155' : '#e2e8f0',
                backgroundColor: statusFilter === 'all' ? '#334155' : '#ffffff',
                color: statusFilter === 'all' ? '#ffffff' : '#475569',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>All Tasks</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  backgroundColor: statusFilter === 'all' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                  color: statusFilter === 'all' ? '#ffffff' : '#475569',
                  fontWeight: 700,
                }}
              >
                {countTotal}
              </span>
            </button>
          </div>

          {/* ── Search Input ────────────────────────────────────────── */}
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search by client name, passport, VIN, order code, doc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                minHeight: 42,
                padding: '0 14px 0 38px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                fontSize: 13.5,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* ── Toast Success Message ─────────────────────────────────────────── */}
        {successToast && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              fontSize: 12.5,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 500,
            }}
          >
            <CheckCircle2 size={16} color="#059669" />
            <span>{successToast}</span>
          </div>
        )}

        {/* ── Error Banner ──────────────────────────────────────────────────── */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 12.5,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Loading Skeleton / State ──────────────────────────────────────── */}
        {loading && (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: '#64748b',
              backgroundColor: '#ffffff',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <RefreshCw size={24} className="spin-animate" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 500 }}>Loading operations queue...</div>
          </div>
        )}

        {/* ── Empty State ───────────────────────────────────────────────────── */}
        {!loading && groupedOrders.length === 0 && (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <Package size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>No orders found</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              {statusFilter === 'open'
                ? 'No open tasks available to claim at this moment.'
                : statusFilter === 'my_tasks'
                ? 'You have no assigned tasks in your personal worklist.'
                : `No tasks found matching filter "${statusFilter}".`}
            </div>
            {statusFilter !== 'open' && countOpen > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('open')}
                style={{
                  marginTop: 14,
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Sparkles size={14} />
                <span>View {countOpen} Open Task(s) in Claim Pool</span>
              </button>
            )}
          </div>
        )}

        {/* ── TWO-LEVEL ACCORDION LIST: Grouped by Order / Client ────────────── */}
        {!loading && groupedOrders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groupedOrders.map((group) => {
              const isExpanded = Boolean(expandedOrders[group.key]);
              const orderInfo = group.order || {};
              const clientFullName = `${orderInfo.firstName || ''} ${orderInfo.lastName || ''}`.trim() || 'Client';

              const orderClaimableCount = group.lines.filter((l) => l.isClaimable).length;
              const orderActionNeededCount = group.lines.filter((l) => l.status === 'needed' && !l.isClaimable).length;
              const orderAttachedCount = group.lines.filter((l) => l.status === 'attached').length;
              const orderUnackCount = group.lines.filter(
                (l) => (l.isMine || (!l.isClaimable && l.assignedAssociate)) && !l.isAcknowledged
              ).length;

              return (
                <div
                  key={group.key}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: orderClaimableCount > 0 ? '#6ee7b7' : orderUnackCount > 0 ? '#fde68a' : '#e2e8f0',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                    overflow: 'hidden',
                  }}
                >
                  {/* ── Accordion Header (Level 1: Order / Vehicle / Client) ──── */}
                  <div
                    onClick={() => toggleOrderAccordion(group.key)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isExpanded ? '#f8fafc' : '#ffffff',
                      borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                      transition: 'background-color 0.15s ease',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 260 }}>
                      <div
                        style={{
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              backgroundColor: '#e2e8f0',
                              color: '#0f172a',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {orderInfo.trackingCode || group.key}
                          </span>

                          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                            {clientFullName}
                          </span>
                        </div>

                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span>{orderInfo.carModel || 'Vehicle'}</span>
                          <span>•</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>VIN: {orderInfo.vin || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Summary Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {orderClaimableCount > 0 && (
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 12,
                            backgroundColor: '#ecfdf5',
                            color: '#065f46',
                            border: '1px solid #a7f3d0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Sparkles size={12} />
                          <span>{orderClaimableCount} Open to Claim</span>
                        </span>
                      )}

                      {orderUnackCount > 0 && (
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 12,
                            backgroundColor: '#fffbeb',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Bell size={12} />
                          <span>{orderUnackCount} Awaiting Ack</span>
                        </span>
                      )}

                      {orderActionNeededCount > 0 && (
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 12,
                            backgroundColor: '#fef2f2',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <AlertTriangle size={12} />
                          <span>{orderActionNeededCount} Action Needed</span>
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 12,
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                        }}
                      >
                        {group.lines.length} {group.lines.length === 1 ? 'doc' : 'docs'}
                      </span>
                    </div>
                  </div>

                  {/* ── Accordion Body (Level 2: Client Dossier Strip + Document Checklist) ──── */}
                  {isExpanded && (
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Shared Client Details Ribbon (Displayed ONCE per order, not per line) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 6,
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          fontSize: 12,
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CreditCard size={14} color="#64748b" />
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
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, color: copiedKey === `pass-${group.key}` ? '#16a34a' : '#64748b' }}
                              title="Copy Passport"
                            >
                              {copiedKey === `pass-${group.key}` ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200 }}>
                          <MapPin size={14} color="#64748b" style={{ flexShrink: 0 }} />
                          <span style={{ color: '#64748b' }}>Delivery Address:</span>
                          <span style={{ color: '#0f172a', fontWeight: 500, wordBreak: 'break-word' }}>
                            {orderInfo.address || '—'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Car size={14} color="#64748b" />
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
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, color: copiedKey === `vin-${group.key}` ? '#16a34a' : '#64748b' }}
                              title="Copy VIN"
                            >
                              {copiedKey === `vin-${group.key}` ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ── Document Rows Inside This Order ──── */}
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
                                padding: '12px 14px',
                                borderRadius: 6,
                                border: '1px solid',
                                borderColor: hasRejection
                                  ? '#fca5a5'
                                  : isClaimable
                                  ? '#a7f3d0'
                                  : needsAcknowledgment
                                  ? '#fde68a'
                                  : '#e2e8f0',
                                backgroundColor: isClaimable ? '#f0fdf4' : '#ffffff',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                              }}
                            >
                              {/* Row Top: Document Title, Badges & Quick Action */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: 8,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }}>
                                  <FileText size={16} color={isClaimable ? '#059669' : '#a8231b'} />
                                  <div>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                                      {line.documentType?.fullName || 'Customs Document'}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>
                                      {line.documentType?.code ? `Code: ${line.documentType.code}` : ''}
                                      {line.documentType?.category && ` • ${line.documentType.category}`}
                                      {` • ${
                                        line.translationMode === 'original_plus_translation'
                                          ? 'Orig + Translation'
                                          : line.translationMode === 'translation_only'
                                          ? 'Translation Only'
                                          : 'Original Only'
                                      }`}
                                    </div>
                                  </div>
                                </div>

                                {/* Right Side: Status Badge + Action */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {isClaimable ? (
                                    <button
                                      type="button"
                                      onClick={() => handleClaim(line)}
                                      disabled={claimBusyId === line.id}
                                      style={{
                                        minHeight: 34,
                                        padding: '0 14px',
                                        borderRadius: 6,
                                        border: 'none',
                                        backgroundColor: '#059669',
                                        color: '#ffffff',
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        cursor: claimBusyId === line.id ? 'not-allowed' : 'pointer',
                                      }}
                                    >
                                      {claimBusyId === line.id ? (
                                        <RefreshCw size={13} className="spin-animate" />
                                      ) : (
                                        <Sparkles size={13} />
                                      )}
                                      <span>Claim</span>
                                    </button>
                                  ) : (
                                    <>
                                      {/* Status Tag */}
                                      {isNeeded ? (
                                        <span
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: 10,
                                            backgroundColor: '#fffbeb',
                                            color: '#b45309',
                                            border: '1px solid #fde68a',
                                          }}
                                        >
                                          Action Needed
                                        </span>
                                      ) : isAttached ? (
                                        <span
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: 10,
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
                                            padding: '2px 8px',
                                            borderRadius: 10,
                                            backgroundColor: '#f1f5f9',
                                            color: '#475569',
                                          }}
                                        >
                                          {line.status}
                                        </span>
                                      )}

                                      {/* Acknowledge Button or Confirmed Tag */}
                                      {needsAcknowledgment ? (
                                        <button
                                          type="button"
                                          onClick={() => handleAcknowledge(line)}
                                          disabled={ackBusyId === line.id}
                                          style={{
                                            minHeight: 32,
                                            padding: '0 10px',
                                            borderRadius: 6,
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
                                          title="Confirm you have received this task and are working on it"
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
                                            <Check size={11} /> Acknowledged
                                          </span>
                                        )
                                      )}

                                      {/* Primary Attach Action */}
                                      {isNeeded && (
                                        <button
                                          type="button"
                                          onClick={() => openAttachModal(line)}
                                          style={{
                                            minHeight: 32,
                                            padding: '0 12px',
                                            borderRadius: 6,
                                            border: 'none',
                                            backgroundColor: '#a8231b',
                                            color: '#ffffff',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                            cursor: 'pointer',
                                          }}
                                        >
                                          <Camera size={13} />
                                          <span>Attach</span>
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Rejection Note Alert if applicable */}
                              {hasRejection && (
                                <div
                                  style={{
                                    padding: '6px 10px',
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

                              {/* Attached File Preview if available */}
                              {line.uploadedFiles && line.uploadedFiles.length > 0 && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 10px',
                                    borderRadius: 4,
                                    backgroundColor: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    fontSize: 11.5,
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                    <FileText size={13} color="#a8231b" />
                                    <span style={{ fontWeight: 600, color: '#0f172a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                      {line.uploadedFiles[0]?.filename}
                                    </span>
                                    {line.trackingCode && (
                                      <span style={{ color: '#64748b' }}>• Waybill: {line.trackingCode}</span>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(line.uploadedFiles[0].id, line.uploadedFiles[0].filename)}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#a8231b',
                                      cursor: 'pointer',
                                      padding: 2,
                                    }}
                                    title="Download File"
                                  >
                                    <Download size={14} />
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

      {/* ── Attach Modal with Camera Capture & Thumbnail Preview ──────────── */}
      {attachModalLine && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 100,
            padding: 0,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAttachModal();
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '20px 20px 28px 20px',
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                  Attach Document
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                  {attachModalLine.documentType?.fullName} ({attachModalLine.order?.vin})
                </div>
              </div>
              <button
                type="button"
                onClick={closeAttachModal}
                disabled={attachBusy}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Error in Modal */}
            {attachError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AlertTriangle size={16} />
                <span>{attachError}</span>
              </div>
            )}

            <form onSubmit={handleAttachSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Native Mobile Camera File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {/* Photo Capture Dropzone / Preview */}
              {!attachFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: 10,
                    padding: '24px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    minHeight: 120,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: '#fef2f2',
                      color: '#a8231b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Camera size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                      Take Photo or Select File
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Opens phone camera or gallery (Max 12MB)
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {filePreviewUrl ? (
                    <div style={{ textAlign: 'center' }}>
                      <img
                        src={filePreviewUrl}
                        alt="Document preview"
                        style={{
                          width: '100%',
                          maxHeight: 200,
                          objectFit: 'contain',
                          borderRadius: 6,
                          backgroundColor: '#0f172a',
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 24,
                        textAlign: 'center',
                        backgroundColor: '#ffffff',
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <FileText size={32} color="#a8231b" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        {attachFile.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {Math.round(attachFile.size / 1024)} KB
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 12, color: '#475569', minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>Selected: </span>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {attachFile.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        minHeight: 40,
                        padding: '0 12px',
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        fontSize: 12.5,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>Retake</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Waybill / Tracking Code */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#475569',
                    marginBottom: 4,
                  }}
                >
                  Waybill / Tracking Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SF-EXPRESS-998877, DHL-12345"
                  value={attachTrackingCode}
                  onChange={(e) => setAttachTrackingCode(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 44,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: 13.5,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Logistics Note */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#475569',
                    marginBottom: 4,
                  }}
                >
                  Note (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Fresh stamp from exporter..."
                  value={attachNote}
                  onChange={(e) => setAttachNote(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 44,
                    padding: '8px 12px',
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

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={closeAttachModal}
                  disabled={attachBusy}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: 13.5,
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
                    minHeight: 44,
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: attachBusy || !attachFile ? '#cbd5e1' : '#a8231b',
                    color: '#ffffff',
                    fontSize: 13.5,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: attachBusy || !attachFile ? 'not-allowed' : 'pointer',
                  }}
                >
                  {attachBusy ? (
                    <>
                      <RefreshCw size={15} className="spin-animate" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={15} />
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
