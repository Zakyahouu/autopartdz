import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Package,
  Copy,
  Check,
  FileText,
  Car,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import PublicNavbar from '../components/public/PublicNavbar';

export default function PublicTrackingPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [trackingCode, setTrackingCode] = useState('');
  const [verificationType, setVerificationType] = useState('phone'); // 'phone' | 'vin'
  const [phone, setPhone] = useState('');
  const [vin, setVin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const STAGES = [
    { key: 'needed', labelKey: 'tracking.stages.needed', icon: Clock },
    { key: 'in_progress', labelKey: 'tracking.stages.in_progress', icon: RefreshCw },
    { key: 'ready', labelKey: 'tracking.stages.ready', icon: CheckCircle2 },
    { key: 'delivered', labelKey: 'tracking.stages.delivered', icon: Package },
  ];

  const getStageIndex = (status) => {
    switch (status) {
      case 'needed':
        return 0;
      case 'in_progress':
        return 1;
      case 'ready':
        return 2;
      case 'delivered':
        return 3;
      default:
        return 0;
    }
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    setError('');

    const cleanCode = trackingCode.trim().toUpperCase();
    if (!cleanCode) {
      setError(t('tracking.codeLabel') + ' is required.');
      return;
    }

    if (cleanCode.length !== 8) {
      setError('Tracking code must be exactly 8 characters.');
      return;
    }

    const cleanPhone = phone.trim();
    const cleanVin = vin.trim().toUpperCase();

    if (verificationType === 'phone' && !cleanPhone) {
      setError(t('tracking.phoneLabel') + ' is required.');
      return;
    }
    if (verificationType === 'vin' && !cleanVin) {
      setError(t('tracking.vinLabel') + ' is required.');
      return;
    }

    setBusy(true);
    try {
      const params = new URLSearchParams({
        trackingCode: cleanCode,
        locale: i18n.language,
      });
      if (verificationType === 'phone') {
        params.append('phone', cleanPhone);
      } else {
        params.append('vin', cleanVin);
      }

      const res = await fetch(`/api/public/orders/track?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('tracking.notFound'));
        setResult(null);
        return;
      }

      setResult({
        ...data,
        trackingCode: cleanCode,
      });
    } catch (err) {
      console.error('[Tracking lookup error]', err);
      setError(t('common.error'));
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = () => {
    if (!result?.trackingCode) return;
    navigator.clipboard.writeText(result.trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetSearch = () => {
    setResult(null);
    setError('');
  };

  return (
    <div className="moment-shell" dir={isRtl ? 'rtl' : 'ltr'}>
      <PublicNavbar />

      <main className="moment-main" style={{ maxWidth: 840, margin: '0 auto', padding: '32px 16px' }}>
        {/* Page Title Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 20,
              backgroundColor: 'rgba(217, 119, 6, 0.1)',
              color: 'var(--moment-accent-amber)',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            <ShieldCheck size={16} />
            <span>{t('brand.title')}</span>
          </div>
          <h1 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, color: 'var(--moment-text-main)', margin: '0 0 8px 0' }}>
            {t('tracking.title')}
          </h1>
          <p style={{ fontSize: 15, color: 'var(--moment-text-muted)', margin: 0 }}>
            {t('tracking.subtitle')}
          </p>
        </div>

        {!result ? (
          /* Search Form Card */
          <div
            className="moment-card"
            style={{
              backgroundColor: 'var(--moment-surface)',
              borderRadius: 16,
              border: '1px solid var(--moment-border)',
              padding: 'clamp(20px, 4vw, 36px)',
              boxShadow: 'var(--moment-shadow)',
            }}
          >
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: 10,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#dc2626',
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLookup} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Tracking Code Field */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--moment-text-main)',
                    marginBottom: 6,
                  }}
                >
                  {t('tracking.codeLabel')} <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder={t('tracking.codePlaceholder')}
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    borderRadius: 10,
                    border: '1px solid var(--moment-border)',
                    backgroundColor: 'var(--moment-bg)',
                    color: 'var(--moment-text-main)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    textAlign: isRtl ? 'right' : 'left',
                  }}
                />
              </div>

              {/* Verification Type Toggle */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--moment-text-main)',
                    marginBottom: 8,
                  }}
                >
                  {t('tracking.verificationPrompt')} <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationType('phone');
                      setError('');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: `1.5px solid ${verificationType === 'phone' ? 'var(--moment-accent-amber)' : 'var(--moment-border)'}`,
                      backgroundColor: verificationType === 'phone' ? 'rgba(217, 119, 6, 0.08)' : 'transparent',
                      color: verificationType === 'phone' ? 'var(--moment-accent-amber)' : 'var(--moment-text-muted)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {t('tracking.phoneLabel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationType('vin');
                      setError('');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: `1.5px solid ${verificationType === 'vin' ? 'var(--moment-accent-amber)' : 'var(--moment-border)'}`,
                      backgroundColor: verificationType === 'vin' ? 'rgba(217, 119, 6, 0.08)' : 'transparent',
                      color: verificationType === 'vin' ? 'var(--moment-accent-amber)' : 'var(--moment-text-muted)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {t('tracking.vinLabel')}
                  </button>
                </div>

                {verificationType === 'phone' ? (
                  <input
                    type="text"
                    placeholder={t('tracking.phonePlaceholder')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: 15,
                      borderRadius: 10,
                      border: '1px solid var(--moment-border)',
                      backgroundColor: 'var(--moment-bg)',
                      color: 'var(--moment-text-main)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    maxLength={17}
                    placeholder={t('tracking.vinPlaceholder')}
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: 15,
                      borderRadius: 10,
                      border: '1px solid var(--moment-border)',
                      backgroundColor: 'var(--moment-bg)',
                      color: 'var(--moment-text-main)',
                      outline: 'none',
                      boxSizing: 'border-box',
                      textTransform: 'uppercase',
                    }}
                  />
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={busy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '14px',
                  borderRadius: 10,
                  backgroundColor: 'var(--moment-accent-amber)',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 700,
                  border: 'none',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.75 : 1,
                  marginTop: 6,
                  transition: 'background-color 0.2s',
                }}
              >
                {busy ? (
                  <>
                    <RefreshCw size={18} className="spin-animate" />
                    <span>{t('tracking.searching')}</span>
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    <span>{t('tracking.lookupBtn')}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Results View Card */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Top Dossier Banner */}
            <div
              className="moment-card"
              style={{
                backgroundColor: 'var(--moment-surface)',
                borderRadius: 16,
                border: '1px solid var(--moment-border)',
                padding: 24,
                boxShadow: 'var(--moment-shadow)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--moment-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('tracking.codeLabel')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--moment-accent-amber)' }}>
                      {result.trackingCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--moment-border)',
                        backgroundColor: 'var(--moment-bg)',
                        fontSize: 12,
                        color: 'var(--moment-text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Order Type Badge */}
                  <span
                    style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor: 'rgba(217, 119, 6, 0.1)',
                      color: 'var(--moment-accent-amber)',
                      border: '1px solid rgba(217, 119, 6, 0.2)',
                    }}
                  >
                    {t(`tracking.types.${result.orderType}`, result.orderType)}
                  </span>

                  {/* Overall Status Badge */}
                  <span
                    style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 700,
                      backgroundColor: result.orderStatus === 'delivered' ? 'rgba(22, 163, 74, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                      color: result.orderStatus === 'delivered' ? '#16a34a' : '#2563eb',
                      border: `1px solid ${result.orderStatus === 'delivered' ? 'rgba(22, 163, 74, 0.25)' : 'rgba(37, 99, 235, 0.25)'}`,
                    }}
                  >
                    {t(`tracking.orderStatuses.${result.orderStatus}`, result.orderStatus)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={resetSearch}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--moment-border)',
                    backgroundColor: 'transparent',
                    color: 'var(--moment-text-muted)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={14} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />
                  <span>{t('tracking.newSearch')}</span>
                </button>
              </div>
            </div>

            {/* Document Lines Progress Card List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--moment-text-main)' }}>
                {t('tracking.documentsHeader')} ({result.lines?.length || 0})
              </div>

              {result.lines?.map((line, idx) => {
                const currentStageIdx = getStageIndex(line.status);

                return (
                  <div
                    key={idx}
                    className="moment-card"
                    style={{
                      backgroundColor: 'var(--moment-surface)',
                      borderRadius: 14,
                      border: '1px solid var(--moment-border)',
                      padding: 20,
                      boxShadow: 'var(--moment-shadow)',
                    }}
                  >
                    {/* Line Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            backgroundColor: 'rgba(217, 119, 6, 0.1)',
                            color: 'var(--moment-accent-amber)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <FileText size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--moment-text-main)' }}>
                            {line.documentType?.fullName || 'Customs Document'}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--moment-text-muted)' }}>
                            {t(`tracking.stages.${line.status}`, line.status)}
                          </div>
                        </div>
                      </div>

                      {line.isDelayed && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 16,
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            color: '#b45309',
                            fontSize: 12,
                            fontWeight: 700,
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          <AlertTriangle size={14} />
                          <span>Delayed</span>
                        </span>
                      )}
                    </div>

                    {/* Delayed Warning Callout */}
                    {line.isDelayed && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '10px 14px',
                          borderRadius: 8,
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          color: '#92400e',
                          fontSize: 13,
                          marginBottom: 18,
                        }}
                      >
                        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{t('tracking.delayedNotice')}</span>
                      </div>
                    )}

                    {/* Progress Indicator Track */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, position: 'relative' }}>
                      {STAGES.map((stage, sIdx) => {
                        const isCompleted = sIdx < currentStageIdx;
                        const isCurrent = sIdx === currentStageIdx;
                        const StageIcon = stage.icon;

                        return (
                          <div
                            key={stage.key}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              textAlign: 'center',
                              gap: 6,
                            }}
                          >
                            {/* Milestone Circle */}
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isCurrent
                                  ? 'var(--moment-accent-amber)'
                                  : isCompleted
                                  ? 'rgba(22, 163, 74, 0.15)'
                                  : 'var(--moment-bg)',
                                color: isCurrent ? '#ffffff' : isCompleted ? '#16a34a' : 'var(--moment-text-muted)',
                                border: `2px solid ${
                                  isCurrent
                                    ? 'var(--moment-accent-amber)'
                                    : isCompleted
                                    ? '#16a34a'
                                    : 'var(--moment-border)'
                                }`,
                                transition: 'all 0.3s',
                              }}
                            >
                              <StageIcon size={16} />
                            </div>

                            {/* Stage Label */}
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: isCurrent ? 700 : isCompleted ? 600 : 500,
                                color: isCurrent
                                  ? 'var(--moment-accent-amber)'
                                  : isCompleted
                                  ? 'var(--moment-text-main)'
                                  : 'var(--moment-text-muted)',
                              }}
                            >
                              {t(stage.labelKey)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
