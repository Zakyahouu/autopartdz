import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch, apiUpload, fetchFileUrl } from '../utils/api';
import { STRINGS } from '../constants/strings';

const EMPTY_FORM = {
  shortName: '',
  fullName: '',
  code: '',
  slug: '',
  category: '',
  originLanguage: '',
  defaultSource: 'local',
  estimatedTurnaroundDays: '',
  sortOrder: 0,
  description: '',
  active: true,
  hasTranslation: false,
  pricing: {
    originalOnly: { clientPrice: '', costPrice: '' },
    originalPlusTranslation: { clientPrice: '', costPrice: '' },
    translationOnly: { clientPrice: '', costPrice: '' },
  },
};

export default function DocumentTypesPage() {
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

  // Fetch document types
  const loadItems = async () => {
    setLoading(true);
    const { ok, data } = await apiFetch('/document-types');
    if (ok && Array.isArray(data)) {
      setItems(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, []);

  // Distinct categories for autocomplete datalist
  const distinctCategories = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtered and searched items
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

  // Clean up object URLs on unmount or file change
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
      shortName: item.shortName || '',
      fullName: item.fullName || '',
      code: item.code || '',
      slug: item.slug || '',
      category: item.category || '',
      originLanguage: item.originLanguage || '',
      defaultSource: item.defaultSource || 'local',
      estimatedTurnaroundDays: item.estimatedTurnaroundDays ?? '',
      sortOrder: item.sortOrder ?? 0,
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

    // If an example image exists, fetch a signed/authenticated object URL
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

  // Toggle active status via PATCH (soft delete / reactivate)
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

    // Client-side validations
    if (!formData.shortName.trim()) {
      setFormError('Short name is required.');
      return;
    }
    if (!formData.fullName.trim()) {
      setFormError('Full name is required.');
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

    // Build payload
    const payload = {
      shortName: formData.shortName.trim(),
      fullName: formData.fullName.trim(),
      description: formData.description.trim(),
      category: formData.category.trim(),
      originLanguage: formData.originLanguage.trim(),
      defaultSource: formData.defaultSource,
      hasTranslation: formData.hasTranslation,
      active: formData.active,
      sortOrder: Number(formData.sortOrder) || 0,
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

    if (formData.slug.trim()) {
      payload.slug = formData.slug.trim().toLowerCase();
    }

    // Code handling:
    // If creating: omit field entirely if blank!
    // If editing: only send if changed (e.g. setting code for first time)
    const trimmedCode = formData.code.trim();
    if (!editingItem) {
      if (trimmedCode) payload.code = trimmedCode.toUpperCase();
    } else {
      // Editing existing item: if item had no code and now has one:
      if (!editingItem.code && trimmedCode) {
        payload.code = trimmedCode.toUpperCase();
      }
    }

    // Translation pricing:
    // If hasTranslation is true, include translation prices.
    // If false, DO NOT include them in payload (prevents rejection).
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

    // If an image file was selected, upload it now
    if (selectedFile && savedDoc?._id) {
      const uploadRes = await apiUpload(`/document-types/${savedDoc._id}/example-image`, selectedFile);
      if (!uploadRes.ok) {
        alert(`Document type saved, but image upload failed: ${uploadRes.data?.error || 'Upload error'}`);
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
      {/* Page Header */}
      <div className="console-page-header">
        <div>
          <h1 className="console-page-title">{STRINGS.docTypes.title}</h1>
          <p className="console-page-subtitle">{STRINGS.docTypes.subtitle}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          {STRINGS.docTypes.createNew}
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
            placeholder="Search code, name, category…"
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
              <th style={{ width: 80 }}>{STRINGS.docTypes.code}</th>
              <th>{STRINGS.docTypes.shortName}</th>
              <th>{STRINGS.docTypes.category}</th>
              <th>{STRINGS.docTypes.defaultSource}</th>
              <th style={{ textAlign: 'right' }}>{STRINGS.docTypes.clientPrice}</th>
              <th style={{ width: 100, textAlign: 'center' }}>{STRINGS.common.status}</th>
              <th style={{ width: 90, textAlign: 'right' }}>{STRINGS.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="console-table-empty">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span className="spinner" />
                    <span>{STRINGS.common.loading}</span>
                  </div>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan="7" className="console-table-empty">
                  {STRINGS.common.noRecords}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item._id} style={{ opacity: item.active ? 1 : 0.65 }}>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {item.code || <span style={{ color: 'var(--ink-2)' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.shortName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
                      {item.fullName}
                      {item.hasTranslation && (
                        <span style={{ marginInlineStart: 6, color: 'var(--attention)', fontWeight: 600 }}>
                          [+ Translation available]
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {item.category ? (
                      <span className="badge badge-progress">{item.category}</span>
                    ) : (
                      <span style={{ color: 'var(--ink-2)', fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>
                  <td>
                    {item.defaultSource === 'local' ? (
                      <span className="badge badge-ok">Local (Algeria)</span>
                    ) : (
                      <span className="badge badge-china">China</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {item.pricing?.originalOnly?.clientPrice != null ? (
                      <>
                        <span>{item.pricing.originalOnly.clientPrice.toLocaleString()} DZD</span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--ink-2)', fontWeight: 400 }}>
                          Cost: {item.pricing.originalOnly.costPrice?.toLocaleString() ?? 0} DZD
                        </div>
                      </>
                    ) : (
                      <span style={{ color: 'var(--ink-2)' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`toggle-btn ${item.active ? 'is-active' : 'is-inactive'}`}
                      onClick={() => handleToggleActive(item)}
                      disabled={actionLoadingId === item._id}
                      title="Click to toggle status"
                    >
                      {actionLoadingId === item._id ? (
                        <span className="spinner" />
                      ) : (
                        <span>{item.active ? 'Active' : 'Inactive'}</span>
                      )}
                    </button>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEditModal(item)}
                    >
                      {STRINGS.common.edit}
                    </button>
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-header">
              <h2 id="modal-title" className="modal-title">
                {editingItem ? STRINGS.docTypes.editTitle : STRINGS.docTypes.createTitle}
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

                {/* Primary Identifiers */}
                <div className="form-section">
                  <div className="form-section-title">Core Identity</div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="doc-shortName">
                        {STRINGS.docTypes.shortName} <span className="required">*</span>
                      </label>
                      <input
                        id="doc-shortName"
                        type="text"
                        className="form-input"
                        placeholder={STRINGS.docTypes.shortNamePlaceholder}
                        value={formData.shortName}
                        onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                        required
                        disabled={formSubmitting}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="doc-code">
                        {STRINGS.docTypes.code}
                      </label>
                      <input
                        id="doc-code"
                        type="text"
                        className="form-input mono"
                        placeholder={STRINGS.docTypes.codePlaceholder}
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        disabled={formSubmitting || (Boolean(editingItem) && Boolean(editingItem.code))}
                      />
                      <span className="form-hint">
                        {editingItem?.code
                          ? STRINGS.docTypes.codeImmutableNote
                          : STRINGS.docTypes.codeHint}
                      </span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="doc-fullName">
                      {STRINGS.docTypes.fullName} <span className="required">*</span>
                    </label>
                    <input
                      id="doc-fullName"
                      type="text"
                      className="form-input"
                      placeholder={STRINGS.docTypes.fullNamePlaceholder}
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      required
                      disabled={formSubmitting}
                    />
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="doc-category">
                        {STRINGS.docTypes.category}
                      </label>
                      <input
                        id="doc-category"
                        type="text"
                        list="category-suggestions"
                        className="form-input"
                        placeholder={STRINGS.docTypes.categoryPlaceholder}
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        disabled={formSubmitting}
                      />
                      <span className="form-hint">{STRINGS.docTypes.categoryHint}</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="doc-slug">
                        {STRINGS.docTypes.slug}
                      </label>
                      <input
                        id="doc-slug"
                        type="text"
                        className="form-input mono"
                        placeholder={STRINGS.docTypes.slugPlaceholder}
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                        disabled={formSubmitting}
                      />
                      <span className="form-hint">{STRINGS.docTypes.slugHint}</span>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="doc-originLanguage">
                        {STRINGS.docTypes.originLanguage}
                      </label>
                      <input
                        id="doc-originLanguage"
                        type="text"
                        className="form-input"
                        placeholder={STRINGS.docTypes.originLanguagePlaceholder}
                        value={formData.originLanguage}
                        onChange={(e) => setFormData({ ...formData, originLanguage: e.target.value })}
                        disabled={formSubmitting}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="doc-defaultSource">
                        {STRINGS.docTypes.defaultSource} <span className="required">*</span>
                      </label>
                      <select
                        id="doc-defaultSource"
                        className="form-select"
                        value={formData.defaultSource}
                        onChange={(e) => setFormData({ ...formData, defaultSource: e.target.value })}
                        disabled={formSubmitting}
                      >
                        <option value="local">{STRINGS.docTypes.sourceLocal}</option>
                        <option value="china">{STRINGS.docTypes.sourceChina}</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="doc-turnaround">
                        {STRINGS.docTypes.turnaround}
                      </label>
                      <input
                        id="doc-turnaround"
                        type="number"
                        min="0"
                        className="form-input"
                        placeholder={STRINGS.docTypes.turnaroundPlaceholder}
                        value={formData.estimatedTurnaroundDays}
                        onChange={(e) => setFormData({ ...formData, estimatedTurnaroundDays: e.target.value })}
                        disabled={formSubmitting}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="doc-sortOrder">
                        {STRINGS.docTypes.sortOrder}
                      </label>
                      <input
                        id="doc-sortOrder"
                        type="number"
                        className="form-input"
                        value={formData.sortOrder}
                        onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                        disabled={formSubmitting}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="doc-description">
                      {STRINGS.docTypes.description}
                    </label>
                    <textarea
                      id="doc-description"
                      className="form-textarea"
                      placeholder={STRINGS.docTypes.descriptionPlaceholder}
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
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active (Catalog visibility)</span>
                  </label>
                </div>

                {/* Pricing Section */}
                <div className="form-section">
                  <div className="form-section-title">{STRINGS.docTypes.pricingSection}</div>

                  {/* Standard Tier (Always required) */}
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                      {STRINGS.docTypes.pricingOriginalOnly} <span className="required">*</span>
                    </div>
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label" htmlFor="price-orig-client">
                          {STRINGS.docTypes.clientPrice} <span className="required">*</span>
                        </label>
                        <input
                          id="price-orig-client"
                          type="number"
                          min="0"
                          step="1"
                          className="form-input"
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
                      <div className="form-group">
                        <label className="form-label" htmlFor="price-orig-cost">
                          {STRINGS.docTypes.costPrice} <span className="required">*</span>
                        </label>
                        <input
                          id="price-orig-cost"
                          type="number"
                          min="0"
                          step="1"
                          className="form-input"
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

                  {/* Translation Toggle */}
                  <div style={{ marginTop: 8 }}>
                    <label className="form-checkbox-row">
                      <input
                        type="checkbox"
                        checked={formData.hasTranslation}
                        onChange={(e) => setFormData({ ...formData, hasTranslation: e.target.checked })}
                        disabled={formSubmitting}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {STRINGS.docTypes.hasTranslation}
                      </span>
                    </label>
                    <span className="form-hint" style={{ display: 'block', marginInlineStart: 24, marginTop: 2 }}>
                      {STRINGS.docTypes.hasTranslationHint}
                    </span>
                  </div>

                  {/* Conditional Translation Pricing: ONLY visible when hasTranslation is true */}
                  {formData.hasTranslation && (
                    <div style={{
                      padding: 'var(--space-md)',
                      background: 'var(--page-2)',
                      borderRadius: 'var(--radius-console)',
                      border: '1px dashed var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-md)',
                      marginTop: 4,
                    }}>
                      {/* Original + Translation */}
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                          {STRINGS.docTypes.pricingWithTranslation} <span className="required">*</span>
                        </div>
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label" htmlFor="price-opt-client">
                              {STRINGS.docTypes.clientPrice} <span className="required">*</span>
                            </label>
                            <input
                              id="price-opt-client"
                              type="number"
                              min="0"
                              step="1"
                              className="form-input"
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
                          <div className="form-group">
                            <label className="form-label" htmlFor="price-opt-cost">
                              {STRINGS.docTypes.costPrice} <span className="required">*</span>
                            </label>
                            <input
                              id="price-opt-cost"
                              type="number"
                              min="0"
                              step="1"
                              className="form-input"
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

                      {/* Translation Only */}
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                          {STRINGS.docTypes.pricingTranslationOnly} <span className="required">*</span>
                        </div>
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label" htmlFor="price-to-client">
                              {STRINGS.docTypes.clientPrice} <span className="required">*</span>
                            </label>
                            <input
                              id="price-to-client"
                              type="number"
                              min="0"
                              step="1"
                              className="form-input"
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
                          <div className="form-group">
                            <label className="form-label" htmlFor="price-to-cost">
                              {STRINGS.docTypes.costPrice} <span className="required">*</span>
                            </label>
                            <input
                              id="price-to-cost"
                              type="number"
                              min="0"
                              step="1"
                              className="form-input"
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

                {/* Example Image Section */}
                <div className="form-section">
                  <div className="form-section-title">{STRINGS.docTypes.imageSection}</div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                    {/* Preview box */}
                    {(imagePreviewUrl || existingImageUrl) ? (
                      <div className="img-preview-wrap">
                        <img
                          src={imagePreviewUrl || existingImageUrl}
                          alt="Document preview"
                        />
                      </div>
                    ) : (
                      <div style={{
                        width: 140,
                        height: 90,
                        border: '2px dashed var(--line)',
                        borderRadius: 'var(--radius-console)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        color: 'var(--ink-2)',
                        textAlign: 'center',
                        padding: 8,
                      }}>
                        {STRINGS.docTypes.noImageYet}
                      </div>
                    )}

                    {/* File picker */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                        disabled={formSubmitting}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={formSubmitting}
                      >
                        {(imagePreviewUrl || existingImageUrl) ? STRINGS.docTypes.replaceImage : STRINGS.docTypes.uploadImage}
                      </button>
                      <span className="form-hint">
                        PNG, JPG, or WEBP up to 12MB. Stored directly in system database.
                      </span>
                      {selectedFile && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--ok)', fontWeight: 600 }}>
                          Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                        </span>
                      )}
                    </div>
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
                      <span>{editingItem ? STRINGS.common.saving : STRINGS.common.creating}</span>
                    </>
                  ) : (
                    <span>{editingItem ? STRINGS.common.save : STRINGS.common.create}</span>
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
