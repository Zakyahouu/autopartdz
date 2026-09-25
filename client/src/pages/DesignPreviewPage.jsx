import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import {
  LayoutGrid,
  SplitSquareVertical,
  Table as TableIcon,
  Columns,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Check,
  ExternalLink,
  ShieldCheck,
  User,
  Car,
  FileText,
  Package,
  RotateCcw,
  Clock,
  Printer,
  Download,
  AlertCircle,
  Eye,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';

export default function DesignPreviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Concept selection: 'split' | 'table' | 'dashboard'
  const [selectedConcept, setSelectedConcept] = useState(() => {
    return searchParams.get('concept') || localStorage.getItem('autopartdz_order_detail_concept') || 'split';
  });

  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [activeOrder, setActiveOrder] = useState(null);
  const [associates, setAssociates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Fallback demo order if database has no orders
  const fallbackOrder = {
    _id: 'demo-sample-01',
    trackingCode: 'DEMO-88K',
    clientName: 'Krimo Mansouri',
    phone: '+213 555 44 33 22',
    passportNumber: '21B789401',
    deliveryAddress: '14 Boulevard Zighout Youcef, Alger',
    wilaya: 'Alger',
    carBrand: 'Geely',
    carModel: 'Coolray 2024 Flagship',
    vin: 'LB374829104829109',
    status: 'in_progress',
    orderType: 'demand',
    createdAt: new Date().toISOString(),
    lines: [
      {
        _id: 'line-1',
        status: 'needed',
        delegationMode: 'none',
        assignedAssociateId: null,
        documentTypeId: { fullName: 'Commercial Invoice (CN)', shortName: 'Invoice', code: 'DOC-INV', category: 'Commercial' },
        files: [],
        notes: [{ content: 'Ensure the export stamp is clearly legible' }],
      },
      {
        _id: 'line-2',
        status: 'attached',
        delegationMode: 'none',
        assignedAssociateId: null,
        documentTypeId: { fullName: 'Bill of Lading / Sea Waybill', shortName: 'B/L', code: 'DOC-BL', category: 'Logistics' },
        files: [{ _id: 'f1', filename: 'bill_of_lading_maersk_88k.pdf', size: 245000 }],
        notes: [],
      },
      {
        _id: 'line-3',
        status: 'ready',
        delegationMode: 'open',
        assignedAssociateId: { _id: 'u-1', name: 'Li Wei' },
        acknowledgedAt: new Date().toISOString(),
        documentTypeId: { fullName: 'Certificate of Origin (Form E)', shortName: 'Origin Cert', code: 'DOC-CO', category: 'Compliance' },
        files: [{ _id: 'f2', filename: 'certificate_origin_customs.pdf', size: 184000 }],
        notes: [{ content: 'Form E certified by Ningbo Chamber' }],
      },
      {
        _id: 'line-4',
        status: 'needed',
        delegationMode: 'open',
        assignedAssociateId: null,
        documentTypeId: { fullName: 'Vehicle Packing List & VIN Spec', shortName: 'Packing List', code: 'DOC-PL', category: 'Logistics' },
        files: [],
        notes: [],
      },
      {
        _id: 'line-5',
        status: 'needed',
        delegationMode: 'none',
        assignedAssociateId: null,
        documentTypeId: { fullName: 'Export Customs Declaration Sheet', shortName: 'Customs Dec', code: 'DOC-CUST', category: 'Compliance' },
        files: [],
        notes: [],
      },
    ],
  };

  // Fetch real orders and associates
  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, assocRes] = await Promise.all([
        apiFetch('/orders'),
        apiFetch('/associates'),
      ]);

      let ordersList = [];
      if (ordersRes.ok && Array.isArray(ordersRes.data)) {
        ordersList = ordersRes.data;
        setOrders(ordersList);
      }

      if (assocRes.ok && Array.isArray(assocRes.data)) {
        setAssociates(assocRes.data);
      }

      if (ordersList.length > 0) {
        const initialOrder = ordersList[0];
        setSelectedOrderId(initialOrder._id);
        // Fetch detailed order
        const detailRes = await apiFetch(`/orders/${initialOrder._id}`);
        if (detailRes.ok && detailRes.data) {
          setActiveOrder(detailRes.data);
        } else {
          setActiveOrder(initialOrder);
        }
      } else {
        setActiveOrder(fallbackOrder);
      }
    } catch (err) {
      console.error('Failed to load design preview data:', err);
      setActiveOrder(fallbackOrder);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOrderChange = async (orderId) => {
    setSelectedOrderId(orderId);
    if (orderId === 'demo') {
      setActiveOrder(fallbackOrder);
      return;
    }
    try {
      const res = await apiFetch(`/orders/${orderId}`);
      if (res.ok && res.data) {
        setActiveOrder(res.data);
      }
    } catch (err) {
      console.error('Failed to switch order:', err);
    }
  };

  const handleSelectConcept = (concept) => {
    setSelectedConcept(concept);
    setSearchParams({ concept });
    localStorage.setItem('autopartdz_order_detail_concept', concept);
  };

  const handleApplyAsDefault = () => {
    localStorage.setItem('autopartdz_order_detail_concept', selectedConcept);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const CONCEPTS = [
    {
      id: 'split',
      icon: SplitSquareVertical,
      name: '1. Clean Modern Split',
      subtitle: 'Local vs China Dual-Station',
      tag: 'Recommended for Structured Operations',
      tagColor: '#0284c7',
      tagBg: '#e0f2fe',
      pros: [
        'Separates local Algeria paperwork from overseas China delegation',
        'Large, touch-friendly document cards with clear action buttons',
        'Intuitive for operators switching between local filing and supplier checks',
      ],
    },
    {
      id: 'table',
      icon: TableIcon,
      name: '2. Executive Data Table',
      subtitle: 'High-Density Spreadsheet View',
      tag: 'Recommended for Fast Batch Operations',
      tagColor: '#059669',
      tagBg: '#d1fae5',
      pros: [
        'Highest information density: 15+ documents visible without scrolling',
        'Inline delegation dropdowns and instant one-click file access',
        'Eliminates visual clutter and vertical page jumping',
      ],
    },
    {
      id: 'dashboard',
      icon: Columns,
      name: '3. Two-Column Dashboard',
      subtitle: 'Sticky Dossier & Document Center',
      tag: 'Recommended for Customer Service & Case Review',
      tagColor: '#7c3aed',
      tagBg: '#ede9fe',
      pros: [
        'Client name, passport, delivery address, and VIN always visible on left',
        'Clean single-column document stream on right with minimal distraction',
        'Perfect for verifying car VIN and client identity while uploading files',
      ],
    },
  ];

  const currentConceptInfo = CONCEPTS.find((c) => c.id === selectedConcept) || CONCEPTS[0];

  const orderToDisplay = activeOrder || fallbackOrder;
  const lines = orderToDisplay.lines || [];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* ── Top Hero Header ────────────────────────────────────────────── */}
      <div
        style={{
          borderRadius: 16,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          padding: '24px 28px',
          marginBottom: 24,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 20, backgroundColor: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', marginBottom: 8 }}>
              <Sparkles size={14} color="#38bdf8" />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.04em' }}>
                DESIGN EXPLORATION LAB
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              Order Detail Layout Selector
            </h1>
            <p style={{ fontSize: 13.5, color: '#94a3b8', marginTop: 4, maxWidth: 680, lineHeight: 1.5 }}>
              Choose the layout that best fits your workflow. Click between the 3 concepts below to test how orders look and operate in real-time. Once satisfied, click <strong>"Apply as My Default Layout"</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {activeOrder && activeOrder._id !== 'demo-sample-01' && (
              <Link
                to={`/admin/orders/${activeOrder._id}?concept=${selectedConcept}`}
                className="btn-admin-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: '#ffffff',
                }}
              >
                <span>Open in Live Order</span>
                <ExternalLink size={14} />
              </Link>
            )}

            <button
              type="button"
              onClick={handleApplyAsDefault}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 18px',
                borderRadius: 8,
                backgroundColor: savedSuccess ? '#10b981' : '#38bdf8',
                color: savedSuccess ? '#ffffff' : '#0f172a',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              {savedSuccess ? <Check size={16} /> : <CheckCircle2 size={16} />}
              <span>{savedSuccess ? 'Saved as Default!' : 'Apply as My Default Layout'}</span>
            </button>
          </div>
        </div>

        {/* ── Order Picker Bar ────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12.5, color: '#94a3b8', fontWeight: 600 }}>
              Testing with order:
            </span>
            <select
              value={selectedOrderId || (activeOrder?._id || '')}
              onChange={(e) => handleOrderChange(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid rgba(255,255,255,0.2)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {orders.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.trackingCode} — {o.clientName || 'Client'} ({o.carBrand} {o.carModel || ''})
                </option>
              ))}
              <option value="demo">Sample Test Order (5 Documents Demo)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
            <span>Active Default in Browser:</span>
            <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700 }}>
              {currentConceptInfo.name}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3 Big Concept Selection Cards ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 24 }}>
        {CONCEPTS.map((c) => {
          const isSelected = selectedConcept === c.id;
          const IconComponent = c.icon;
          return (
            <div
              key={c.id}
              onClick={() => handleSelectConcept(c.id)}
              style={{
                padding: '16px 18px',
                borderRadius: 12,
                cursor: 'pointer',
                backgroundColor: isSelected ? 'var(--admin-surface, #ffffff)' : 'var(--admin-surface-2, #f8fafc)',
                border: isSelected ? '2px solid #0284c7' : '1px solid var(--admin-border, #e2e8f0)',
                boxShadow: isSelected ? '0 4px 16px rgba(2, 132, 199, 0.12)' : 'none',
                position: 'relative',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: isSelected ? '#0284c7' : 'var(--admin-surface-hover, #e2e8f0)',
                      color: isSelected ? '#ffffff' : 'var(--admin-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconComponent size={16} strokeWidth={2.2} />
                  </div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>
                    {c.name}
                  </h3>
                </div>

                {isSelected && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                      backgroundColor: '#e0f2fe',
                      color: '#0284c7',
                    }}
                  >
                    <Check size={12} strokeWidth={3} />
                    <span>Viewing</span>
                  </span>
                )}
              </div>

              <div style={{ fontSize: 12, color: 'var(--admin-text-secondary)', marginBottom: 10 }}>
                {c.subtitle}
              </div>

              <span
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  backgroundColor: c.tagBg,
                  color: c.tagColor,
                  marginBottom: 10,
                }}
              >
                {c.tag}
              </span>

              <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, color: 'var(--admin-text-secondary)', lineHeight: 1.45 }}>
                {c.pros.map((p, idx) => (
                  <li key={idx} style={{ marginBottom: 3 }}>{p}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ── Active Concept Preview Frame ───────────────────────────────── */}
      <div
        style={{
          border: '1px solid var(--admin-border, #e2e8f0)',
          borderRadius: 14,
          backgroundColor: 'var(--admin-surface, #ffffff)',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
          marginBottom: 32,
        }}
      >
        {/* Frame Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            backgroundColor: 'var(--admin-surface-2, #f8fafc)',
            borderBottom: '1px solid var(--admin-border, #e2e8f0)',
            fontSize: 12.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={14} color="#0284c7" />
            <span style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>
              Live Interactive Preview:
            </span>
            <span style={{ color: 'var(--admin-text-secondary)' }}>
              {currentConceptInfo.name} ({currentConceptInfo.subtitle})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeOrder && activeOrder._id !== 'demo-sample-01' && (
              <Link
                to={`/admin/orders/${activeOrder._id}?concept=${selectedConcept}`}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#0284c7',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>Open in Full Screen Order Detail</span>
                <ExternalLink size={12} />
              </Link>
            )}
          </div>
        </div>

        {/* Live Content Body */}
        <div style={{ padding: 20 }}>
          {selectedConcept === 'split' && (
            <RenderCleanSplitConcept order={orderToDisplay} associates={associates} />
          )}

          {selectedConcept === 'table' && (
            <RenderExecutiveTableConcept order={orderToDisplay} associates={associates} />
          )}

          {selectedConcept === 'dashboard' && (
            <RenderDashboardConcept order={orderToDisplay} associates={associates} />
          )}
        </div>
      </div>

      {/* ── Side-by-Side Comparison Matrix ────────────────────────────── */}
      <div
        style={{
          borderRadius: 14,
          backgroundColor: 'var(--admin-surface, #ffffff)',
          border: '1px solid var(--admin-border, #e2e8f0)',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-text-primary)', marginBottom: 6 }}>
          Side-by-Side Comparison & Recommendation Guide
        </h3>
        <p style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginBottom: 16 }}>
          Use this table to understand the structural strengths of each layout:
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--admin-surface-2, #f8fafc)', borderBottom: '2px solid var(--admin-border)' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Feature / Metric</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: '#0284c7', fontWeight: 700 }}>1. Clean Modern Split</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: '#059669', fontWeight: 700 }}>2. Executive Data Table</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: '#7c3aed', fontWeight: 700 }}>3. Two-Column Dashboard</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--admin-text-primary)' }}>Visual Density</td>
                <td style={{ padding: '10px 14px', color: 'var(--admin-text-secondary)' }}>Moderate (Spacious cards)</td>
                <td style={{ padding: '10px 14px', color: '#059669', fontWeight: 600 }}>Ultra High (15+ docs on screen)</td>
                <td style={{ padding: '10px 14px', color: 'var(--admin-text-secondary)' }}>High (Dual-pane layout)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--admin-text-primary)' }}>China vs Local Separation</td>
                <td style={{ padding: '10px 14px', color: '#0284c7', fontWeight: 600 }}>Explicit 2-Station Split</td>
                <td style={{ padding: '10px 14px', color: 'var(--admin-text-secondary)' }}>Delegation column & filter tabs</td>
                <td style={{ padding: '10px 14px', color: 'var(--admin-text-secondary)' }}>Station badges on cards</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--admin-text-primary)' }}>Client / VIN Visibility</td>
                <td style={{ padding: '10px 14px', color: 'var(--admin-text-secondary)' }}>Top Summary Cards</td>
                <td style={{ padding: '10px 14px', color: 'var(--admin-text-secondary)' }}>Compact Header Ribbon</td>
                <td style={{ padding: '10px 14px', color: '#7c3aed', fontWeight: 600 }}>Always-visible Left Sticky Panel</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--admin-text-primary)' }}>Speed for Document Heavy Orders</td>
                <td style={{ padding: '10px 14px', color: 'var(--admin-text-secondary)' }}>Good</td>
                <td style={{ padding: '10px 14px', color: '#059669', fontWeight: 600 }}>Fastest (Single click per row)</td>
                <td style={{ padding: '10px 14px', color: 'var(--admin-text-secondary)' }}>Very Good</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--admin-text-primary)' }}>Best Suited For</td>
                <td style={{ padding: '10px 14px', color: '#0284c7' }}>Dedicated local and overseas clerks</td>
                <td style={{ padding: '10px 14px', color: '#059669' }}>High-volume managers processing 20+ docs/day</td>
                <td style={{ padding: '10px 14px', color: '#7c3aed' }}>Quality verification & customer support calls</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Concept 1 Render (Clean Modern Split)
// ─────────────────────────────────────────────────────────────────────────────
function RenderCleanSplitConcept({ order, associates }) {
  const lines = order.lines || [];
  const localLines = lines.filter((l) => l.delegationMode === 'none' && !l.assignedAssociateId);
  const chinaLines = lines.filter((l) => l.delegationMode !== 'none' || Boolean(l.assignedAssociateId));

  return (
    <div>
      {/* Client & Car Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ padding: '14px 16px', borderRadius: 8, backgroundColor: 'var(--admin-surface-2, #f8fafc)', border: '1px solid var(--admin-border, #e2e8f0)' }}>
          <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Client Dossier</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--admin-text-primary)', marginTop: 4 }}>{order.clientName}</div>
          <div style={{ fontSize: 12, color: 'var(--admin-text-secondary)', marginTop: 2 }}>{order.phone} • Passport: {order.passportNumber || 'N/A'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--admin-text-muted)', marginTop: 2 }}>{order.deliveryAddress}, {order.wilaya}</div>
        </div>

        <div style={{ padding: '14px 16px', borderRadius: 8, backgroundColor: 'var(--admin-surface-2, #f8fafc)', border: '1px solid var(--admin-border, #e2e8f0)' }}>
          <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Vehicle Specification</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--admin-text-primary)', marginTop: 4 }}>{order.carBrand} {order.carModel}</div>
          <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--admin-accent, #0284c7)', marginTop: 2 }}>VIN: {order.vin || 'N/A'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--admin-text-muted)', marginTop: 2 }}>Tracking: {order.trackingCode}</div>
        </div>
      </div>

      {/* 2-Station Split Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        {/* Station A: Local */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '2px solid #0284c7', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--admin-text-primary)' }}>🇩🇿 Local Station (Algiers)</span>
              <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, backgroundColor: '#e0f2fe', color: '#0284c7', fontWeight: 700 }}>
                {localLines.length}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>Self-Managed</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {localLines.map((line) => (
              <SimpleDocCard key={line._id} line={line} isChina={false} />
            ))}
            {localLines.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--admin-text-muted)', fontSize: 12 }}>
                No local documents.
              </div>
            )}
          </div>
        </div>

        {/* Station B: China */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '2px solid #ea580c', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--admin-text-primary)' }}>🇨🇳 China Delegation Station</span>
              <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, backgroundColor: '#ffedd5', color: '#ea580c', fontWeight: 700 }}>
                {chinaLines.length}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>Overseas Sourcing</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {chinaLines.map((line) => (
              <SimpleDocCard key={line._id} line={line} isChina={true} />
            ))}
            {chinaLines.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--admin-text-muted)', fontSize: 12 }}>
                No documents delegated to China.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Concept 2 Render (Executive Data Table)
// ─────────────────────────────────────────────────────────────────────────────
function RenderExecutiveTableConcept({ order, associates }) {
  const lines = order.lines || [];

  return (
    <div>
      {/* Compact Dossier Ribbon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          borderRadius: 8,
          backgroundColor: 'var(--admin-surface-2, #f8fafc)',
          border: '1px solid var(--admin-border, #e2e8f0)',
          marginBottom: 16,
          fontSize: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span><strong>Client:</strong> {order.clientName} ({order.phone})</span>
          <span><strong>Passport:</strong> {order.passportNumber || 'N/A'}</span>
          <span><strong>Vehicle:</strong> {order.carBrand} {order.carModel}</span>
          <span style={{ fontFamily: 'monospace', color: '#0284c7' }}><strong>VIN:</strong> {order.vin || 'N/A'}</span>
        </div>
        <span style={{ color: 'var(--admin-text-muted)' }}>
          {lines.length} Total Documents
        </span>
      </div>

      {/* Enterprise Data Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border, #e2e8f0)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--admin-surface-2, #f8fafc)', borderBottom: '1px solid var(--admin-border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Document</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Category</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Station / Delegation</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Files Attached</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Quick Action</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const isChina = line.delegationMode !== 'none' || Boolean(line.assignedAssociateId);
              return (
                <tr key={line._id} style={{ borderBottom: '1px solid var(--admin-border, #f1f5f9)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                    {line.documentTypeId?.fullName || 'Document'}
                    {line.documentTypeId?.code && (
                      <span style={{ marginLeft: 6, fontSize: 10.5, fontFamily: 'monospace', color: 'var(--admin-text-muted)' }}>
                        ({line.documentTypeId.code})
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--admin-text-muted)' }}>
                    {line.documentTypeId?.category || 'General'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor:
                          line.status === 'ready' ? '#dcfce7' : line.status === 'attached' ? '#dbeafe' : '#fef3c7',
                        color:
                          line.status === 'ready' ? '#15803d' : line.status === 'attached' ? '#1d4ed8' : '#b45309',
                      }}
                    >
                      {line.status === 'ready' ? 'Locked / Ready' : line.status === 'attached' ? 'Review Ready' : 'Action Needed'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 11,
                        backgroundColor: isChina ? '#ffedd5' : '#e0f2fe',
                        color: isChina ? '#c2410c' : '#0369a1',
                        fontWeight: 600,
                      }}
                    >
                      {isChina ? (line.assignedAssociateId?.name ? `🇨🇳 ${line.assignedAssociateId.name}` : '🇨🇳 Open Pool') : '🇩🇿 Local'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {(line.files || []).length > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#0284c7', fontWeight: 600 }}>
                        <FileText size={12} />
                        <span>{line.files[0].filename}</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--admin-text-muted)' }}>None</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 10px' }}>
                    <button
                      type="button"
                      className="btn-admin-secondary"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      {line.status === 'needed' ? 'Attach File' : 'View'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Concept 3 Render (Two-Column Command Dashboard)
// ─────────────────────────────────────────────────────────────────────────────
function RenderDashboardConcept({ order, associates }) {
  const lines = order.lines || [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
      {/* Left Column: Fixed Dossier Panel */}
      <div
        style={{
          padding: 16,
          borderRadius: 10,
          backgroundColor: 'var(--admin-surface-2, #f8fafc)',
          border: '1px solid var(--admin-border, #e2e8f0)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--admin-border)' }}>
          <User size={16} color="#0284c7" />
          <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--admin-text-primary)' }}>Client Dossier</h4>
        </div>

        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>Full Name</div>
            <div style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>{order.clientName}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>Phone</div>
            <div>{order.phone}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>Passport Number</div>
            <div style={{ fontWeight: 600 }}>{order.passportNumber || 'N/A'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>Delivery Address</div>
            <div>{order.deliveryAddress}, {order.wilaya}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 12, paddingTop: 12, borderBottom: '1px solid var(--admin-border)', borderTop: '1px solid var(--admin-border)' }}>
          <Car size={16} color="#0284c7" />
          <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--admin-text-primary)' }}>Vehicle Dossier</h4>
        </div>

        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>Car Model</div>
            <div style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>{order.carBrand} {order.carModel}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>VIN</div>
            <div style={{ fontFamily: 'monospace', color: '#0284c7', fontWeight: 600 }}>{order.vin || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Right Column: Document Action Stream */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--admin-text-primary)' }}>
            Order Documents ({lines.length})
          </h4>
          <span style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
            Click any document to update
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines.map((line) => (
            <SimpleDocCard key={line._id} line={line} isChina={line.delegationMode !== 'none' || Boolean(line.assignedAssociateId)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Simple Doc Card
// ─────────────────────────────────────────────────────────────────────────────
function SimpleDocCard({ line, isChina }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 8,
        backgroundColor: 'var(--admin-surface, #ffffff)',
        border: '1px solid var(--admin-border, #e2e8f0)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-primary)' }}>
            {line.documentTypeId?.fullName || 'Document'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 2 }}>
            {line.documentTypeId?.category} • {isChina ? '🇨🇳 China Station' : '🇩🇿 Local Station'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
              backgroundColor:
                line.status === 'ready' ? '#dcfce7' : line.status === 'attached' ? '#dbeafe' : '#fef3c7',
              color:
                line.status === 'ready' ? '#15803d' : line.status === 'attached' ? '#1d4ed8' : '#b45309',
            }}
          >
            {line.status === 'ready' ? 'Ready' : line.status === 'attached' ? 'Review' : 'Needed'}
          </span>
        </div>
      </div>

      {(line.files || []).length > 0 && (
        <div style={{ marginTop: 8, padding: '4px 8px', borderRadius: 4, backgroundColor: 'var(--admin-surface-2, #f8fafc)', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6, color: '#0284c7' }}>
          <FileText size={12} />
          <span>{line.files[0].filename}</span>
        </div>
      )}
    </div>
  );
}
