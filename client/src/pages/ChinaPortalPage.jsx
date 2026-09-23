import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  LogOut,
  RefreshCw,
  FileText,
  Upload,
  X,
  Copy,
  Check,
  Download,
} from 'lucide-react';

export default function ChinaPortalPage() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Attach Document Modal
  const [attachModalLine, setAttachModalLine] = useState(null);
  const [attachFile, setAttachFile] = useState(null);
  const [attachTrackingCode, setAttachTrackingCode] = useState('');
  const [attachNote, setAttachNote] = useState('');
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachError, setAttachError] = useState('');

  const [copiedVin, setCopiedVin] = useState('');
  const [copiedTracking, setCopiedTracking] = useState('');

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
      setLines(data);
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

  const handleCopyVin = (vin) => {
    if (!vin) return;
    navigator.clipboard.writeText(vin);
    setCopiedVin(vin);
    setTimeout(() => setCopiedVin(''), 2000);
  };

  const handleCopyTracking = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedTracking(code);
    setTimeout(() => setCopiedTracking(''), 2000);
  };

  // Submit Attach Action (needed → attached)
  const handleAttachSubmit = async (e) => {
    e.preventDefault();
    if (!attachFile) {
      setAttachError('Please select a file to attach.');
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

      setAttachModalLine(null);
      setAttachFile(null);
      setAttachTrackingCode('');
      setAttachNote('');
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
      const modelMatch = line.order?.carModel?.toLowerCase().includes(q);
      const docMatch = line.documentType?.fullName?.toLowerCase().includes(q);
      const codeMatch = line.documentType?.code?.toLowerCase().includes(q);
      const trackMatch = line.trackingCode?.toLowerCase().includes(q);
      return vinMatch || modelMatch || docMatch || codeMatch || trackMatch;
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
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Top Console Navigation Bar */}
      <header
        style={{
          borderBottom: '1px solid #1e293b',
          backgroundColor: '#090d16',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
              color: '#ffffff',
            }}
          >
            DZ
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em' }}>
              AutopartDZ <span style={{ color: '#d97706' }}>China Operations</span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              China Sourcing & Logistics Console
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
              {user?.name || 'China Associate'}
            </div>
            <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, textTransform: 'uppercase' }}>
              {user?.role === 'admin' ? 'Admin Proxy' : 'China Associate'}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Console Content */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {/* Metric Cards Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Total Assigned Lines</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>{countTotal}</div>
          </div>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>Action Required</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>{countNeeded}</div>
          </div>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase' }}>Awaiting Review</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>{countAttached}</div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 20,
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: 6, backgroundColor: '#090d16', padding: 4, borderRadius: 8, border: '1px solid #1e293b' }}>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: statusFilter === 'all' ? '#334155' : 'transparent',
                color: statusFilter === 'all' ? '#f8fafc' : '#94a3b8',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              All ({countTotal})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('needed')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: statusFilter === 'needed' ? '#d97706' : 'transparent',
                color: statusFilter === 'needed' ? '#ffffff' : '#94a3b8',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Needed ({countNeeded})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('attached')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: statusFilter === 'attached' ? '#0284c7' : 'transparent',
                color: statusFilter === 'attached' ? '#ffffff' : '#94a3b8',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Attached ({countAttached})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search VIN, model, doc, tracking..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid #334155',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Lines Worklist Table */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={24} className="spin-animate" style={{ margin: '0 auto 12px' }} />
              <div>Loading assigned documents queue...</div>
            </div>
          ) : error ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#f87171' }}>
              <AlertTriangle size={24} style={{ margin: '0 auto 8px' }} />
              <div>{error}</div>
            </div>
          ) : filteredLines.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <Package size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>No assigned documents found</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                {statusFilter === 'all'
                  ? 'There are currently no document lines assigned to you in action-required states.'
                  : `No lines currently matching filter "${statusFilter}".`}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', backgroundColor: '#162032', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>Document</th>
                    <th style={{ padding: '12px 16px' }}>Vehicle Info</th>
                    <th style={{ padding: '12px 16px' }}>Translation</th>
                    <th style={{ padding: '12px 16px' }}>Tracking Code</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((line) => {
                    const isNeeded = line.status === 'needed';
                    const isAttached = line.status === 'attached';

                    return (
                      <tr
                        key={line.id}
                        style={{
                          borderBottom: '1px solid #273549',
                          background: line.lastRejectionNote ? 'rgba(220,38,38,0.04)' : undefined,
                        }}
                      >
                        {/* Document */}
                        <td style={{ padding: '14px 16px' }}>
                          {/* Rejection revision banner if present */}
                          {line.lastRejectionNote && (
                            <div
                              style={{
                                marginBottom: 8,
                                padding: '6px 10px',
                                borderRadius: 6,
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#fca5a5',
                                fontSize: 11,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <AlertTriangle size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                              <span>
                                <strong>Admin requested revision:</strong> {line.lastRejectionNote}
                              </span>
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                              {line.documentType?.fullName || 'Customs Document'}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>
                            {line.documentType?.code || line.id}
                          </div>

                          {/* Uploaded Documents List */}
                          {line.uploadedFiles && line.uploadedFiles.length > 0 && (
                            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FileText size={11} />
                                <span>Attached File ({line.uploadedFiles.length}):</span>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {line.uploadedFiles.map((f) => {
                                  const uploader = f.uploadedBy?.name || 'Associate';
                                  const uploadDate = f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString() : '';
                                  const fileSizeKb = f.size ? `${Math.round(f.size / 1024)} KB` : '';
                                  return (
                                    <div
                                      key={f.id}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        backgroundColor: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: 4,
                                        padding: '2px 8px',
                                        fontSize: 11,
                                      }}
                                    >
                                      <FileText size={11} color="#d97706" />
                                      <span
                                        style={{
                                          color: '#f8fafc',
                                          maxWidth: 140,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                        title={f.filename}
                                      >
                                        {f.filename}
                                      </span>
                                      <span style={{ fontSize: 10, color: '#64748b' }}>
                                        {fileSizeKb && `(${fileSizeKb})`} • {uploader} • {uploadDate}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadFile(f.id, f.filename)}
                                        style={{
                                          border: 'none',
                                          background: 'transparent',
                                          cursor: 'pointer',
                                          color: '#38bdf8',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          padding: 2,
                                        }}
                                        title="View or download document"
                                      >
                                        <Download size={11} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Vehicle Info */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#38bdf8' }}>
                              {line.order?.vin || 'VIN N/A'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyVin(line.order?.vin)}
                              title="Copy VIN"
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: copiedVin === line.order?.vin ? '#10b981' : '#64748b',
                                cursor: 'pointer',
                                padding: 2,
                              }}
                            >
                              {copiedVin === line.order?.vin ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                            {line.order?.carModel || '—'}
                          </div>
                        </td>

                        {/* Translation Mode */}
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 4,
                              backgroundColor: '#334155',
                              color: '#cbd5e1',
                            }}
                          >
                            {line.translationMode === 'original_plus_translation'
                              ? 'Orig + Translation'
                              : line.translationMode === 'translation_only'
                              ? 'Translation Only'
                              : 'Original Only'}
                          </span>
                        </td>

                        {/* Tracking Code */}
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: line.trackingCode ? '#e2e8f0' : '#64748b' }}>
                          {line.trackingCode ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span>{line.trackingCode}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyTracking(line.trackingCode)}
                                title="Copy tracking code"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: copiedTracking === line.trackingCode ? '#10b981' : '#64748b',
                                  cursor: 'pointer',
                                  padding: 2,
                                }}
                              >
                                {copiedTracking === line.trackingCode ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 12,
                              backgroundColor:
                                isNeeded
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(56, 189, 248, 0.15)',
                              color: isNeeded ? '#f59e0b' : '#38bdf8',
                              border: `1px solid ${
                                isNeeded ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)'
                              }`,
                            }}
                          >
                            {line.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          {isNeeded ? (
                            <button
                              type="button"
                              onClick={() => {
                                setAttachModalLine(line);
                                setAttachFile(null);
                                setAttachTrackingCode(line.trackingCode || '');
                                setAttachNote('');
                                setAttachError('');
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 14px',
                                borderRadius: 6,
                                border: 'none',
                                backgroundColor: '#d97706',
                                color: '#ffffff',
                                fontWeight: 600,
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              <Upload size={13} />
                              <span>Attach Document</span>
                            </button>
                          ) : isAttached ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '4px 10px',
                                borderRadius: 6,
                                backgroundColor: '#1e293b',
                                border: '1px solid #334155',
                                color: '#94a3b8',
                                fontSize: 12,
                                fontWeight: 500,
                              }}
                            >
                              <Clock size={12} color="#38bdf8" />
                              <span>Sent — awaiting review</span>
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Attach Document File Modal (Phase 5b: needed → attached) */}
      {attachModalLine && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12,
              width: 'min(480px, 100%)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>
                Attach Document
              </div>
              <button
                type="button"
                onClick={() => setAttachModalLine(null)}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 16 }}>
              Attaching document for <strong>{attachModalLine.documentType?.fullName || 'Document'}</strong> ({attachModalLine.order?.vin}).
            </div>

            {attachError && (
              <div style={{ padding: '8px 12px', borderRadius: 6, backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
                {attachError}
              </div>
            )}

            <form onSubmit={handleAttachSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                  Document File (Max 12MB) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="file"
                  onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #475569',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                  Courier / Airway Bill Tracking Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SF-EXPRESS-1234567, DHL-987654"
                  value={attachTrackingCode}
                  onChange={(e) => setAttachTrackingCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #475569',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                  Note / Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Scanned export certificate attached..."
                  value={attachNote}
                  onChange={(e) => setAttachNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #475569',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setAttachModalLine(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid #475569',
                    backgroundColor: 'transparent',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={attachBusy}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: attachBusy ? 'not-allowed' : 'pointer',
                    opacity: attachBusy ? 0.7 : 1,
                  }}
                >
                  {attachBusy && <RefreshCw size={14} className="spin-animate" />}
                  <span>Upload & Attach</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
