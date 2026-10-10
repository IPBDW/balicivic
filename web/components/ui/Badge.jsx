// Badge — untuk status laporan, severity, kategori, dll
// Variants:
//   - status-pending, status-in_progress, status-done, status-error
//   - severity-low, severity-medium, severity-high
//   - neutral, brand

import { statusLabel, severityLabel } from '@/lib/design-system';

const variants = {
  // Status pipeline
  'status-pending':     'bg-[var(--status-pending-bg)] text-[var(--status-pending)]',
  'status-in_progress': 'bg-[var(--status-in-progress-bg)] text-[var(--status-in-progress)]',
  'status-done':        'bg-[var(--status-done-bg)] text-[var(--status-done)]',
  'status-error':       'bg-[var(--status-error-bg)] text-[var(--status-error)]',
  // Severity
  'severity-low':       'bg-[var(--sev-low-bg)] text-[var(--sev-low)]',
  'severity-medium':    'bg-[var(--sev-medium-bg)] text-[var(--sev-medium)]',
  'severity-high':      'bg-[var(--sev-high-bg)] text-[var(--sev-high)]',
  // Generic
  'neutral':            'ds-surface-muted ds-text-muted',
  'brand':              'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]',
  'outline':            'bg-transparent border-2 ds-border-color ds-text',
};

const sizes = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
};

export function Badge({
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
  children,
}) {
  const cls = [
    'inline-flex items-center font-medium rounded-full whitespace-nowrap',
    variants[variant] || variants.neutral,
    sizes[size] || sizes.md,
    className,
  ].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {icon}
      {children}
    </span>
  );
}

// Specialized: StatusBadge auto-picks variant + label dari status string
export function StatusBadge({ status, size = 'md' }) {
  const key = `status-${(status || 'pending').toLowerCase()}`;
  return (
    <Badge variant={key} size={size} icon={<StatusDot status={status} />}>
      {statusLabel[status] || status}
    </Badge>
  );
}

export function SeverityBadge({ severity, size = 'md' }) {
  const key = `severity-${(severity || 'low').toLowerCase()}`;
  return (
    <Badge variant={key} size={size}>
      {severityLabel[severity] || severity}
    </Badge>
  );
}

function StatusDot({ status }) {
  const colors = {
    PENDING:     'var(--status-pending)',
    IN_PROGRESS: 'var(--status-in-progress)',
    DONE:        'var(--status-done)',
    ERROR:       'var(--status-error)',
  };
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: colors[status] || colors.PENDING }}
      aria-hidden
    />
  );
}