// Design System Tokens
// Sumber kebenaran satu untuk warna, typography, spacing, radius, shadow.
// Pakai Tailwind via CSS variables di globals.css.
//
// Tema:
//   - Default: light (warga mobile-first)
//   - Dark: aktif via class .dark di <html> ATAU prefers-color-scheme

export const tokens = {
  color: {
    // Brand
    brand: {
      50:  '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    },
    // Severity (untuk status laporan & badge)
    severity: {
      low:      '#16a34a', // green-600
      medium:   '#f59e0b', // amber-500
      high:     '#dc2626', // red-600
    },
    // Status pipeline (PENDING → IN_PROGRESS → DONE)
    status: {
      pending:     '#6b7280', // gray-500
      in_progress: '#2563eb', // blue-600
      done:        '#16a34a', // green-600
      error:       '#dc2626', // red-600
    },
    // Neutral (light mode)
    light: {
      bg:          '#fafafa',
      surface:     '#ffffff',
      surfaceMuted:'#f5f5f5',
      border:      '#e5e5e5',
      text:        '#0a0a0a',
      textMuted:   '#525252',
      textSubtle:  '#a3a3a3',
    },
    // Neutral (dark mode)
    dark: {
      bg:          '#0a0a0a',
      surface:     '#171717',
      surfaceMuted:'#1f1f1f',
      border:      '#262626',
      text:        '#fafafa',
      textMuted:   '#a3a3a3',
      textSubtle:  '#737373',
    },
  },
  font: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  },
  radius: {
    sm:  '6px',
    md:  '12px',
    lg:  '20px',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 16px rgba(0,0,0,0.08)',
    lg: '0 12px 32px rgba(0,0,0,0.12)',
  },
  spacing: {
    // Padding/gap scale (pakai Tailwind default: 4, 8, 12, 16, 24, 32, 48, 64)
  },
  breakpoints: {
    sm:  '640px',
    md:  '768px',
    lg:  '1024px',
    xl:  '1280px',
  },
};

// Severity → label Indonesia
export const severityLabel = {
  LOW:    'Ringan',
  MEDIUM: 'Sedang',
  HIGH:   'Berat',
};

// Status → label Indonesia
export const statusLabel = {
  PENDING:     'Menunggu',
  IN_PROGRESS: 'Dikerjakan',
  DONE:        'Selesai',
  ERROR:       'Ditolak',
};

// Status → warna token
export const statusColor = (s) => tokens.color.status[s?.toLowerCase()] || tokens.color.status.pending;

// Severity → warna token
export const severityColor = (s) => tokens.color.severity[s?.toLowerCase()] || tokens.color.severity.low;

// Class → label Indonesia (mirror backend utils.py:CLASS_LABEL_PUBLIC)
export const classLabel = {
  jalan_bolong: 'Jalan Bolong',
  genangan_air: 'Genangan Air',
  sampah_liar:  'Sampah Liar',
  kabel_berantakan: 'Kabel Berantakan',
};

// Generate ID tiket BC-YYYY-XXXX (4 char alphanumeric uppercase)
export function generateTicketId(year = new Date().getFullYear()) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit confusing chars (0/O, 1/I)
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BC-${year}-${id}`;
}