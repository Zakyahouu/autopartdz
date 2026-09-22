import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../utils/api';
import { STRINGS } from '../constants/strings';

const EMPTY_FORM = {
  name: '',
  description: '',
  active: true,
  requiredDocumentTypes: [],
};

export default function CarCategoriesPage() {
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

  // Load categories and all document types
  const loadData = async () => {
    setLoading(true);
    const [catRes, docRes] = await Promise.all([
      apiFetch('/car-categories'),
      apiFetch('/document-types'),
    ]);

    if (catRes.ok && Array.isArray(catRes.data)) {
      setCategories(catRes.data);
    }
    if (docRes.ok && Array.isArray(docRes.data)) {
      setDocTypes(docRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered and searched categories
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

  // Document types available for the checklist:
  // Active document types, plus any document type already attached to the currently edited category
  const availableDocTypes = useMemo(() => {
    if (!editingCategory) {
      return docTypes.filter((d) => d.active);
    }
    const currentAttachedIds = new Set(
      (editingCategory.requiredDocumentTypes || []).map((d) => (typeof d === 'object' ? d._id : d))
    );
    return docTypes.filter((d) => d.active || currentAttachedIds.has(d._id));
  }, [docTypes, editingCategory]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = async (cat) => {
    // Fetch single category to ensure populated requiredDocumentTypes
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
    setModalOpen(true);
  };

  const closeModal = () => {
    if (formSubmitting) return;
    setModalOpen(false);
    setEditingCategory(null);
  };

  // Toggle active status via PATCH (soft delete / reactivate)
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
      {/* Page Header */}
      <div className="console-page-header">
        <div>
          <h1 className="console-page-title">{STRINGS.carCategories.title}</h1>
          <p className="console-page-subtitle">{STRINGS.carCategories.subtitle}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          {STRINGS.carCategories.createNew}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-lg)',
        flexWrap: 'wrap',
      }}>
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
            {STRINGS.common.filterByStatus}
          </span>
          {['all', 'active', 'inactive'].map((status) => (
            <button
              key={status}
              className={`btn btn-sm ${filterStatus === status ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus(status)}
              style={{ textTransform: 'capitalize' }}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ minWidth: 260 }}>
          <input
            type="search"
            className="form-input"
            style={{ minHeight: 34, fontSize: '0.8rem' }}
            placeholder="Search category name or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table view */}
      <div className="console-table-wrap">
        <table className="console-table">
          <thead>
            <tr>
              <th>{STRINGS.carCategories.name}</th>
              <th>{STRINGS.carCategories.description}</th>
              <th style={{ width: 140, textAlign: 'center' }}>{STRINGS.carCategories.docCount}</th>
              <th style={{ width: 100, textAlign: 'center' }}>{STRINGS.common.status}</th>
              <th style={{ width: 90, textAlign: 'right' }}>{STRINGS.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="console-table-empty">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span className="spinner" />
                    <span>{STRINGS.common.loading}</span>
                  </div>
                </td>
              </tr>
            ) : filteredCategories.length === 0 ? (
              <tr>
                <td colSpan="5" className="console-table-empty">
                  {STRINGS.common.noRecords}
                </td>
              </tr>
            ) : (
              filteredCategories.map((cat) => {
                const count = Array.isArray(cat.requiredDocumentTypes)
                  ? cat.requiredDocumentTypes.length
                  : 0;

                return (
                  <tr key={cat._id} style={{ opacity: cat.active ? 1 : 0.65 }}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{cat.name}</div>
                    </td>
                    <td style={{ color: 'var(--ink-2)', fontSize: '0.85rem' }}>
                      {cat.description || <span style={{ opacity: 0.6 }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-progress">
                        {count} {count === 1 ? 'doc' : 'docs'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className={`toggle-btn ${cat.active ? 'is-active' : 'is-inactive'}`}
                        onClick={() => handleToggleActive(cat)}
                        disabled={actionLoadingId === cat._id}
                        title="Click to toggle status"
                      >
                        {actionLoadingId === cat._id ? (
                          <span className="spinner" />
                        ) : (
                          <span>{cat.active ? 'Active' : 'Inactive'}</span>
                        )}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(cat)}
                      >
                        {STRINGS.common.edit}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="cat-modal-title">
            <div className="modal-header">
              <h2 id="cat-modal-title" className="modal-title">
                {editingCategory ? STRINGS.carCategories.editTitle : STRINGS.carCategories.createTitle}
              </h2>
              <button
                className="modal-close"
                onClick={closeModal}
                disabled={formSubmitting}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="console-alert console-alert-error" role="alert">
                    {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="cat-name">
                    {STRINGS.carCategories.name} <span className="required">*</span>
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    className="form-input"
                    placeholder={STRINGS.carCategories.namePlaceholder}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={formSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="cat-description">
                    {STRINGS.carCategories.description}
                  </label>
                  <textarea
                    id="cat-description"
                    className="form-textarea"
                    placeholder={STRINGS.carCategories.descriptionPlaceholder}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={formSubmitting}
                  />
                </div>

                <label className="form-checkbox-row">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    disabled={formSubmitting}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active (Category visibility)</span>
                </label>

                {/* Required Documents Checklist */}
                <div className="form-section">
                  <div className="form-section-title">
                    {STRINGS.carCategories.requiredDocs} ({formData.requiredDocumentTypes.length} selected)
                  </div>
                  <span className="form-hint" style={{ marginTop: -8 }}>
                    {STRINGS.carCategories.requiredDocsHint}
                  </span>

                  <div className="checklist">
                    {availableDocTypes.length === 0 ? (
                      <div style={{ padding: 'var(--space-md)', color: 'var(--ink-2)', fontSize: '0.85rem' }}>
                        {STRINGS.carCategories.noDocsAvailable}
                      </div>
                    ) : (
                      availableDocTypes.map((doc) => {
                        const isChecked = formData.requiredDocumentTypes.includes(doc._id);
                        return (
                          <label key={doc._id} className="checklist-item">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleDocTypeToggle(doc._id)}
                              disabled={formSubmitting}
                            />
                            <div className="checklist-item-name">
                              <span>{doc.shortName}</span>
                              {!doc.active && (
                                <span style={{ color: 'var(--stamp)', fontSize: '0.72rem', marginInlineStart: 6 }}>
                                  (inactive in catalog)
                                </span>
                              )}
                            </div>
                            <div className="checklist-item-code">
                              {doc.code || '—'}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={formSubmitting}
                >
                  {STRINGS.common.cancel}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? (
                    <>
                      <span className="spinner" />
                      <span>{editingCategory ? STRINGS.common.saving : STRINGS.common.creating}</span>
                    </>
                  ) : (
                    <span>{editingCategory ? STRINGS.common.save : STRINGS.common.create}</span>
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
