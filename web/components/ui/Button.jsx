// Button — primary, secondary, ghost, danger
// Variants: 'default' | 'secondary' | 'ghost' | 'danger' | 'outline'
// Sizes:    'sm' | 'md' | 'lg' (lg = warga-friendly, md = admin default)

import { forwardRef } from 'react';

const variants = {
  primary: {
    base: 'bg-[var(--brand-primary)] text-white hover:opacity-90 active:opacity-80',
    style: {},
  },
  secondary: {
    base: 'ds-surface text-[var(--ds-text)] border ds-border-color hover:bg-[var(--ds-surface-muted)]',
    style: {},
  },
  ghost: {
    base: 'bg-transparent text-[var(--ds-text)] hover:bg-[var(--ds-surface-muted)]',
    style: {},
  },
  danger: {
    base: 'bg-[var(--status-error)] text-white hover:opacity-90',
    style: {},
  },
  outline: {
    base: 'bg-transparent border-2 border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]',
    style: {},
  },
};

const sizes = {
  sm: 'h-9 px-3 text-sm rounded-[var(--radius-sm)]',
  md: 'h-11 px-5 text-sm rounded-[var(--radius-sm)]',
  lg: 'h-14 px-7 text-base rounded-[var(--radius-md)] font-medium',
};

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    className = '',
    children,
    ...rest
  },
  ref
) {
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;
  const cls = [
    'inline-flex items-center justify-center gap-2 transition-all duration-150 select-none',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary)]',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    v.base,
    s,
    fullWidth ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={v.style}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : leftIcon}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  );
});