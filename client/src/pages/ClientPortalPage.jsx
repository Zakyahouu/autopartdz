import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../utils/api';
import PublicNavbar from '../components/public/PublicNavbar';
import '../styles/moment.css';
import {
  FileText,
  Search,
  Check,
  CheckCircle2,
  Copy,
  Printer,
  PlusCircle,
  AlertCircle,
  ExternalLink,
  Car,
  User,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';

export default function ClientPortalPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'ar';
  const isRtl = locale === 'ar';

  // Mode: 'new' (New Demand) or 'correction' (Correction Request)
  const [activeTab, setActiveTab] = useState('new');

  // ── New Demand State ────────────────────────────────────────────────────────
  const [step, setStep] = useState(1); // 1: Category, 2: Docs, 3: Client Info, 4: Review, 5: Stamped
  const [categories, setCategories] = useState([]);
  const [catalogDocs, setCatalogDocs] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Selections
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  // Map of docId -> { selected: boolean, translationMode: 'original_only' | 'original_plus_translation' | 'translation_only' }
  const [selectedDocsMap, setSelectedDocsMap] = useState({});

  // Client form
  const [clientForm, setClientForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    wilaya: '',
    address: '',
    email: '',
    passportNumber: '',
    vin: '',
    carModel: '',
    importAgency: '',
    note: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null); // { trackingCode, orderId }
  const [copiedCode, setCopiedCode] = useState(false);

  // Sample image modal
  const [sampleModalUrl, setSampleModalUrl] = useState(null);

  // ── Correction State ────────────────────────────────────────────────────────
  const [lookupData, setLookupData] = useState({
    trackingCode: '',
    phone: '',
    vin: '',
  });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState(null); // original order + lines
  // Map of lineId -> { flagged: boolean, reason: string }
  const [correctionFlags, setCorrectionFlags] = useState({});
  const [correctionContact, setCorrectionContact] = useState({});
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionResult, setCorrectionResult] = useState(null); // { trackingCode, orderId }

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const fetchCatalogData = async () => {
    setLoadingCatalog(true);
    const [catRes, docRes] = await Promise.all([
      apiFetch(`/public/car-categories?locale=${locale}`),
      apiFetch(`/public/document-types?locale=${locale}`),
    ]);

    if (catRes.ok && Array.isArray(catRes.data)) {
      setCategories(catRes.data);
    }
    if (docRes.ok && Array.isArray(docRes.data)) {
      setCatalogDocs(docRes.data);
    }
    setLoadingCatalog(false);
  };

  useEffect(() => {
    fetchCatalogData();
  }, [locale]);

  // When category changes in Step 1, auto-select required docs
  const handleCategorySelect = (catId) => {
    setSelectedCategoryId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;

    const requiredIds = new Set((cat.requiredDocumentTypes || []).map((d) => d.id));
    setSelectedDocsMap((prev) => {
      const next = { ...prev };
      // Pre-check all required docs
      requiredIds.forEach((id) => {
        if (!next[id]) {
          next[id] = { selected: true, translationMode: 'original_only' };
        } else {
          next[id] = { ...next[id], selected: true };
        }
      });
      return next;
    });
  };

  const toggleDocSelected = (docId) => {
    setSelectedDocsMap((prev) => {
      const current = prev[docId];
      if (current && current.selected) {
        return { ...prev, [docId]: { ...current, selected: false } };
      }
      return {
        ...prev,
        [docId]: {
          selected: true,
          translationMode: current?.translationMode || 'original_only',
        },
      };
    });
  };

  const setDocTranslationMode = (docId, mode) => {
    setSelectedDocsMap((prev) => ({
      ...prev,
      [docId]: {
        selected: true,
        translationMode: mode,
      },
    }));
  };

  // Pricing calculation
  const { selectedDocsList, estimatedTotalDZD } = useMemo(() => {
    const list = [];
    let total = 0;

    catalogDocs.forEach((doc) => {
      const state = selectedDocsMap[doc.id];
      if (state && state.selected) {
        const mode = state.translationMode || 'original_only';
        let price = 0;
        if (mode === 'original_only') {
          price = doc.pricing?.originalOnly?.clientPrice || 0;
        } else if (mode === 'original_plus_translation') {
          price = doc.pricing?.originalPlusTranslation?.clientPrice || 0;
        } else if (mode === 'translation_only') {
          price = doc.pricing?.translationOnly?.clientPrice || 0;
        }
        total += price;
        list.push({ doc, mode, price });
      }
    });

    return { selectedDocsList: list, estimatedTotalDZD: total };
  }, [catalogDocs, selectedDocsMap]);

  // Validation
  const validateClientInfo = () => {
    const errs = {};
    if (!clientForm.firstName.trim()) errs.firstName = true;
    if (!clientForm.lastName.trim()) errs.lastName = true;
    if (!clientForm.phone.trim()) errs.phone = true;
    if (!clientForm.wilaya.trim()) errs.wilaya = true;
    if (!clientForm.address.trim()) errs.address = true;
    if (!clientForm.vin.trim()) errs.vin = true;
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (selectedDocsList.length === 0) {
        alert(t('docStep.noDocsSelected'));
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (validateClientInfo()) {
        setStep(4);
      }
    }
  };

  // Submit New Demand
  const handleSubmitNewDemand = async () => {
    setSubmitting(true);

    const payload = {
      ...clientForm,
      carCategoryId: selectedCategoryId || null,
      documents: selectedDocsList.map(({ doc, mode }) => ({
        documentTypeId: doc.id,
        translationMode: mode,
      })),
    };

    const res = await apiFetch('/public/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (res.ok && res.data?.trackingCode) {
      setSubmissionResult(res.data);
      setStep(5);
    } else {
      alert(res.data?.error || t('common.error'));
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const resetNewDemand = () => {
    setSelectedCategoryId('');
    setSelectedDocsMap({});
    setClientForm({
      firstName: '',
      lastName: '',
      phone: '',
      wilaya: '',
      address: '',
      email: '',
      passportNumber: '',
      vin: '',
      carModel: '',
      importAgency: '',
      note: '',
    });
    setSubmissionResult(null);
    setStep(1);
  };

  // ── Correction Handlers ─────────────────────────────────────────────────────
  const handleLookupOrder = async (e) => {
    e.preventDefault();
    setLookupError('');

    if (!lookupData.trackingCode.trim()) {
      setLookupError('Tracking code is required.');
      return;
    }
    if (!lookupData.phone.trim() && !lookupData.vin.trim()) {
      setLookupError('Please enter either your registered phone number or VIN number.');
      return;
    }

    setLookupLoading(true);
    const res = await apiFetch(`/public/orders/correction/lookup?locale=${locale}`, {
      method: 'POST',
      body: JSON.stringify(lookupData),
    });
    setLookupLoading(false);

    if (res.ok && res.data) {
      setLookupResult(res.data);
      setCorrectionContact({
        firstName: res.data.firstName || '',
        lastName: res.data.lastName || '',
        phone: res.data.phone || '',
        wilaya: res.data.wilaya || '',
        address: res.data.address || '',
        email: res.data.email || '',
        vin: res.data.vin || '',
        carModel: res.data.carModel || '',
        importAgency: res.data.importAgency || '',
      });
      // Initialize flags
      const initialFlags = {};
      (res.data.orderDocumentLines || []).forEach((l) => {
        initialFlags[l.id] = { flagged: false, reason: '' };
      });
      setCorrectionFlags(initialFlags);
    } else {
      setLookupError(res.data?.error || t('correction.errorNotFound'));
    }
  };

  const handleToggleCorrectionFlag = (lineId) => {
    setCorrectionFlags((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        flagged: !prev[lineId]?.flagged,
      },
    }));
  };

  const handleCorrectionReasonChange = (lineId, text) => {
    setCorrectionFlags((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        reason: text,
      },
    }));
  };

  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    if (!lookupResult) return;

    const flaggedItems = Object.entries(correctionFlags)
      .filter(([_, val]) => val.flagged)
      .map(([lineId, val]) => ({
        originalLineId: lineId,
        reason: val.reason.trim(),
      }));

    if (flaggedItems.length === 0) {
      alert('Please check at least one document line that needs correction.');
      return;
    }

    const missingReason = flaggedItems.find((item) => !item.reason);
    if (missingReason) {
      alert('Please specify the reason for each flagged document line.');
      return;
    }

    setCorrectionSubmitting(true);
    const res = await apiFetch('/public/orders/correction', {
      method: 'POST',
      body: JSON.stringify({
        originalOrderId: lookupResult.id,
        corrections: flaggedItems,
        updates: correctionContact,
      }),
    });
    setCorrectionSubmitting(false);

    if (res.ok && res.data?.trackingCode) {
      setCorrectionResult(res.data);
    } else {
      alert(res.data?.error || t('common.error'));
    }
  };

  return (
    <div className="moment-shell">
      <PublicNavbar />

      <main className="moment-container">
        {/* Dossier Tabs: Choose Flow */}
        <div className="dossier-tab-row">
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => { setActiveTab('new'); }}
          >
            <Car size={16} />
            <span>{t('nav.newDemand')}</span>
          </button>
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'correction' ? 'active' : ''}`}
            onClick={() => { setActiveTab('correction'); }}
          >
            <RotateCcw size={16} />
            <span>{t('nav.correction')}</span>
          </button>
        </div>

        {/* Main Folder Surface */}
        <div className="dossier-folder">
          {/* ══════════════════════════════════════════════════════════════════
              FLOW A: NEW DEMAND
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'new' && (
            <div>
              {/* Stepper (Steps 1–4) */}
              {step <= 4 && (
                <div className="moment-stepper">
                  <div className={`moment-step-item ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>
                    <span className="moment-step-num">{step > 1 ? '✓' : '1'}</span>
                    <span>{t('stepper.category')}</span>
                  </div>
                  <div className={`moment-step-item ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>
                    <span className="moment-step-num">{step > 2 ? '✓' : '2'}</span>
                    <span>{t('stepper.documents')}</span>
                  </div>
                  <div className={`moment-step-item ${step === 3 ? 'active' : step > 3 ? 'done' : ''}`}>
                    <span className="moment-step-num">{step > 3 ? '✓' : '3'}</span>
                    <span>{t('stepper.clientInfo')}</span>
                  </div>
                  <div className={`moment-step-item ${step === 4 ? 'active' : ''}`}>
                    <span className="moment-step-num">4</span>
                    <span>{t('stepper.review')}</span>
                  </div>
                </div>
              )}

              {/* STEP 1: CATEGORY SELECTION */}
              {step === 1 && (
                <div>
                  <h1 className="moment-step-title">{t('categoryStep.title')}</h1>
                  <p className="moment-step-desc">{t('categoryStep.subtitle')}</p>

                  {loadingCatalog ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-2)' }}>
                      {t('categoryStep.loading')}
                    </div>
                  ) : (
                    <div className="moment-card-grid">
                      {categories.map((cat) => {
                        const isSelected = selectedCategoryId === cat.id;
                        return (
                          <div
                            key={cat.id}
                            className={`moment-select-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleCategorySelect(cat.id)}
                          >
                            <div className="moment-card-title">
                              <span>{cat.name}</span>
                              {isSelected && <Check size={18} color="var(--stamp)" strokeWidth={3} />}
                            </div>
                            <div className="moment-card-desc">
                              {cat.description || 'Standard customs clearance profile.'}
                            </div>
                            <span className="moment-badge moment-badge-stamp">
                              {t('categoryStep.requiredCount', {
                                count: cat.requiredDocumentTypes?.length || 0,
                              })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="moment-actions" style={{ justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="moment-btn moment-btn-primary"
                      onClick={handleNextStep}
                    >
                      <span>{t('categoryStep.continueBtn')}</span>
                      {isRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: DOCUMENTS SELECTION */}
              {step === 2 && (
                <div>
                  <h1 className="moment-step-title">{t('docStep.title')}</h1>
                  <p className="moment-step-desc">{t('docStep.subtitle')}</p>

                  <div style={{ marginBottom: 20 }}>
                    {catalogDocs.map((doc) => {
                      const isSelected = Boolean(selectedDocsMap[doc.id]?.selected);
                      const currentMode = selectedDocsMap[doc.id]?.translationMode || 'original_only';

                      return (
                        <div
                          key={doc.id}
                          className={`moment-doc-row ${isSelected ? 'selected' : ''}`}
                        >
                          <div className="moment-doc-info">
                            <div className="moment-doc-header">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleDocSelected(doc.id)}
                                style={{ accentColor: 'var(--stamp)', transform: 'scale(1.2)' }}
                              />
                              {doc.code && <span className="moment-doc-code">{doc.code}</span>}
                              <span className="moment-doc-name">{doc.fullName}</span>
                              {doc.category && (
                                <span className="moment-badge moment-badge-china">{doc.category}</span>
                              )}
                            </div>

                            {doc.description && (
                              <div className="moment-doc-sub" style={{ margin: '4px 0 6px 24px' }}>
                                {doc.description}
                              </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 24 }}>
                              <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                                {doc.estimatedTurnaroundDays
                                  ? t('docStep.turnaround', { days: doc.estimatedTurnaroundDays })
                                  : t('docStep.turnaroundUnknown')}
                              </span>

                              {doc.exampleImageFileId && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSampleModalUrl(`/api/public/files/${doc.exampleImageFileId}`);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--china)',
                                    fontSize: 11.5,
                                    textDecoration: 'underline',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <span>{t('docStep.sampleView')}</span>
                                  <ExternalLink size={11} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Options and Pricing */}
                          <div className="moment-doc-options">
                            {doc.hasTranslation ? (
                              <select
                                className="moment-select"
                                style={{ fontSize: 12, height: 32, padding: '2px 8px' }}
                                value={currentMode}
                                onChange={(e) => setDocTranslationMode(doc.id, e.target.value)}
                                disabled={!isSelected}
                              >
                                <option value="original_only">
                                  {t('docStep.translationModes.original_only')} (
                                  {doc.pricing?.originalOnly?.clientPrice} DZD)
                                </option>
                                <option value="original_plus_translation">
                                  {t('docStep.translationModes.original_plus_translation')} (
                                  {doc.pricing?.originalPlusTranslation?.clientPrice} DZD)
                                </option>
                                <option value="translation_only">
                                  {t('docStep.translationModes.translation_only')} (
                                  {doc.pricing?.translationOnly?.clientPrice} DZD)
                                </option>
                              </select>
                            ) : (
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
                                {doc.pricing?.originalOnly?.clientPrice} DZD
                              </span>
                            )}

                            <button
                              type="button"
                              className={`moment-btn ${isSelected ? 'moment-btn-secondary' : 'moment-btn-primary'}`}
                              style={{ padding: '4px 12px', fontSize: 12.5 }}
                              onClick={() => toggleDocSelected(doc.id)}
                            >
                              {isSelected ? t('docStep.removeDoc') : t('docStep.addDoc')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Running Total Box */}
                  <div className="moment-total-box">
                    <div>
                      <div className="moment-total-title">{t('docStep.estTotal')}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                        {selectedDocsList.length} document(s) selected
                      </div>
                    </div>
                    <div className="moment-total-amount">
                      {estimatedTotalDZD.toLocaleString()} {t('common.currency')}
                    </div>
                  </div>

                  <div className="moment-actions">
                    <button
                      type="button"
                      className="moment-btn moment-btn-secondary"
                      onClick={() => setStep(1)}
                    >
                      {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                      <span>{t('common.back')}</span>
                    </button>
                    <button
                      type="button"
                      className="moment-btn moment-btn-primary"
                      onClick={handleNextStep}
                    >
                      <span>{t('docStep.continueBtn')}</span>
                      {isRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: CLIENT & VEHICLE INFORMATION */}
              {step === 3 && (
                <div>
                  <h1 className="moment-step-title">{t('infoStep.title')}</h1>
                  <p className="moment-step-desc">{t('infoStep.subtitle')}</p>

                  <div className="moment-form-grid">
                    <div className="moment-field">
                      <label className="moment-label">
                        {t('infoStep.firstName')} <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        className="moment-input"
                        placeholder={t('infoStep.firstNamePlaceholder')}
                        value={clientForm.firstName}
                        onChange={(e) => setClientForm({ ...clientForm, firstName: e.target.value })}
                        style={{ borderColor: formErrors.firstName ? 'var(--stamp)' : undefined }}
                      />
                    </div>

                    <div className="moment-field">
                      <label className="moment-label">
                        {t('infoStep.lastName')} <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        className="moment-input"
                        placeholder={t('infoStep.lastNamePlaceholder')}
                        value={clientForm.lastName}
                        onChange={(e) => setClientForm({ ...clientForm, lastName: e.target.value })}
                        style={{ borderColor: formErrors.lastName ? 'var(--stamp)' : undefined }}
                      />
                    </div>
                  </div>

                  <div className="moment-form-grid">
                    <div className="moment-field">
                      <label className="moment-label">
                        {t('infoStep.phone')} <span className="required">*</span>
                      </label>
                      <input
                        type="tel"
                        className="moment-input mono"
                        placeholder={t('infoStep.phonePlaceholder')}
                        value={clientForm.phone}
                        onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                        style={{ borderColor: formErrors.phone ? 'var(--stamp)' : undefined }}
                      />
                    </div>

                    <div className="moment-field">
                      <label className="moment-label">
                        {t('infoStep.wilaya')} <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        className="moment-input"
                        placeholder={t('infoStep.wilayaPlaceholder')}
                        value={clientForm.wilaya}
                        onChange={(e) => setClientForm({ ...clientForm, wilaya: e.target.value })}
                        style={{ borderColor: formErrors.wilaya ? 'var(--stamp)' : undefined }}
                      />
                    </div>
                  </div>

                  <div className="moment-field" style={{ marginBottom: 16 }}>
                    <label className="moment-label">
                      {t('infoStep.address')} <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="moment-input"
                      placeholder={t('infoStep.addressPlaceholder')}
                      value={clientForm.address}
                      onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                      style={{ borderColor: formErrors.address ? 'var(--stamp)' : undefined }}
                    />
                  </div>

                  <div className="moment-form-grid">
                    <div className="moment-field">
                      <label className="moment-label">
                        {t('infoStep.vin')} <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        className="moment-input mono"
                        placeholder={t('infoStep.vinPlaceholder')}
                        value={clientForm.vin}
                        onChange={(e) => setClientForm({ ...clientForm, vin: e.target.value.toUpperCase() })}
                        style={{ borderColor: formErrors.vin ? 'var(--stamp)' : undefined }}
                      />
                    </div>

                    <div className="moment-field">
                      <label className="moment-label">{t('infoStep.carModel')}</label>
                      <input
                        type="text"
                        className="moment-input"
                        placeholder={t('infoStep.carModelPlaceholder')}
                        value={clientForm.carModel}
                        onChange={(e) => setClientForm({ ...clientForm, carModel: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="moment-form-grid">
                    <div className="moment-field">
                      <label className="moment-label">{t('infoStep.email')}</label>
                      <input
                        type="email"
                        className="moment-input mono"
                        placeholder={t('infoStep.emailPlaceholder')}
                        value={clientForm.email}
                        onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                      />
                    </div>

                    <div className="moment-field">
                      <label className="moment-label">{t('infoStep.passportNumber')}</label>
                      <input
                        type="text"
                        className="moment-input mono"
                        placeholder={t('infoStep.passportPlaceholder')}
                        value={clientForm.passportNumber}
                        onChange={(e) => setClientForm({ ...clientForm, passportNumber: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="moment-form-grid">
                    <div className="moment-field">
                      <label className="moment-label">{t('infoStep.importAgency')}</label>
                      <input
                        type="text"
                        className="moment-input"
                        placeholder={t('infoStep.importAgencyPlaceholder')}
                        value={clientForm.importAgency}
                        onChange={(e) => setClientForm({ ...clientForm, importAgency: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="moment-field">
                    <label className="moment-label">{t('infoStep.note')}</label>
                    <textarea
                      className="moment-textarea"
                      placeholder={t('infoStep.notePlaceholder')}
                      value={clientForm.note}
                      onChange={(e) => setClientForm({ ...clientForm, note: e.target.value })}
                    />
                  </div>

                  <div className="moment-actions">
                    <button
                      type="button"
                      className="moment-btn moment-btn-secondary"
                      onClick={() => setStep(2)}
                    >
                      {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                      <span>{t('common.back')}</span>
                    </button>
                    <button
                      type="button"
                      className="moment-btn moment-btn-primary"
                      onClick={handleNextStep}
                    >
                      <span>{t('infoStep.continueBtn')}</span>
                      {isRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & VERIFICATION */}
              {step === 4 && (
                <div>
                  <h1 className="moment-step-title">{t('reviewStep.title')}</h1>
                  <p className="moment-step-desc">{t('reviewStep.subtitle')}</p>

                  <div className="moment-form-grid" style={{ marginBottom: 20 }}>
                    <div style={{ background: 'var(--page-2)', padding: 16, borderRadius: 6, border: '1.5px solid var(--ink)' }}>
                      <div style={{ fontFamily: 'Reem Kufi', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                        {t('reviewStep.clientSummary')}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                        <div><strong>Name:</strong> {clientForm.firstName} {clientForm.lastName}</div>
                        <div><strong>Phone:</strong> <span style={{ direction: 'ltr', display: 'inline-block' }}>{clientForm.phone}</span></div>
                        <div><strong>Wilaya / Address:</strong> {clientForm.wilaya} — {clientForm.address}</div>
                        {clientForm.email && <div><strong>Email:</strong> {clientForm.email}</div>}
                        {clientForm.passportNumber && <div><strong>Passport:</strong> {clientForm.passportNumber}</div>}
                      </div>
                    </div>

                    <div style={{ background: 'var(--page-2)', padding: 16, borderRadius: 6, border: '1.5px solid var(--ink)' }}>
                      <div style={{ fontFamily: 'Reem Kufi', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                        {t('reviewStep.vehicleSummary')}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                        <div><strong>VIN:</strong> <code style={{ fontFamily: 'JetBrains Mono', color: 'var(--stamp)', fontWeight: 700 }}>{clientForm.vin}</code></div>
                        <div><strong>Model:</strong> {clientForm.carModel || '—'}</div>
                        <div><strong>Category:</strong> {categories.find((c) => c.id === selectedCategoryId)?.name || 'Custom'}</div>
                        {clientForm.importAgency && <div><strong>Agency:</strong> {clientForm.importAgency}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Documents list */}
                  <div style={{ background: '#fff', border: '1.5px solid var(--ink)', borderRadius: 6, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontFamily: 'Reem Kufi', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
                      {t('reviewStep.dossierSummary', { count: selectedDocsList.length })}
                    </div>
                    {selectedDocsList.map(({ doc, mode, price }) => (
                      <div
                        key={doc.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: '1px dashed var(--line)',
                          fontSize: 13.5,
                        }}
                      >
                        <div>
                          <strong>{doc.fullName}</strong>
                          <span style={{ fontSize: 12, color: 'var(--ink-2)', marginInlineStart: 8 }}>
                            ({t(`docStep.translationModes.${mode}`)})
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--stamp)', fontFamily: 'JetBrains Mono' }}>
                          {price.toLocaleString()} {t('common.currency')}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Amount */}
                  <div className="moment-total-box">
                    <div className="moment-total-title">{t('reviewStep.totalLabel')}</div>
                    <div className="moment-total-amount">
                      {estimatedTotalDZD.toLocaleString()} {t('common.currency')}
                    </div>
                  </div>

                  <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
                    {t('reviewStep.disclaimer')}
                  </p>

                  <div className="moment-actions">
                    <button
                      type="button"
                      className="moment-btn moment-btn-secondary"
                      onClick={() => setStep(3)}
                      disabled={submitting}
                    >
                      {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                      <span>{t('common.back')}</span>
                    </button>
                    <button
                      type="button"
                      className="moment-btn moment-btn-primary"
                      onClick={handleSubmitNewDemand}
                      disabled={submitting}
                    >
                      <span>{submitting ? t('reviewStep.submitting') : t('reviewStep.submitBtn')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: RUBBER STAMP RECEIPT SCREEN */}
              {step === 5 && submissionResult && (
                <div className="moment-stamp-container">
                  <h1 className="moment-step-title">{t('stampScreen.title')}</h1>
                  <p className="moment-step-desc">{t('stampScreen.subtitle')}</p>

                  {/* Rubber Stamp Box (Pinned LTR) */}
                  <div className="moment-rubber-stamp">
                    <span className="moment-rubber-code">{submissionResult.trackingCode}</span>
                    <span className="moment-rubber-sub">{t('stampScreen.stampBadge')}</span>
                  </div>

                  <div className="moment-stamp-notice">
                    {t('stampScreen.keepSafe')}
                  </div>

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="moment-btn moment-btn-primary"
                      onClick={() => handleCopyCode(submissionResult.trackingCode)}
                    >
                      <Copy size={16} />
                      <span>{copiedCode ? t('stampScreen.copied') : t('stampScreen.copyBtn')}</span>
                    </button>

                    <button
                      type="button"
                      className="moment-btn moment-btn-secondary"
                      onClick={() => window.print()}
                    >
                      <Printer size={16} />
                      <span>{t('stampScreen.printBtn')}</span>
                    </button>

                    <button
                      type="button"
                      className="moment-btn moment-btn-secondary"
                      onClick={resetNewDemand}
                    >
                      <PlusCircle size={16} />
                      <span>{t('stampScreen.newDemandBtn')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              FLOW B: CORRECTION REQUEST
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'correction' && (
            <div>
              {!lookupResult && !correctionResult && (
                <div>
                  <h1 className="moment-step-title">{t('correction.title')}</h1>
                  <p className="moment-step-desc">{t('correction.subtitle')}</p>

                  <form onSubmit={handleLookupOrder} style={{ maxWidth: 520, margin: '20px auto 0' }}>
                    {lookupError && (
                      <div style={{ background: 'rgba(168, 35, 27, 0.08)', border: '1.5px solid var(--stamp)', padding: 12, borderRadius: 6, marginBottom: 16, color: 'var(--stamp)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                        <span>{lookupError}</span>
                      </div>
                    )}

                    <div className="moment-field" style={{ marginBottom: 16 }}>
                      <label className="moment-label">
                        {t('correction.trackingCode')} <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        className="moment-input mono"
                        placeholder={t('correction.trackingCodePlaceholder')}
                        value={lookupData.trackingCode}
                        onChange={(e) => setLookupData({ ...lookupData, trackingCode: e.target.value.toUpperCase() })}
                        required
                        disabled={lookupLoading}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div className="moment-field">
                        <label className="moment-label">{t('correction.phone')}</label>
                        <input
                          type="tel"
                          className="moment-input mono"
                          placeholder="05 / 06 / 07 XX..."
                          value={lookupData.phone}
                          onChange={(e) => setLookupData({ ...lookupData, phone: e.target.value })}
                          disabled={lookupLoading}
                        />
                      </div>

                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', paddingTop: 18 }}>
                        {t('correction.orLabel')}
                      </div>

                      <div className="moment-field">
                        <label className="moment-label">{t('correction.vin')}</label>
                        <input
                          type="text"
                          className="moment-input mono"
                          placeholder="VIN (17 chars)"
                          value={lookupData.vin}
                          onChange={(e) => setLookupData({ ...lookupData, vin: e.target.value.toUpperCase() })}
                          disabled={lookupLoading}
                        />
                      </div>
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 20, textAlign: 'center' }}>
                      Security Rule: Tracking code must be accompanied by either your registered phone number or chassis VIN.
                    </p>

                    <button
                      type="submit"
                      className="moment-btn moment-btn-primary"
                      style={{ width: '100%' }}
                      disabled={lookupLoading}
                    >
                      <Search size={16} />
                      <span>{lookupLoading ? t('correction.lookingUp') : t('correction.lookupBtn')}</span>
                    </button>
                  </form>
                </div>
              )}

              {/* Show original order lines and flag correction form */}
              {lookupResult && !correctionResult && (
                <form onSubmit={handleSubmitCorrection}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h1 className="moment-step-title">{t('correction.originalDossier', { code: lookupResult.trackingCode })}</h1>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                        {t('correction.clientName', { name: `${lookupResult.firstName} ${lookupResult.lastName}` })} — VIN: {lookupResult.vin}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="moment-btn moment-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => setLookupResult(null)}
                    >
                      <RotateCcw size={14} />
                      <span>Search another dossier</span>
                    </button>
                  </div>

                  <p className="moment-step-desc">{t('correction.instruction')}</p>

                  <div style={{ marginBottom: 24 }}>
                    {(lookupResult.orderDocumentLines || []).map((line) => {
                      const isFlagged = Boolean(correctionFlags[line.id]?.flagged);
                      const reasonText = correctionFlags[line.id]?.reason || '';

                      return (
                        <div
                          key={line.id}
                          className={`moment-correction-card ${isFlagged ? 'flagged' : ''}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                              <input
                                type="checkbox"
                                checked={isFlagged}
                                onChange={() => handleToggleCorrectionFlag(line.id)}
                                style={{ accentColor: 'var(--stamp)', transform: 'scale(1.2)' }}
                              />
                              <span style={{ fontSize: 14 }}>{line.documentType?.fullName || 'Document Line'}</span>
                            </label>

                            <span className="moment-badge moment-badge-stamp">
                              Status: {line.status}
                            </span>
                          </div>

                          {isFlagged && (
                            <div style={{ marginTop: 12, paddingInlineStart: 24 }}>
                              <label className="moment-label" style={{ marginBottom: 4 }}>
                                {t('correction.reasonLabel')} <span className="required">*</span>
                              </label>
                              <textarea
                                className="moment-textarea"
                                placeholder={t('correction.reasonPlaceholder')}
                                value={reasonText}
                                onChange={(e) => handleCorrectionReasonChange(line.id, e.target.value)}
                                required
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Optional contact updates */}
                  <details style={{ background: 'var(--page-2)', padding: 14, borderRadius: 6, border: '1px solid var(--ink)', marginBottom: 24 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, fontFamily: 'Reem Kufi', fontSize: 14 }}>
                      {t('correction.contactUpdates')}
                    </summary>
                    <div className="moment-form-grid" style={{ marginTop: 14 }}>
                      <div className="moment-field">
                        <label className="moment-label">{t('infoStep.phone')}</label>
                        <input
                          type="tel"
                          className="moment-input mono"
                          value={correctionContact.phone || ''}
                          onChange={(e) => setCorrectionContact({ ...correctionContact, phone: e.target.value })}
                        />
                      </div>
                      <div className="moment-field">
                        <label className="moment-label">{t('infoStep.wilaya')}</label>
                        <input
                          type="text"
                          className="moment-input"
                          value={correctionContact.wilaya || ''}
                          onChange={(e) => setCorrectionContact({ ...correctionContact, wilaya: e.target.value })}
                        />
                      </div>
                      <div className="moment-field">
                        <label className="moment-label">{t('infoStep.address')}</label>
                        <input
                          type="text"
                          className="moment-input"
                          value={correctionContact.address || ''}
                          onChange={(e) => setCorrectionContact({ ...correctionContact, address: e.target.value })}
                        />
                      </div>
                      <div className="moment-field">
                        <label className="moment-label">{t('infoStep.email')}</label>
                        <input
                          type="email"
                          className="moment-input mono"
                          value={correctionContact.email || ''}
                          onChange={(e) => setCorrectionContact({ ...correctionContact, email: e.target.value })}
                        />
                      </div>
                    </div>
                  </details>

                  <div className="moment-actions">
                    <button
                      type="button"
                      className="moment-btn moment-btn-secondary"
                      onClick={() => setLookupResult(null)}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="moment-btn moment-btn-primary"
                      disabled={correctionSubmitting}
                    >
                      <span>{correctionSubmitting ? t('correction.submitting') : t('correction.submitCorrectionBtn')}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Correction Rubber Stamp Screen */}
              {correctionResult && (
                <div className="moment-stamp-container">
                  <h1 className="moment-step-title">{t('correction.successTitle')}</h1>
                  <p className="moment-step-desc">
                    {t('correction.linkedNotice', { originalCode: lookupResult?.trackingCode })}
                  </p>

                  <div className="moment-rubber-stamp">
                    <span className="moment-rubber-code">{correctionResult.trackingCode}</span>
                    <span className="moment-rubber-sub">CORRECTION FILED</span>
                  </div>

                  <div className="moment-stamp-notice">
                    {t('stampScreen.keepSafe')}
                  </div>

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="moment-btn moment-btn-primary"
                      onClick={() => handleCopyCode(correctionResult.trackingCode)}
                    >
                      <Copy size={16} />
                      <span>{copiedCode ? t('stampScreen.copied') : t('stampScreen.copyBtn')}</span>
                    </button>
                    <button
                      type="button"
                      className="moment-btn moment-btn-secondary"
                      onClick={() => {
                        setCorrectionResult(null);
                        setLookupResult(null);
                        setLookupData({ trackingCode: '', phone: '', vin: '' });
                      }}
                    >
                      <span>Done</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Official Sample Image Modal */}
      {sampleModalUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(22, 35, 63, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setSampleModalUrl(null)}
        >
          <div
            style={{
              background: '#fff',
              border: '2px solid var(--ink)',
              borderRadius: 8,
              padding: 16,
              maxWidth: 640,
              width: '100%',
              boxShadow: '-8px 8px 0 rgba(22, 35, 63, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'Reem Kufi', fontWeight: 700, fontSize: 16 }}>
                Official Specimen Preview
              </div>
              <button
                type="button"
                className="moment-btn moment-btn-secondary"
                style={{ padding: '4px 8px' }}
                onClick={() => setSampleModalUrl(null)}
              >
                ✕
              </button>
            </div>
            <img
              src={sampleModalUrl}
              alt="Official Sample Document"
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', border: '1px solid var(--line)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
