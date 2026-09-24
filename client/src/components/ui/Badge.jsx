import { CheckCircle2, Clock, AlertTriangle, AlertCircle, MapPin, Globe } from 'lucide-react';

const STATUS_MAP = {
  // Routine in-progress — neutral slate
  needed:            { label: 'Needed',            type: 'neutral', icon: Clock },
  sent_to_china:     { label: 'Sent to China',      type: 'neutral', icon: Globe },
  printed:           { label: 'Printed',            type: 'neutral', icon: CheckCircle2 },
  arrived_at_office: { label: 'Arrived at Office',  type: 'neutral', icon: MapPin },
  packaged:          { label: 'Packaged',           type: 'neutral', icon: CheckCircle2 },
  sent_to_client:    { label: 'Sent to Client',     type: 'neutral', icon: Globe },

  // Needs attention — subtle amber
  pending_admin_review: { label: 'Pending Review',  type: 'amber',   icon: AlertTriangle },
  shipped:              { label: 'Shipped',         type: 'amber',   icon: Clock },

  // Problem — subtle red
  needs_correction:     { label: 'Needs Correction',type: 'danger',  icon: AlertCircle },

  // Terminal success — subtle green
  delivered:            { label: 'Delivered',       type: 'success', icon: CheckCircle2 },

  // Order-level statuses
  pending:              { label: 'Pending',         type: 'amber',   icon: Clock },
  confirmed:            { label: 'Confirmed',       type: 'neutral', icon: CheckCircle2 },
  in_progress:          { label: 'In Progress',     type: 'neutral', icon: Clock },
  ready_for_dispatch:   { label: 'Ready Dispatch',  type: 'amber',   icon: Clock },
  packaged:             { label: 'Packaged',        type: 'blue',    icon: Clock },
  sent_to_client:       { label: 'In Transit',      type: 'blue',    icon: Clock },
  completed:            { label: 'Completed',       type: 'success', icon: CheckCircle2 },
  rejected:             { label: 'Rejected',        type: 'danger',  icon: AlertCircle },
};

const PROVENANCE_MAP = {
  local: { label: 'Local (Algeria)', type: 'success', icon: MapPin },
  china: { label: 'China',          type: 'blue',    icon: Globe },
};

const TYPE_STYLES = {
  neutral: {
    bg: '#f8fafc',
    text: '#475569',
    border: '#e2e8f0',
  },
  success: {
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#bbf7d0',
  },
  blue: {
    bg: '#eff6ff',
    text: '#1d4ed8',
    border: '#bfdbfe',
  },
  amber: {
    bg: '#fffbeb',
    text: '#b45309',
    border: '#fde68a',
  },
  danger: {
    bg: '#fef2f2',
    text: '#b91c1c',
    border: '#fecaca',
  },
};

export default function Badge({ status, isProvenance, label, type = 'neutral' }) {
  if (label) {
    const s = TYPE_STYLES[type] || TYPE_STYLES.neutral;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 9999,
          fontSize: 11.5,
          fontWeight: 500,
          background: s.bg,
          color: s.text,
          border: `1px solid ${s.border}`,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    );
  }

  const map = isProvenance ? PROVENANCE_MAP : STATUS_MAP;
  const entry = map[status] || { label: status ?? '—', type: 'neutral', icon: null };
  const s = TYPE_STYLES[entry.type] || TYPE_STYLES.neutral;
  const Icon = entry.icon;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize: 11.5,
        fontWeight: 500,
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {Icon && <Icon size={12} strokeWidth={2.2} />}
      <span>{entry.label}</span>
    </span>
  );
}
