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
} from 'lucide-react';

export default function ChinaPortalPage() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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
      const res = await fetch('/api/china/lines', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to load assigned lines queue');
      }
      const data = await res.json();
      setLines(Array.isArray(data) ? data : []);
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

  // Filtered Lines
  const filteredLines = lines.filter((line) => {
    if (statusFilter === 'needed' && line.status !== 'needed') return false;
    if (statusFilter === 'attached' && line.status !== 'attached') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const vinMatch = line.order?.vin?.toLowerCase().includes(q);
      const orderTrackMatch = line.order?.trackingCode?.toLowerCase().includes(q);
      const modelMatch = line.order?.carModel?.toLowerCase().includes(q);
      const docMatch = line.documentType?.fullName?.toLowerCase().includes(q);
      const codeMatch = line.documentType?.code?.toLowerCase().includes(q);
      const trackMatch = line.trackingCode?.toLowerCase().includes(q);
      return vinMatch || orderTrackMatch || modelMatch || docMatch || codeMatch || trackMatch;
    }
    return true;
  });

  // Counters
  const countTotal = lines.length;
  const countNeeded = lines.filter((l) => l.status === 'needed').length;
  const countAttached = lines.filter((l) => l.status === 'attached').length;

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
      {/* ── Sticky Top Bar: Associate Name + Logout (Min 48px tap targets) ──── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 16px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              backgroundColor: '#a8231b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '0.04em',
            }}
          >
            DZ
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
              China Ops
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
            minHeight: 48,
            minWidth: 48,
            padding: '0 14px',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#475569',
            fontSize: 13,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
          title="Sign out of console"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </header>

      {/* ── Main Content Container ─────────────────────────────────────────── */}
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 48px 16px' }}>
        {/* Title & Refresh */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Document Tasks
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0 0' }}>
              Upload and verify documents delegated to your station
            </p>
          </div>
          <button
            type="button"
            onClick={fetchLines}
            disabled={loading}
            style={{
              minHeight: 48,
              minWidth: 48,
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
            <RefreshCw size={16} className={loading ? 'spin-animate' : ''} />
          </button>
        </div>

        {/* ── Horizontal Scrollable Filter Tabs (Min 48px tap height) ──────── */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
            marginBottom: 14,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            style={{
              minHeight: 48,
              padding: '0 18px',
              borderRadius: 24,
              border: '1px solid',
              borderColor: statusFilter === 'all' ? '#a8231b' : '#e2e8f0',
              backgroundColor: statusFilter === 'all' ? '#a8231b' : '#ffffff',
              color: statusFilter === 'all' ? '#ffffff' : '#475569',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>All</span>
            <span
              style={{
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 10,
                backgroundColor: statusFilter === 'all' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                color: statusFilter === 'all' ? '#ffffff' : '#475569',
              }}
            >
              {countTotal}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('needed')}
            style={{
              minHeight: 48,
              padding: '0 18px',
              borderRadius: 24,
              border: '1px solid',
              borderColor: statusFilter === 'needed' ? '#b45309' : '#e2e8f0',
              backgroundColor: statusFilter === 'needed' ? '#fffbeb' : '#ffffff',
              color: statusFilter === 'needed' ? '#b45309' : '#475569',
              fontSize: 13,
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
                padding: '2px 6px',
                borderRadius: 10,
                backgroundColor: statusFilter === 'needed' ? '#fde68a' : '#f1f5f9',
                color: statusFilter === 'needed' ? '#92400e' : '#475569',
              }}
            >
              {countNeeded}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('attached')}
            style={{
              minHeight: 48,
              padding: '0 18px',
              borderRadius: 24,
              border: '1px solid',
              borderColor: statusFilter === 'attached' ? '#1d4ed8' : '#e2e8f0',
              backgroundColor: statusFilter === 'attached' ? '#eff6ff' : '#ffffff',
              color: statusFilter === 'attached' ? '#1d4ed8' : '#475569',
              fontSize: 13,
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
                padding: '2px 6px',
                borderRadius: 10,
                backgroundColor: statusFilter === 'attached' ? '#bfdbfe' : '#f1f5f9',
                color: statusFilter === 'attached' ? '#1e40af' : '#475569',
              }}
            >
              {countAttached}
            </span>
          </button>
        </div>

        {/* ── Search Bar (Min 48px height) ──────────────────────────────────── */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search order code, VIN, document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              minHeight: 48,
              padding: '0 14px 0 42px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ── Error Banner ──────────────────────────────────────────────────── */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={18} />
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
            <div style={{ fontSize: 14, fontWeight: 500 }}>Loading assigned queue...</div>
          </div>
        )}

        {/* ── Empty State ───────────────────────────────────────────────────── */}
        {!loading && filteredLines.length === 0 && (
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
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>No tasks found</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              {statusFilter === 'all'
                ? 'You have no document lines in your queue at this moment.'
                : `No tasks found matching status filter "${statusFilter}".`}
            </div>
          </div>
        )}

        {/* ── Mobile-First Stacked Card List (One card per document line) ─── */}
        {!loading && filteredLines.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredLines.map((line) => {
              const isNeeded = line.status === 'needed';
              const isAttached = line.status === 'attached';
              const hasRejection = Boolean(line.lastRejectionNote);

              return (
                <div
                  key={line.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid',
                    borderColor: hasRejection ? '#fca5a5' : '#e2e8f0',
                    borderRadius: 8,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  {/* Card Header: Doc Name + Status Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                        {line.documentType?.fullName || 'Customs Document'}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: 'ui-monospace, monospace',
                          color: '#64748b',
                          marginTop: 2,
                        }}
                      >
                        {line.documentType?.code || line.id}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div style={{ flexShrink: 0 }}>
                      {isNeeded ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: 14,
                            backgroundColor: '#fffbeb',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <AlertTriangle size={12} />
                          <span>Action Needed</span>
                        </span>
                      ) : isAttached ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: 14,
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Clock size={12} />
                          <span>Sent — In Review</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: 14,
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {line.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Rejection Note: Visible Inline Banner ────────────────── */}
                  {hasRejection && (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 6,
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#991b1b',
                        fontSize: 12,
                        lineHeight: 1.4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 2 }}>
                        <AlertTriangle size={14} color="#dc2626" />
                        <span>Admin Requested Revision</span>
                      </div>
                      <div>{line.lastRejectionNote}</div>
                    </div>
                  )}

                  {/* ── Order & Vehicle Info Grid ───────────────────────────── */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: 8,
                      padding: '10px 12px',
                      borderRadius: 6,
                      backgroundColor: '#f8fafc',
                      border: '1px solid #f1f5f9',
                      fontSize: 12,
                    }}
                  >
                    {/* Order Code */}
                    <div>
                      <div style={{ color: '#64748b', fontSize: 11 }}>Order Code</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                          {line.order?.trackingCode || '—'}
                        </span>
                        {line.order?.trackingCode && (
                          <button
                            type="button"
                            onClick={() => handleCopy(line.order.trackingCode, `order-${line.id}`)}
                            title="Copy Order Code"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: copiedKey === `order-${line.id}` ? '#15803d' : '#64748b',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'inline-flex',
                            }}
                          >
                            {copiedKey === `order-${line.id}` ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* VIN */}
                    <div>
                      <div style={{ color: '#64748b', fontSize: 11 }}>Vehicle VIN</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                          {line.order?.vin || 'N/A'}
                        </span>
                        {line.order?.vin && (
                          <button
                            type="button"
                            onClick={() => handleCopy(line.order.vin, `vin-${line.id}`)}
                            title="Copy VIN"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: copiedKey === `vin-${line.id}` ? '#15803d' : '#64748b',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'inline-flex',
                            }}
                          >
                            {copiedKey === `vin-${line.id}` ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Car Model */}
                    <div>
                      <div style={{ color: '#64748b', fontSize: 11 }}>Model</div>
                      <div style={{ fontWeight: 500, color: '#0f172a', marginTop: 1 }}>
                        {line.order?.carModel || '—'}
                      </div>
                    </div>

                    {/* Translation Mode */}
                    <div>
                      <div style={{ color: '#64748b', fontSize: 11 }}>Translation</div>
                      <div style={{ fontWeight: 500, color: '#0f172a', marginTop: 1 }}>
                        {line.translationMode === 'original_plus_translation'
                          ? 'Orig + Translation'
                          : line.translationMode === 'translation_only'
                          ? 'Translation Only'
                          : 'Original Only'}
                      </div>
                    </div>
                  </div>

                  {/* ── Attached File Preview / Details (if attached) ───────── */}
                  {line.uploadedFiles && line.uploadedFiles.length > 0 && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <FileText size={16} color="#a8231b" style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 220,
                            }}
                          >
                            {line.uploadedFiles[0]?.filename || 'Uploaded Document'}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {line.uploadedFiles[0]?.size
                              ? `${Math.round(line.uploadedFiles[0].size / 1024)} KB`
                              : ''}
                            {line.trackingCode ? ` • Tracking: ${line.trackingCode}` : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadFile(line.uploadedFiles[0].id, line.uploadedFiles[0].filename)
                        }
                        style={{
                          minHeight: 48,
                          minWidth: 48,
                          padding: '0 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: 'none',
                          background: 'transparent',
                          color: '#a8231b',
                          cursor: 'pointer',
                        }}
                        title="Download or view file"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  )}

                  {/* ── Primary Action Button (Min 48px tap target) ─────────── */}
                  <div>
                    {isNeeded ? (
                      <button
                        type="button"
                        onClick={() => openAttachModal(line)}
                        style={{
                          width: '100%',
                          minHeight: 48,
                          borderRadius: 6,
                          border: 'none',
                          backgroundColor: '#a8231b',
                          color: '#ffffff',
                          fontSize: 14,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(168, 35, 27, 0.2)',
                        }}
                      >
                        <Camera size={18} />
                        <span>Attach Document / Photo</span>
                      </button>
                    ) : isAttached ? (
                      <div
                        style={{
                          width: '100%',
                          minHeight: 48,
                          borderRadius: 6,
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          color: '#475569',
                          fontSize: 13,
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <Clock size={16} color="#1d4ed8" />
                        <span>Sent — Awaiting Admin Review</span>
                      </div>
                    ) : null}
                  </div>
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
                  minHeight: 48,
                  minWidth: 48,
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

              {/* ── Photo Capture Dropzone / Preview ───────────────────────── */}
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
                /* ── Image Thumbnail Preview with Retake Option ──────────── */
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
                        minHeight: 48,
                        padding: '0 14px',
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        fontSize: 13,
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

              {/* ── Courier Tracking Code (Optional) ───────────────────────── */}
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
                    minHeight: 48,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* ── Logistics Note (Optional) ─────────────────────────────── */}
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
                  placeholder="e.g. Fresh scan from exporter office..."
                  value={attachNote}
                  onChange={(e) => setAttachNote(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 48,
                    padding: '10px 12px',
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

              {/* ── Action Buttons ─────────────────────────────────────────── */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={closeAttachModal}
                  disabled={attachBusy}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: 14,
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
                    minHeight: 48,
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: attachBusy || !attachFile ? '#cbd5e1' : '#a8231b',
                    color: '#ffffff',
                    fontSize: 14,
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
                      <RefreshCw size={16} className="spin-animate" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
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
