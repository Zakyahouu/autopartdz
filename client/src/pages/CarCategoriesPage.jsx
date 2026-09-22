import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../utils/api';
import {
  Plus,
  Search,
  Pencil,
  Power,
  PowerOff,
  CheckCircle2,
  CircleDot,
  X,
  AlertCircle,
  FileText,
} from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  description: '',
  active: true,
  requiredDocumentTypes: [],
};

export default function CarCategoriesPage({ onCountChange }) {
  const [categories, setCategories] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // all | active | inactive
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [docFilterQuery, setDocFilterQuery] = useState('');
  const [expandedDocRowId, setExpandedDocRowId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const [catRes, docRes] = await Promise.all([
      apiFetch('/car-categories'),
      apiFetch('/document-types'),
    ]);

    if (catRes.ok && Array.isArray(catRes.data)) {
      setCategories(catRes.data);
      if (onCountChange) onCountChange(catRes.data.length);
    }
    if (docRes.ok && Array.isArray(docRes.data)) {
      setDocTypes(docRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      if (filterStatus === 'active' && !cat.active) return false;
      if (filterStatus === 'inactive' && cat.active) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = cat.name?.toLowerCase().includes(q);
        const matchDesc = cat.description?.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [categories, filterStatus, search]);

  const availableDocTypes = useMemo(() => {
    if (!editingCategory) {
      return docTypes.filter((d) => d.active);
    }
    const currentAttachedIds = new Set(
      (editingCategory.requiredDocumentTypes || []).map((d) => (typeof d === 'object' ? d._id : d))
    );
    return docTypes.filter((d) => d.active || currentAttachedIds.has(d._id));
  }, [docTypes, editingCategory]);

  // Filtered documents inside the modal checklist
  const modalFilteredDocs = useMemo(() => {
    if (!docFilterQuery.trim()) return availableDocTypes;
    const q = docFilterQuery.toLowerCase();
    return availableDocTypes.filter((d) =>
      (d.shortName && d.shortName.toLowerCase().includes(q)) ||
      (d.code && d.code.toLowerCase().includes(q))
    );
  }, [availableDocTypes, docFilterQuery]);

  // Map of doc ID to doc details for rendering table chips
  const docTypeMap = useMemo(() => {
    const map = new Map();
    docTypes.forEach((d) => map.set(d._id, d));
    return map;
  }, [docTypes]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setDocFilterQuery('');
    setModalOpen(true);
  };

  const openEditModal = async (cat) => {
    const { ok, data } = await apiFetch(`/car-categories/${cat._id}`);
    const target = ok ? data : cat;

    setEditingCategory(target);
    const selectedIds = (target.requiredDocumentTypes || []).map((d) =>
      typeof d === 'object' ? d._id : d
    );

    setFormData({
      name: target.name || '',
      description: target.description || '',
      active: target.active !== false,
      requiredDocumentTypes: selectedIds,
    });
    setFormError('');
    setDocFilterQuery('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (formSubmitting) return;
    setModalOpen(false);
    setEditingCategory(null);
    setDocFilterQuery('');
  };

  const handleToggleActive = async (cat) => {
    setActionLoadingId(cat._id);
    const newActive = !cat.active;
    const { ok, data } = await apiFetch(`/car-categories/${cat._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: newActive }),
    });
    setActionLoadingId(null);
    if (ok) {
      setCategories((prev) => prev.map((c) => (c._id === cat._id ? data : c)));
    } else {
      alert(data.error || 'Failed to update active state.');
    }
  };

  const handleDocTypeToggle = (docId) => {
    setFormData((prev) => {
      const current = prev.requiredDocumentTypes;
      const exists = current.includes(docId);
      const updated = exists ? current.filter((id) => id !== docId) : [...current, docId];
      return { ...prev, requiredDocumentTypes: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    setFormSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      active: formData.active,
      requiredDocumentTypes: formData.requiredDocumentTypes,
    };

    let res;
    if (editingCategory) {
      res = await apiFetch(`/car-categories/${editingCategory._id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      res = await apiFetch('/car-categories', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    setFormSubmitting(false);

    if (!res.ok) {
      if (res.data?.invalidIds) {
        const badDetails = res.data.invalidIds.map((b) => `${b.id} (${b.reason})`).join(', ');
        setFormError(`${res.data.error} Details: ${badDetails}`);
      } else {
        setFormError(res.data?.error || 'Failed to save car category.');
      }
      return;
    }

    closeModal();
    loadData();
  };

  return (
    <div>
      {/* Action Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-text-primary)' }}>
            Vehicle Import Categories
          </h2>
          <p style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginTop: 2 }}>
            Define vehicle types and their required customs documentation profiles (auto-checked for clients).
          </p>
        </div>

        <button
          type="button"
          className="btn-admin-primary"
          onClick={openCreateModal}
        >
          <Plus size={16} />
          <span>New Car Category</span>
        </button>
      </div>

      {/* Toolbar: Filters and Search */}
      <div className="admin-toolbar">
        <div className="admin-filter-tabs">
          {['all', 'active', 'inactive'].map((status) => (
            <button
              key={status}
              type="button"
              className={`admin-filter-tab ${filterStatus === status ? 'active' : ''}`}
              onClick={() => setFilterStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="admin-search-wrapper">
          <Search size={15} className="admin-search-icon" />
          <input
            type="search"
            className="admin-search-input"
            placeholder="Search category name or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Category Name</th>
              <th style={{ width: '28%' }}>Description / Notes</th>
              <th>Required Documents</th>
              <th className="align-center" style={{ width: 100 }}>Status</th>
              <th className="align-right" style={{ width: 85 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="admin-table-empty">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span className="admin-spinner" />
                    <span>Loading categories…</span>
                  </div>
                </td>
              </tr>
            ) : filteredCategories.length === 0 ? (
              <tr>
                <td colSpan="5" className="admin-table-empty">
                  No car categories found.
                </td>
              </tr>
            ) : (
              filteredCategories.map((cat) => {
                const docIds = Array.isArray(cat.requiredDocumentTypes)
                  ? cat.requiredDocumentTypes.map((d) => (typeof d === 'object' ? d._id : d))
                  : [];

                const isExpanded = expandedDocRowId === cat._id;
                const displayDocs = isExpanded ? docIds : docIds.slice(0, 4);
                const hasMore = docIds.length > 4;

                return (
                  <tr key={cat._id} style={{ opacity: cat.active ? 1 : 0.65 }}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                        {cat.name}
                      </div>
                    </td>
                    <td style={{ color: 'var(--admin-text-secondary)', fontSize: 13 }}>
                      {cat.description || <span style={{ color: 'var(--admin-text-muted)' }}>—</span>}
                    </td>
                    <td>
                      {docIds.length === 0 ? (
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: 12 }}>No required docs</span>
                      ) : (
                        <div className="admin-chips-wrap">
                          {displayDocs.map((id) => {
                            const d = docTypeMap.get(id);
                            const label = d?.code || d?.shortName || id.slice(-4);
                            return (
                              <span key={id} className="admin-doc-chip" title={d?.shortName || ''}>
                                {label}
                              </span>
                            );
                          })}
                          {hasMore && !isExpanded && (
                            <button
                              type="button"
                              className="admin-doc-chip more"
                              onClick={() => setExpandedDocRowId(cat._id)}
                              title="Click to view all required documents"
                            >
                              +{docIds.length - 4} more
                            </button>
                          )}
                          {isExpanded && (
                            <button
                              type="button"
                              className="admin-doc-chip more"
                              onClick={() => setExpandedDocRowId(null)}
                            >
                              Show less
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="align-center">
                      <span className={`admin-status ${cat.active ? 'is-active' : 'is-inactive'}`}>
                        {cat.active ? (
                          <CheckCircle2 size={12} strokeWidth={2.2} />
                        ) : (
                          <CircleDot size={12} strokeWidth={2.2} />
                        )}
                        <span>{cat.active ? 'Active' : 'Inactive'}</span>
                      </span>
                    </td>
                    <td className="align-right">
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="btn-admin-icon"
                          aria-label={`Edit ${cat.name}`}
                          title="Edit category"
                          onClick={() => openEditModal(cat)}
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          type="button"
                          className={`btn-admin-icon ${cat.active ? 'danger' : ''}`}
                          aria-label={cat.active ? 'Deactivate category' : 'Activate category'}
                          title={cat.active ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleActive(cat)}
                          disabled={actionLoadingId === cat._id}
                        >
                          {actionLoadingId === cat._id ? (
                            <span className="admin-spinner" style={{ width: 12, height: 12 }} />
                          ) : cat.active ? (
                            <PowerOff size={14} />
                          ) : (
                            <Power size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal Dialog */}
      {modalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="admin-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cat-modal-title"
            style={{ width: 'min(720px, 100%)' }}
          >
            <div className="admin-modal-header">
              <h2 id="cat-modal-title" className="admin-modal-title">
                {editingCategory ? 'Edit Car Category' : 'Create Car Category'}
              </h2>
              <button
                type="button"
                className="btn-admin-icon"
                onClick={closeModal}
                disabled={formSubmitting}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="admin-modal-body">
                {formError && (
                  <div className="admin-alert admin-alert-error" role="alert">
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="cat-name">
                    Category Name <span className="required">*</span>
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    className="admin-input"
                    placeholder="e.g. Passenger Vehicles (M1), Commercial Vans (N1)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={formSubmitting}
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="cat-description">
                    Description / Scope
                  </label>
                  <textarea
                    id="cat-description"
                    className="admin-textarea"
                    placeholder="Notes for clients regarding vehicle engine limits or customs classifications…"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={formSubmitting}
                  />
                </div>

                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    disabled={formSubmitting}
                  />
                  <span>Active in Catalog (Available for clients to select)</span>
                </label>

                {/* Scalable Multi-Column Required Documents Checklist */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}>
                    <label className="admin-form-label" style={{ marginBottom: 0 }}>
                      Required Documents ({formData.requiredDocumentTypes.length} selected)
                    </label>
                    <span style={{ fontSize: 12, color: 'var(--admin-text-secondary)', fontWeight: 500 }}>
                      Auto-selected for client on import request
                    </span>
                  </div>

                  {/* Filter inside checklist */}
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
                    <input
                      type="search"
                      className="admin-input"
                      style={{ height: 32, paddingLeft: 30, fontSize: 12.5 }}
                      placeholder="Filter documents checklist…"
                      value={docFilterQuery}
                      onChange={(e) => setDocFilterQuery(e.target.value)}
                    />
                  </div>

                  {/* 2-Column Responsive Grid */}
                  <div className="admin-checklist-grid">
                    {modalFilteredDocs.length === 0 ? (
                      <div style={{ gridColumn: '1 / -1', padding: 20, textAlign: 'center', color: 'var(--admin-text-muted)', fontSize: 13 }}>
                        No matching documents found.
                      </div>
                    ) : (
                      modalFilteredDocs.map((doc) => {
                        const isChecked = formData.requiredDocumentTypes.includes(doc._id);
                        return (
                          <div
                            key={doc._id}
                            className={`admin-checklist-card ${isChecked ? 'selected' : ''}`}
                            onClick={() => handleDocTypeToggle(doc._id)}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Handled by card click
                              disabled={formSubmitting}
                              style={{ accentColor: 'var(--admin-accent)', marginTop: 2 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                {doc.code ? (
                                  <span className="admin-doc-chip" style={{ fontSize: 10.5, padding: '1px 5px' }}>
                                    {doc.code}
                                  </span>
                                ) : null}
                                <span style={{
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  color: 'var(--admin-text-primary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {doc.shortName}
                                </span>
                              </div>
                              {!doc.active && (
                                <span style={{ color: 'var(--admin-accent)', fontSize: 11 }}>
                                  (inactive in catalog)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="btn-admin-secondary"
                  onClick={closeModal}
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-admin-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? (
                    <>
                      <span className="admin-spinner" />
                      <span>{editingCategory ? 'Saving…' : 'Creating…'}</span>
                    </>
                  ) : (
                    <span>{editingCategory ? 'Save Changes' : 'Create Car Category'}</span>
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
