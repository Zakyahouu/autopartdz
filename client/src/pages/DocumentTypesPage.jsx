import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch, apiUpload, fetchFileUrl } from '../utils/api';
import {
  Plus,
  Search,
  Pencil,
  Power,
  PowerOff,
  CheckCircle2,
  CircleDot,
  UploadCloud,
  X,
  AlertCircle,
  MapPin,
  Globe,
  Shuffle,
  ImageIcon,
} from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  code: '',
  category: '',
  originLanguage: 'Chinese',
  defaultSource: 'local',
  estimatedTurnaroundDays: '',
  description: '',
  active: true,
  hasTranslation: false,
  pricing: {
    originalOnly: { clientPrice: '', costPrice: '' },
    originalPlusTranslation: { clientPrice: '', costPrice: '' },
    translationOnly: { clientPrice: '', costPrice: '' },
  },
};

export default function DocumentTypesPage({ onCountChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // all | active | inactive
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const fileInputRef = useRef(null);

  const loadItems = async () => {
    setLoading(true);
    const { ok, data } = await apiFetch('/document-types');
    if (ok && Array.isArray(data)) {
      setItems(data);
      if (onCountChange) onCountChange(data.length);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const distinctCategories = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterStatus === 'active' && !item.active) return false;
      if (filterStatus === 'inactive' && item.active) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchCode = item.code?.toLowerCase().includes(q);
        const matchName = item.shortName?.toLowerCase().includes(q) || item.fullName?.toLowerCase().includes(q);
        const matchCategory = item.category?.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchCategory) return false;
      }
      return true;
    });
  }, [items, filterStatus, search]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      if (existingImageUrl) URL.revokeObjectURL(existingImageUrl);
    };
  }, [imagePreviewUrl, existingImageUrl]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setSelectedFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    if (existingImageUrl) URL.revokeObjectURL(existingImageUrl);
    setImagePreviewUrl(null);
    setExistingImageUrl(null);
    setModalOpen(true);
  };

  const openEditModal = async (item) => {
    setEditingItem(item);
    setFormData({
      name: item.shortName || item.fullName || '',
      code: item.code || '',
      category: item.category || '',
      originLanguage: item.originLanguage || 'Chinese',
      defaultSource: item.defaultSource || 'local',
      estimatedTurnaroundDays: item.estimatedTurnaroundDays ?? '',
      description: item.description || '',
      active: item.active !== false,
      hasTranslation: Boolean(item.hasTranslation),
      pricing: {
        originalOnly: {
          clientPrice: item.pricing?.originalOnly?.clientPrice ?? '',
          costPrice: item.pricing?.originalOnly?.costPrice ?? '',
        },
        originalPlusTranslation: {
          clientPrice: item.pricing?.originalPlusTranslation?.clientPrice ?? '',
          costPrice: item.pricing?.originalPlusTranslation?.costPrice ?? '',
        },
        translationOnly: {
          clientPrice: item.pricing?.translationOnly?.clientPrice ?? '',
          costPrice: item.pricing?.translationOnly?.costPrice ?? '',
        },
      },
    });
    setFormError('');
    setSelectedFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    if (existingImageUrl) URL.revokeObjectURL(existingImageUrl);
    setImagePreviewUrl(null);
    setExistingImageUrl(null);

    if (item.exampleImageFileId) {
      const url = await fetchFileUrl(item.exampleImageFileId);
      if (url) setExistingImageUrl(url);
    }

    setModalOpen(true);
  };

  const closeModal = () => {
    if (formSubmitting) return;
    setModalOpen(false);
    setEditingItem(null);
    setSelectedFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    if (existingImageUrl) URL.revokeObjectURL(existingImageUrl);
    setImagePreviewUrl(null);
    setExistingImageUrl(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setSelectedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleToggleActive = async (item) => {
    setActionLoadingId(item._id);
    const newActive = !item.active;
    const { ok, data } = await apiFetch(`/document-types/${item._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: newActive }),
    });
    setActionLoadingId(null);
    if (ok) {
      setItems((prev) => prev.map((doc) => (doc._id === item._id ? data : doc)));
    } else {
      alert(data.error || 'Failed to update active state.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setFormError('Document name is required.');
      return;
    }
    if (
      formData.pricing.originalOnly.clientPrice === '' ||
      formData.pricing.originalOnly.costPrice === ''
    ) {
      setFormError('Standard pricing (originalOnly client price and cost price) is required.');
      return;
    }

    if (formData.hasTranslation) {
      if (
        formData.pricing.originalPlusTranslation.clientPrice === '' ||
        formData.pricing.originalPlusTranslation.costPrice === '' ||
        formData.pricing.translationOnly.clientPrice === '' ||
        formData.pricing.translationOnly.costPrice === ''
      ) {
        setFormError('When translation is enabled, both Original+Translation and Translation Only prices are required.');
        return;
      }
    }

    setFormSubmitting(true);

    const payload = {
      name: trimmedName,
      shortName: trimmedName,
      fullName: trimmedName,
      description: formData.description.trim(),
      category: formData.category.trim(),
      originLanguage: formData.originLanguage.trim(),
      defaultSource: formData.defaultSource,
      hasTranslation: formData.hasTranslation,
      active: formData.active,
      pricing: {
        originalOnly: {
          clientPrice: Number(formData.pricing.originalOnly.clientPrice),
          costPrice: Number(formData.pricing.originalOnly.costPrice),
        },
      },
    };

    if (formData.estimatedTurnaroundDays !== '') {
      payload.estimatedTurnaroundDays = Number(formData.estimatedTurnaroundDays);
    } else {
      payload.estimatedTurnaroundDays = null;
    }

    const trimmedCode = formData.code.trim();
    if (!editingItem) {
      if (trimmedCode) payload.code = trimmedCode.toUpperCase();
    } else {
      if (!editingItem.code && trimmedCode) {
        payload.code = trimmedCode.toUpperCase();
      }
    }

    if (formData.hasTranslation) {
      payload.pricing.originalPlusTranslation = {
        clientPrice: Number(formData.pricing.originalPlusTranslation.clientPrice),
        costPrice: Number(formData.pricing.originalPlusTranslation.costPrice),
      };
      payload.pricing.translationOnly = {
        clientPrice: Number(formData.pricing.translationOnly.clientPrice),
        costPrice: Number(formData.pricing.translationOnly.costPrice),
      };
    }

    let savedDoc = null;
    if (editingItem) {
      const { ok, data } = await apiFetch(`/document-types/${editingItem._id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!ok) {
        setFormSubmitting(false);
        setFormError(data.error || 'Failed to update document type.');
        return;
      }
      savedDoc = data;
    } else {
      const { ok, data } = await apiFetch('/document-types', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!ok) {
        setFormSubmitting(false);
        setFormError(data.error || 'Failed to create document type.');
        return;
      }
      savedDoc = data;
    }

    if (selectedFile && savedDoc?._id) {
      const uploadRes = await apiUpload(`/document-types/${savedDoc._id}/example-image`, selectedFile);
      if (!uploadRes.ok) {
        alert(`Document saved, but image upload failed: ${uploadRes.data?.error || 'Upload error'}`);
      } else {
        savedDoc.exampleImageFileId = uploadRes.data?.fileId;
      }
    }

    setFormSubmitting(false);
    closeModal();
    loadItems();
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
            Official Import Documents
          </h2>
          <p style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginTop: 2 }}>
            Manage documents, supplier sourcing defaults, client descriptions, and pricing tiers.
          </p>
        </div>

        <button
          type="button"
          className="btn-admin-primary"
          onClick={openCreateModal}
        >
          <Plus size={16} />
          <span>New Document Type</span>
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
            placeholder="Search code, name, category…"
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
              <th style={{ width: 85 }}>Code</th>
              <th>Document Name</th>
              <th>Category</th>
              <th>Default Source</th>
              <th className="align-right">Client Price</th>
              <th className="align-center" style={{ width: 110 }}>Status</th>
              <th className="align-right" style={{ width: 90 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="admin-table-empty">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span className="admin-spinner" />
                    <span>Loading documents…</span>
                  </div>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan="7" className="admin-table-empty">
                  No document types found.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item._id} style={{ opacity: item.active ? 1 : 0.65 }}>
                  <td className="mono">
                    {item.code ? (
                      <span className="admin-doc-chip" style={{ fontSize: 12 }}>
                        {item.code}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--admin-text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                      {item.shortName || item.fullName}
                    </div>
                    {item.description ? (
                      <div style={{
                        fontSize: 12,
                        color: 'var(--admin-text-secondary)',
                        marginTop: 2,
                        maxWidth: 360,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.description}
                      </div>
                    ) : null}
                    {item.hasTranslation && (
                      <span style={{ fontSize: 11.5, color: 'var(--status-amber-text)', fontWeight: 500, display: 'inline-block', marginTop: 2 }}>
                        • Chinese translation available
                      </span>
                    )}
                  </td>
                  <td>
                    {item.category ? (
                      <span className="admin-status">
                        {item.category}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--admin-text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>
                    {item.defaultSource === 'local' ? (
                      <span className="admin-status is-local">
                        <MapPin size={12} />
                        <span>Algeria (Print)</span>
                      </span>
                    ) : item.defaultSource === 'china' ? (
                      <span className="admin-status is-china">
                        <Globe size={12} />
                        <span>China (Shipped)</span>
                      </span>
                    ) : (
                      <span className="admin-status is-mixed">
                        <Shuffle size={12} />
                        <span>Mixed / Depends</span>
                      </span>
                    )}
                  </td>
                  <td className="align-right">
                    {item.pricing?.originalOnly?.clientPrice != null ? (
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                          {item.pricing.originalOnly.clientPrice.toLocaleString()} DZD
                        </span>
                        <div style={{ fontSize: 11.5, color: 'var(--admin-text-muted)' }}>
                          Cost: {item.pricing.originalOnly.costPrice?.toLocaleString() ?? 0} DZD
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--admin-text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="align-center">
                    <span className={`admin-status ${item.active ? 'is-active' : 'is-inactive'}`}>
                      {item.active ? (
                        <CheckCircle2 size={12} strokeWidth={2.2} />
                      ) : (
                        <CircleDot size={12} strokeWidth={2.2} />
                      )}
                      <span>{item.active ? 'Active' : 'Inactive'}</span>
                    </span>
                  </td>
                  <td className="align-right">
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        className="btn-admin-icon"
                        aria-label={`Edit ${item.shortName}`}
                        title="Edit document type"
                        onClick={() => openEditModal(item)}
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        type="button"
                        className={`btn-admin-icon ${item.active ? 'danger' : ''}`}
                        aria-label={item.active ? 'Deactivate document type' : 'Activate document type'}
                        title={item.active ? 'Deactivate' : 'Activate'}
                        onClick={() => handleToggleActive(item)}
                        disabled={actionLoadingId === item._id}
                      >
                        {actionLoadingId === item._id ? (
                          <span className="admin-spinner" style={{ width: 12, height: 12 }} />
                        ) : item.active ? (
                          <PowerOff size={14} />
                        ) : (
                          <Power size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Autocomplete Datalist for Categories */}
      <datalist id="category-suggestions">
        {distinctCategories.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      {/* Create / Edit Modal Dialog */}
      {modalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="admin-modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="admin-modal-header">
              <h2 id="modal-title" className="admin-modal-title">
                {editingItem ? 'Edit Document Type' : 'Create Document Type'}
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

                {/* Primary Name & Customs Code */}
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label className="admin-form-label" htmlFor="doc-name">
                      Document Name <span className="required">*</span>
                    </label>
                    <input
                      id="doc-name"
                      type="text"
                      className="admin-input"
                      placeholder="e.g. Certificate of Conformity"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={formSubmitting}
                    />
                    <span className="admin-form-hint">Official title shown to clients.</span>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label" htmlFor="doc-code">
                      Customs Code
                    </label>
                    <input
                      id="doc-code"
                      type="text"
                      className="admin-input mono"
                      placeholder="e.g. COC, CI, CO"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      disabled={formSubmitting || (Boolean(editingItem) && Boolean(editingItem.code))}
                    />
                    <span className="admin-form-hint">
                      {editingItem?.code
                        ? 'Code is immutable once set and cannot be altered.'
                        : 'Short abbreviation. Leave blank if none.'}
                    </span>
                  </div>
                </div>

                {/* Category & Default Sourcing */}
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label className="admin-form-label" htmlFor="doc-category">
                      Category
                    </label>
                    <input
                      id="doc-category"
                      type="text"
                      list="category-suggestions"
                      className="admin-input"
                      placeholder="e.g. Customs Clearance, Technical"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      disabled={formSubmitting}
                    />
                    <span className="admin-form-hint">Group for the client request form.</span>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label" htmlFor="doc-defaultSource">
                      Default Sourcing <span className="required">*</span>
                    </label>
                    <select
                      id="doc-defaultSource"
                      className="admin-select"
                      value={formData.defaultSource}
                      onChange={(e) => setFormData({ ...formData, defaultSource: e.target.value })}
                      disabled={formSubmitting}
                    >
                      <option value="local">Algeria (Office Print)</option>
                      <option value="china">China (Shipped from Partner)</option>
                      <option value="mixed">Mixed / Depends on Vehicle</option>
                    </select>
                  </div>
                </div>

                {/* Language & Turnaround */}
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label className="admin-form-label" htmlFor="doc-originLanguage">
                      Origin Language
                    </label>
                    <select
                      id="doc-originLanguage"
                      className="admin-select"
                      value={formData.originLanguage}
                      onChange={(e) => setFormData({ ...formData, originLanguage: e.target.value })}
                      disabled={formSubmitting}
                    >
                      <option value="Chinese">Chinese</option>
                      <option value="English">English</option>
                      <option value="French">French</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label" htmlFor="doc-turnaround">
                      Est. Turnaround Time (Days)
                    </label>
                    <input
                      id="doc-turnaround"
                      type="number"
                      min="0"
                      className="admin-input"
                      placeholder="e.g. 5"
                      value={formData.estimatedTurnaroundDays}
                      onChange={(e) => setFormData({ ...formData, estimatedTurnaroundDays: e.target.value })}
                      disabled={formSubmitting}
                    />
                  </div>
                </div>

                {/* Client-facing Description */}
                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="doc-description">
                    Client Description / Instructions
                  </label>
                  <textarea
                    id="doc-description"
                    className="admin-textarea"
                    placeholder="Explain what this document is and why Algerian customs requires it for import clearance…"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={formSubmitting}
                  />
                  <span className="admin-form-hint">
                    This explanation will be displayed to clients on the request form.
                  </span>
                </div>

                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    disabled={formSubmitting}
                  />
                  <span>Active in Catalog (Available for clients to request)</span>
                </label>

                {/* Pricing Section */}
                <div style={{
                  padding: 16,
                  background: 'var(--admin-surface-subtle)',
                  borderRadius: 'var(--admin-radius)',
                  border: '1px solid var(--admin-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-primary)', marginBottom: 8 }}>
                      Standard Pricing (Original Document) <span className="required">*</span>
                    </div>
                    <div className="admin-form-grid">
                      <div className="admin-form-group">
                        <label className="admin-form-label" htmlFor="price-orig-client">
                          Client Price (DZD) <span className="required">*</span>
                        </label>
                        <input
                          id="price-orig-client"
                          type="number"
                          min="0"
                          step="1"
                          className="admin-input"
                          placeholder="e.g. 15000"
                          value={formData.pricing.originalOnly.clientPrice}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              pricing: {
                                ...formData.pricing,
                                originalOnly: { ...formData.pricing.originalOnly, clientPrice: e.target.value },
                              },
                            })
                          }
                          required
                          disabled={formSubmitting}
                        />
                      </div>
                      <div className="admin-form-group">
                        <label className="admin-form-label" htmlFor="price-orig-cost">
                          Cost Price (DZD) <span className="required">*</span>
                        </label>
                        <input
                          id="price-orig-cost"
                          type="number"
                          min="0"
                          step="1"
                          className="admin-input"
                          placeholder="e.g. 5000"
                          value={formData.pricing.originalOnly.costPrice}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              pricing: {
                                ...formData.pricing,
                                originalOnly: { ...formData.pricing.originalOnly, costPrice: e.target.value },
                              },
                            })
                          }
                          required
                          disabled={formSubmitting}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="admin-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.hasTranslation}
                        onChange={(e) => setFormData({ ...formData, hasTranslation: e.target.checked })}
                        disabled={formSubmitting}
                      />
                      <span>Offers / Requires Chinese Translation</span>
                    </label>
                    <span className="admin-form-hint" style={{ display: 'block', marginInlineStart: 24, marginTop: 2 }}>
                      When checked, translation-specific pricing tiers become required.
                    </span>
                  </div>

                  {/* Conditional Translation Pricing */}
                  {formData.hasTranslation && (
                    <div style={{
                      padding: 14,
                      background: 'var(--admin-surface)',
                      borderRadius: 'var(--admin-radius)',
                      border: '1px solid var(--admin-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                    }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--admin-text-primary)', marginBottom: 6 }}>
                          Original + Translation Pricing <span className="required">*</span>
                        </div>
                        <div className="admin-form-grid">
                          <div className="admin-form-group">
                            <label className="admin-form-label" htmlFor="price-opt-client">
                              Client Price (DZD) <span className="required">*</span>
                            </label>
                            <input
                              id="price-opt-client"
                              type="number"
                              min="0"
                              step="1"
                              className="admin-input"
                              placeholder="e.g. 25000"
                              value={formData.pricing.originalPlusTranslation.clientPrice}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  pricing: {
                                    ...formData.pricing,
                                    originalPlusTranslation: {
                                      ...formData.pricing.originalPlusTranslation,
                                      clientPrice: e.target.value,
                                    },
                                  },
                                })
                              }
                              required={formData.hasTranslation}
                              disabled={formSubmitting}
                            />
                          </div>
                          <div className="admin-form-group">
                            <label className="admin-form-label" htmlFor="price-opt-cost">
                              Cost Price (DZD) <span className="required">*</span>
                            </label>
                            <input
                              id="price-opt-cost"
                              type="number"
                              min="0"
                              step="1"
                              className="admin-input"
                              placeholder="e.g. 10000"
                              value={formData.pricing.originalPlusTranslation.costPrice}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  pricing: {
                                    ...formData.pricing,
                                    originalPlusTranslation: {
                                      ...formData.pricing.originalPlusTranslation,
                                      costPrice: e.target.value,
                                    },
                                  },
                                })
                              }
                              required={formData.hasTranslation}
                              disabled={formSubmitting}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--admin-text-primary)', marginBottom: 6 }}>
                          Translation Only Pricing <span className="required">*</span>
                        </div>
                        <div className="admin-form-grid">
                          <div className="admin-form-group">
                            <label className="admin-form-label" htmlFor="price-to-client">
                              Client Price (DZD) <span className="required">*</span>
                            </label>
                            <input
                              id="price-to-client"
                              type="number"
                              min="0"
                              step="1"
                              className="admin-input"
                              placeholder="e.g. 12000"
                              value={formData.pricing.translationOnly.clientPrice}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  pricing: {
                                    ...formData.pricing,
                                    translationOnly: {
                                      ...formData.pricing.translationOnly,
                                      clientPrice: e.target.value,
                                    },
                                  },
                                })
                              }
                              required={formData.hasTranslation}
                              disabled={formSubmitting}
                            />
                          </div>
                          <div className="admin-form-group">
                            <label className="admin-form-label" htmlFor="price-to-cost">
                              Cost Price (DZD) <span className="required">*</span>
                            </label>
                            <input
                              id="price-to-cost"
                              type="number"
                              min="0"
                              step="1"
                              className="admin-input"
                              placeholder="e.g. 5000"
                              value={formData.pricing.translationOnly.costPrice}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  pricing: {
                                    ...formData.pricing,
                                    translationOnly: {
                                      ...formData.pricing.translationOnly,
                                      costPrice: e.target.value,
                                    },
                                  },
                                })
                              }
                              required={formData.hasTranslation}
                              disabled={formSubmitting}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Example Image Upload */}
                <div style={{
                  padding: 16,
                  border: '1px solid var(--admin-border)',
                  borderRadius: 'var(--admin-radius)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}>
                  {(imagePreviewUrl || existingImageUrl) ? (
                    <div style={{
                      width: 90,
                      height: 70,
                      border: '1px solid var(--admin-border)',
                      borderRadius: 'var(--admin-radius-sm)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--admin-surface-subtle)',
                      flexShrink: 0,
                    }}>
                      <img
                        src={imagePreviewUrl || existingImageUrl}
                        alt="Document preview"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: 90,
                      height: 70,
                      border: '1px dashed var(--admin-border-input)',
                      borderRadius: 'var(--admin-radius-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      color: 'var(--admin-text-muted)',
                      flexShrink: 0,
                      background: 'var(--admin-surface-subtle)',
                    }}>
                      <ImageIcon size={20} />
                      <span style={{ fontSize: 10 }}>No image</span>
                    </div>
                  )}

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                      Example Document Image
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                      disabled={formSubmitting}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        className="btn-admin-secondary"
                        style={{ height: 32, padding: '0 12px', fontSize: 12.5 }}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={formSubmitting}
                      >
                        <UploadCloud size={14} />
                        <span>{(imagePreviewUrl || existingImageUrl) ? 'Replace Image' : 'Upload Image'}</span>
                      </button>
                      {selectedFile && (
                        <span style={{ fontSize: 12, color: 'var(--status-active-text)', fontWeight: 500 }}>
                          {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                        </span>
                      )}
                    </div>
                    <span className="admin-form-hint">PNG, JPG, or WEBP up to 12MB.</span>
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
                      <span>{editingItem ? 'Saving…' : 'Creating…'}</span>
                    </>
                  ) : (
                    <span>{editingItem ? 'Save Changes' : 'Create Document Type'}</span>
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
