/**
 * Canonical Design System Tokens (UIUX-VA-F1)
 *
 * Single Source of Truth (SSOT) for global typography, system font stack,
 * and Ant Design ConfigProvider token alignment.
 */

export const CANONICAL_FONT_FAMILY = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
].join(', ');

export const CANONICAL_TYPOGRAPHY = {
  pageTitle: {
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: '32px',
    color: '#0f172a',
  },
  pageSubtitle: {
    fontSize: '13px',
    fontWeight: 400,
    lineHeight: '20px',
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '24px',
    color: '#0f172a',
  },
  kpiLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#64748b',
  },
  kpiValue: {
    fontSize: '22px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  kpiSupportingText: {
    fontSize: '12px',
    fontWeight: 400,
    color: '#64748b',
  },
};

export const CANONICAL_SEMANTIC_COLORS = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#fa8c16',
  danger: '#f5222d',
  neutral: '#64748b',
  neutralDark: '#0f172a',
};
