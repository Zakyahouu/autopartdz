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
  Layers,
  FileText,
} from 'lucide-react';

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

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData(EMPTY_FORM);
    setFormError('');
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
    setModalOpen(true);
  };

  const closeModal = () => {
    if (formSubmitting) return;
    setModalOpen(false);
    setEditingCategory(null);
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
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Car Categories</h1>
          <p className="admin-page-subtitle">
            Classifications and required customs documentation profiles for vehicle imports.
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
              <th>Category Name</th>
              <th>Description / Scope</th>
              <th className="align-center" style={{ width: 140 }}>Required Docs</th>
              <th className="align-center" style={{ width: 110 }}>Status</th>
              <th className="align-right" style={{ width: 90 }}>Actions</th>
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
                const count = Array.isArray(cat.requiredDocumentTypes)
                  ? cat.requiredDocumentTypes.length
                  : 0;

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
                    <td className="align-center">
                      <span className="admin-status" style={{ fontWeight: 500 }}>
                        <FileText size={12} />
                        <span>{count} {count === 1 ? 'doc' : 'docs'}</span>
                      </span>
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
          <div className="admin-modal-panel" role="dialog" aria-modal="true" aria-labelledby="cat-modal-title">
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
                    placeholder="e.g. Passenger Vehicles (M1), Commercial"
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
                    placeholder="Customs classification notes, engine capacity specifications…"
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
                  <span>Active in Catalog</span>
                </label>

                {/* Required Documents Checklist */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}>
                    <label className="admin-form-label" style={{ marginBottom: 0 }}>
                      Required Documents
                    </label>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--admin-text-secondary)' }}>
                      {formData.requiredDocumentTypes.length} selected
                    </span>
                  </div>
                  <span className="admin-form-hint" style={{ display: 'block', marginBottom: 10 }}>
                    Select all official documents required when clearing this category through Algerian customs.
                  </span>

                  <div style={{
                    border: '1px solid var(--admin-border)',
                    borderRadius: 'var(--admin-radius)',
                    maxHeight: 260,
                    overflowY: 'auto',
                    background: 'var(--admin-surface)',
                  }}>
                    {availableDocTypes.length === 0 ? (
                      <div style={{ padding: 16, color: 'var(--admin-text-muted)', fontSize: 13, textAlign: 'center' }}>
                        No active document types available to select.
                      </div>
                    ) : (
                      availableDocTypes.map((doc) => {
                        const isChecked = formData.requiredDocumentTypes.includes(doc._id);
                        return (
                          <label
                            key={doc._id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 14px',
                              borderBottom: '1px solid var(--admin-border-subtle)',
                              cursor: 'pointer',
                              background: isChecked ? 'var(--admin-surface-subtle)' : 'transparent',
                              transition: 'background-color 0.12s ease',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleDocTypeToggle(doc._id)}
                              disabled={formSubmitting}
                              style={{ accentColor: 'var(--admin-accent)', width: 16, height: 16 }}
                            />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-text-primary)' }}>
                                {doc.shortName}
                              </span>
                              {!doc.active && (
                                <span style={{ color: 'var(--admin-accent)', fontSize: 11, marginInlineStart: 6 }}>
                                  (inactive)
                                </span>
                              )}
                            </div>
                            <span style={{
                              fontFamily: 'var(--admin-font-mono)',
                              fontSize: 11.5,
                              color: 'var(--admin-text-muted)',
                            }}>
                              {doc.code || '—'}
                            </span>
                          </label>
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
