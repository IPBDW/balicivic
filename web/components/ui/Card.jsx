// Card — surface dengan padding & border konsisten
// Variants: 'default' | 'muted' | 'outline'
// Padding:  'none' | 'sm' | 'md' | 'lg'

const variants = {
  default: 'ds-surface ds-border-color border',
  muted:   'ds-surface-muted',
  outline: 'bg-transparent ds-border-color border-2',
};

const paddings = {
  none: '',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
};

const shadows = {
  none: '',
  sm:   'ds-shadow-sm',
  md:   'ds-shadow-md',
  lg:   'ds-shadow-lg',
};

export function Card({
  variant = 'default',
  padding = 'md',
  shadow = 'sm',
  hoverable = false,
  className = '',
  children,
  ...rest
}) {
  const cls = [
    'rounded-[var(--radius-md)] transition-shadow',
    variants[variant] || variants.default,
    paddings[padding] || paddings.md,
    shadows[shadow] || shadows.sm,
    hoverable ? 'hover:ds-shadow-md cursor-pointer' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children }) {
  return <div className={`mb-3 ${className}`}>{children}</div>;
}

export function CardTitle({ className = '', children }) {
  return <h3 className={`text-base font-semibold ds-text ${className}`}>{children}</h3>;
}

export function CardDescription({ className = '', children }) {
  return <p className={`text-sm ds-text-muted ${className}`}>{children}</p>;
}