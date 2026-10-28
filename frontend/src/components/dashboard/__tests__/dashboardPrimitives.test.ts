/**
 * EPMS — DASHBOARD VISUAL PRIMITIVES & TOKENS TEST SUITE
 * Phase 5A: Dashboard Shell & Visual System Foundation
 */

import { DASHBOARD_TOKENS } from '../theme';
import { STATE_TEXT_MAP, NullSemanticState } from '../NullStateDisplay';

describe('EPMS Dashboard Visual System & Primitives (Phase 5A)', () => {
  describe('Phase 4A Color Palette & Design Tokens', () => {
    it('should define authoritative Phase 4A brand colors', () => {
      expect(DASHBOARD_TOKENS.colors.primaryNavy).toBe('#0F2D6B');
      expect(DASHBOARD_TOKENS.colors.primaryBlue).toBe('#2563EB');
      expect(DASHBOARD_TOKENS.colors.textSecondary).toBe('#475569');
      expect(DASHBOARD_TOKENS.colors.background).toBe('#F8FAFC');
      expect(DASHBOARD_TOKENS.colors.surface).toBe('#FFFFFF');
    });

    it('should define authoritative semantic feedback colors', () => {
      expect(DASHBOARD_TOKENS.colors.success).toBe('#10B981');
      expect(DASHBOARD_TOKENS.colors.warning).toBe('#F59E0B');
      expect(DASHBOARD_TOKENS.colors.danger).toBe('#EF4444');
      expect(DASHBOARD_TOKENS.colors.purple).toBe('#8B5CF6');
    });

    it('should define standardized spacing scale and radii', () => {
      expect(DASHBOARD_TOKENS.spacing.xs).toBe('4px');
      expect(DASHBOARD_TOKENS.spacing.sm).toBe('8px');
      expect(DASHBOARD_TOKENS.spacing.lg).toBe('16px');
      expect(DASHBOARD_TOKENS.spacing['2xl']).toBe('24px');
      expect(DASHBOARD_TOKENS.radii.xl).toBe('14px');
    });

    it('should define restrained shadow tokens without heavy drop shadows', () => {
      expect(DASHBOARD_TOKENS.shadows.card).toContain('rgba(15, 23, 42');
      expect(DASHBOARD_TOKENS.shadows.card).not.toContain('blur(20px)');
    });
  });

  describe('Null / Zero Presentation Semantic Contract', () => {
    const cases: Array<{ reason: NullSemanticState; expected: string }> = [
      { reason: 'REAL_ZERO', expected: '0' },
      { reason: 'NO_DATA', expected: 'N/A' },
      { reason: 'NOT_CALCULABLE', expected: 'Belum dapat dihitung' },
      { reason: 'NOT_IMPLEMENTED', expected: 'Belum tersedia' },
      { reason: 'INSUFFICIENT_HISTORY', expected: 'Data historis belum cukup' },
    ];

    cases.forEach(({ reason, expected }) => {
      it(`should map reason '${reason}' to exact locked label '${expected}'`, () => {
        expect(STATE_TEXT_MAP[reason]).toBe(expected);
      });
    });

    it('should never silently treat NO_DATA as REAL_ZERO', () => {
      expect(STATE_TEXT_MAP.NO_DATA).not.toBe(STATE_TEXT_MAP.REAL_ZERO);
      expect(STATE_TEXT_MAP.NO_DATA).toBe('N/A');
    });
  });
});
