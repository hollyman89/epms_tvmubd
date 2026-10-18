/**
 * EPMS — PROCUREMENT-EMPTY-COUNT-R1
 * Focused Unit Tests for PR / PO Summary Count Empty & Non-Zero Presentation
 */

import {
  resolveProcurementCount,
  formatProcurementSummaryCount,
} from '../../ProcurementPage';

describe('EPMS — PROCUREMENT-EMPTY-COUNT-R1 Unit Tests', () => {
  describe('CASE 1 - 4: Purchase Request (PR) Count Presentation', () => {
    it('CASE 1: should format PR count = 0 as "0 PR"', () => {
      expect(resolveProcurementCount(0)).toBe(0);
      expect(formatProcurementSummaryCount(0, 'PR')).toBe('0 PR');
      expect(formatProcurementSummaryCount([], 'PR')).toBe('0 PR');
    });

    it('CASE 2: should format PR count = undefined as "0 PR"', () => {
      expect(resolveProcurementCount(undefined)).toBe(0);
      expect(formatProcurementSummaryCount(undefined, 'PR')).toBe('0 PR');
    });

    it('CASE 3: should format PR count = null as "0 PR"', () => {
      expect(resolveProcurementCount(null)).toBe(0);
      expect(formatProcurementSummaryCount(null, 'PR')).toBe('0 PR');
    });

    it('CASE 4: should format PR count = 5 as "5 PR"', () => {
      expect(resolveProcurementCount(5)).toBe(5);
      expect(formatProcurementSummaryCount(5, 'PR')).toBe('5 PR');
      expect(formatProcurementSummaryCount([{}, {}, {}, {}, {}], 'PR')).toBe('5 PR');
    });
  });

  describe('CASE 5 - 8: Purchase Order (PO) Count Presentation', () => {
    it('CASE 5: should format PO count = 0 as "0 PO"', () => {
      expect(resolveProcurementCount(0)).toBe(0);
      expect(formatProcurementSummaryCount(0, 'PO')).toBe('0 PO');
      expect(formatProcurementSummaryCount([], 'PO')).toBe('0 PO');
    });

    it('CASE 6: should format PO count = undefined as "0 PO"', () => {
      expect(resolveProcurementCount(undefined)).toBe(0);
      expect(formatProcurementSummaryCount(undefined, 'PO')).toBe('0 PO');
    });

    it('CASE 7: should format PO count = null as "0 PO"', () => {
      expect(resolveProcurementCount(null)).toBe(0);
      expect(formatProcurementSummaryCount(null, 'PO')).toBe('0 PO');
    });

    it('CASE 8: should format PO count = 3 as "3 PO"', () => {
      expect(resolveProcurementCount(3)).toBe(3);
      expect(formatProcurementSummaryCount(3, 'PO')).toBe('3 PO');
      expect(formatProcurementSummaryCount([{}, {}, {}], 'PO')).toBe('3 PO');
    });
  });

  describe('CASE 9: Edge cases & Unrelated Metric Protection', () => {
    it('should never return "—", "-", or "N/A" for count metrics', () => {
      const candidates = [0, undefined, null, NaN, -1, []];
      for (const val of candidates) {
        const prFormatted = formatProcurementSummaryCount(val as any, 'PR');
        const poFormatted = formatProcurementSummaryCount(val as any, 'PO');
        expect(prFormatted).not.toContain('—');
        expect(prFormatted).not.toContain('N/A');
        expect(poFormatted).not.toContain('—');
        expect(poFormatted).not.toContain('N/A');
        expect(prFormatted).toBe('0 PR');
        expect(poFormatted).toBe('0 PO');
      }
    });

    it('should correctly clamp negative counts to 0', () => {
      expect(resolveProcurementCount(-5)).toBe(0);
      expect(formatProcurementSummaryCount(-5, 'PR')).toBe('0 PR');
    });

    it('should preserve actual positive counts without truncation', () => {
      expect(resolveProcurementCount(128)).toBe(128);
      expect(formatProcurementSummaryCount(128, 'PO')).toBe('128 PO');
    });
  });
});
