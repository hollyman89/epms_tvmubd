/**
 * EPMS Executive Dashboard — Design Tokens (Phase 4A Benchmark)
 * Clean, Confident, Executive Enterprise Design System
 */

export const DASHBOARD_TOKENS = {
  colors: {
    // Primary Brand
    primaryNavy: '#0F2D6B',
    primaryNavyHover: '#0B2252',
    primaryBlue: '#2563EB',
    primaryBlueHover: '#1D4ED8',
    primaryBlueSubtle: '#EFF6FF',
    accentBlue: '#38BDF8',

    // Neutrals & Surfaces
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    surfaceSubtle: '#F1F5F9',

    // Borders
    border: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    borderStrong: '#CBD5E1',
    borderFocus: '#2563EB',

    // Typography
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
    textLight: '#94A3B8',

    // Semantic Accents
    success: '#10B981',
    successHover: '#059669',
    successSubtle: '#ECFDF5',
    successBorder: '#A7F3D0',

    warning: '#F59E0B',
    warningSubtle: '#FFFBEB',
    warningBorder: '#FDE68A',

    danger: '#EF4444',
    dangerSubtle: '#FEF2F2',
    dangerBorder: '#FECACA',

    purple: '#8B5CF6',
    purpleSubtle: '#F5F3FF',
    purpleBorder: '#DDD6FE',

    info: '#0284C7',
    infoSubtle: '#F0F9FF',
    infoBorder: '#BAE6FD',
  },

  typography: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h1: {
      fontSize: '28px',
      lineHeight: '36px',
      fontWeight: 700,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: '22px',
      lineHeight: '30px',
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontSize: '16.5px',
      lineHeight: '24px',
      fontWeight: 600,
      letterSpacing: '-0.015em',
    },
    body: {
      fontSize: '14px',
      lineHeight: '20px',
      fontWeight: 400,
    },
    bodyMedium: {
      fontSize: '14px',
      lineHeight: '20px',
      fontWeight: 500,
    },
    caption: {
      fontSize: '12px',
      lineHeight: '16px',
      fontWeight: 500,
    },
    kpiValue: {
      fontSize: '26px',
      lineHeight: '32px',
      fontWeight: 700,
      letterSpacing: '-0.025em',
    },
  },

  radii: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '10px',
    xl: '14px',
    full: '9999px',
  },

  shadows: {
    none: 'none',
    subtle: '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)',
    card: '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)',
    cardHover: '0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -1px rgba(15, 23, 42, 0.03)',
    dropdown: '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03)',
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '48px',
  },
} as const;

export type DashboardTokens = typeof DASHBOARD_TOKENS;
