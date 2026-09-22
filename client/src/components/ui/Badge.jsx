const STATUS_MAP = {
  // Routine in-progress — ink-2 badge
  needed:           { label: 'Needed',            cls: 'badge-progress' },
  sent_to_china:    { label: 'Sent to China',      cls: 'badge-progress' },
  printed:          { label: 'Printed',            cls: 'badge-progress' },
  arrived_at_office:{ label: 'Arrived at Office',  cls: 'badge-progress' },
  packaged:         { label: 'Packaged',           cls: 'badge-progress' },
  sent_to_client:   { label: 'Sent to Client',     cls: 'badge-progress' },

  // Needs attention — attention ochre
  pending_admin_review: { label: 'Pending Review', cls: 'badge-attention' },
  shipped:              { label: 'Shipped',         cls: 'badge-attention' },

  // Problem — stamp red
  needs_correction: { label: 'Needs Correction',   cls: 'badge-problem' },

  // Terminal success — ok green (filled)
  delivered: { label: 'Delivered', cls: 'badge-ok filled' },

  // Order-level statuses
  pending:             { label: 'Pending',             cls: 'badge-attention' },
  confirmed:           { label: 'Confirmed',           cls: 'badge-progress' },
  in_progress:         { label: 'In Progress',         cls: 'badge-progress' },
  ready_for_dispatch:  { label: 'Ready for Dispatch',  cls: 'badge-attention' },
  cancelled:           { label: 'Cancelled',           cls: 'badge-problem' },
};

const PROVENANCE_MAP = {
  local: { label: 'Local',  cls: 'badge-ok' },
  china: { label: 'China',  cls: 'badge-china' },
};

/**
 * <Badge status="needed" />
 * <Badge status="local" isProvenance />
 * <Badge label="Custom" className="badge-progress" />
 */
export default function Badge({ status, isProvenance, label, className }) {
  if (label && className) {
    return <span className={`badge ${className}`}>{label}</span>;
  }

  const map = isProvenance ? PROVENANCE_MAP : STATUS_MAP;
  const entry = map[status];

  if (!entry) {
    return <span className="badge badge-progress">{status ?? '—'}</span>;
  }

  return <span className={`badge ${entry.cls}`}>{entry.label}</span>;
}
