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

  // Add line modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [catalogDocs, setCatalogDocs] = useState([]);
  const [selectedAddDocId, setSelectedAddDocId] = useState('');
  const [selectedAddMode, setSelectedAddMode] = useState('original_only');
  const [selectedAddSource, setSelectedAddSource] = useState('local');

  // Delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const loadOrderDetail = async () => {
    setLoading(true);
    const { ok, data } = await apiFetch(`/orders/${id}`);
    if (ok && data) {
      setOrder(data);
      // Initialize line sources
      const sources = {};
      (data.lines || []).forEach((l) => {
        sources[l._id] = l.source;
      });
      setLineSources(sources);
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

  useEffect(() => {
    loadOrderDetail();
    loadCatalog();
  }, [id]);

  const handleSourceChange = (lineId, newSource) => {
    setLineSources((prev) => ({
      ...prev,
      [lineId]: newSource === '' ? null : newSource,
    }));
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

    setActionLoading(true);
    // Submit all updated sources and trigger confirmation
    const lineUpdates = Object.entries(lineSources).map(([lineId, source]) => ({
      lineId,
      source,
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
              <span className={`admin-status ${order.status === 'confirmed' ? 'is-active' : ''}`}>
                {order.status === 'confirmed' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                <span style={{ textTransform: 'capitalize' }}>{order.status}</span>
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
              <th style={{ width: 180 }}>Translation Mode</th>
              <th className="align-right" style={{ width: 120 }}>Client Fee</th>
              <th className="align-right" style={{ width: 120 }}>Cost Price</th>
              <th style={{ width: 180 }}>Fulfillment Source</th>
              <th className="align-center" style={{ width: 100 }}>Status</th>
              {isPending && <th className="align-right" style={{ width: 60 }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={isPending ? 7 : 6} className="admin-table-empty">
                  No document lines on this order.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const currentSource = lineSources[line._id];
                const isSourceUnset = !currentSource;

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
                      ) : (
                        <span className={`admin-badge ${line.source === 'local' ? 'is-active' : ''}`}>
                          {line.source === 'local' ? 'Local Print' : 'China Shipped'}
                        </span>
                      )}
                    </td>

                    <td className="align-center">
                      <span className="admin-status">
                        <span>{line.status}</span>
                      </span>
                    </td>

                    {isPending && (
                      <td className="align-right">
                        <button
                          type="button"
                          className="btn-admin-icon danger"
                          title="Remove document line"
                          onClick={() => handleRemoveLine(line._id)}
                          disabled={actionLoading || lines.length <= 1}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
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
    </div>
  );
}
