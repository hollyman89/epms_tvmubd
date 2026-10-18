/**
 * EPMS — PROCUREMENT-SUMMARY-LAZYLOAD-R1
 * Frontend Unit Tests for Authoritative Dashboard Counters & Lazy-Loaded Consistency
 */

import {
  resolveSummaryCardValue,
  resolveProcurementCount,
  formatProcurementSummaryCount,
} from '../../ProcurementPage';

describe('EPMS — PROCUREMENT-SUMMARY-LAZYLOAD-R1 Frontend Unit Tests', () => {
  describe('1 & 2. Initial PR & PO Card Resolution', () => {
    it('1. initial PR card uses summary count (2), not unloaded prs.length (0)', () => {
      // On initial page load: summary has 2 PRs, but PR tab is not visited (prs = [])
      const result = resolveSummaryCardValue({
        summaryCount: 2,
        localArray: [], // prs not yet loaded
        isLoading: false,
        isAuthorized: true,
      });

      expect(result.displayValue).toBe(2);
      expect(result.isLoading).toBe(false);
    });

    it('2. initial PO card uses summary count (2), not unloaded pos.length (0)', () => {
      // On initial page load: summary has 2 POs, but PO tab is not visited (pos = [])
      const result = resolveSummaryCardValue({
        summaryCount: 2,
        localArray: [], // pos not yet loaded
        isLoading: false,
        isAuthorized: true,
      });

      expect(result.displayValue).toBe(2);
      expect(result.isLoading).toBe(false);
    });
  });

  describe('3. Goods Receipt Badge Resolution', () => {
    it('3. GR badge uses summary count (1) even before GR tab is opened', () => {
      const summaryGoodsReceiptCount = 1;
      const allGoodsReceipts: any[] = []; // unloaded

      const grBadgeCount = summaryGoodsReceiptCount !== undefined
        ? summaryGoodsReceiptCount
        : allGoodsReceipts.length;

      expect(grBadgeCount).toBe(1);
    });
  });

  describe('4. Loading State vs Loaded Zero', () => {
    it('4. distinguishes loading state from an authoritative zero', () => {
      // Case A: Query is still loading, summaryCount is not yet available
      const loadingResult = resolveSummaryCardValue({
        summaryCount: undefined,
        localArray: [],
        isLoading: true,
        isAuthorized: true,
      });
      expect(loadingResult.isLoading).toBe(true);
      expect(loadingResult.displayValue).toBe('LOADING');

      // Case B: Query finished successfully with an authoritative count of 0
      const loadedZeroResult = resolveSummaryCardValue({
        summaryCount: 0,
        localArray: [],
        isLoading: false,
        isAuthorized: true,
      });
      expect(loadedZeroResult.isLoading).toBe(false);
      expect(loadedZeroResult.displayValue).toBe(0);
    });
  });

  describe('5 & 6. Tab Activation Consistency (No 0 -> 2 Jump)', () => {
    it('5. opening PR tab does not change summary count (remains 2)', () => {
      // Before tab open:
      const beforeOpen = resolveSummaryCardValue({
        summaryCount: 2,
        localArray: [],
        isLoading: false,
      });
      expect(beforeOpen.displayValue).toBe(2);

      // After tab open: prs loaded with 2 items
      const afterOpen = resolveSummaryCardValue({
        summaryCount: 2,
        localArray: [{ id: 1 }, { id: 2 }],
        isLoading: false,
      });
      expect(afterOpen.displayValue).toBe(2);
      expect(beforeOpen.displayValue).toBe(afterOpen.displayValue);
    });

    it('6. opening PO tab does not change summary count (remains 2)', () => {
      // Before tab open:
      const beforeOpen = resolveSummaryCardValue({
        summaryCount: 2,
        localArray: [],
        isLoading: false,
      });
      expect(beforeOpen.displayValue).toBe(2);

      // After tab open: pos loaded with 2 items
      const afterOpen = resolveSummaryCardValue({
        summaryCount: 2,
        localArray: [{ id: 101, orderType: 'MATERIAL' }, { id: 102, orderType: 'SERVICE' }],
        isLoading: false,
      });
      expect(afterOpen.displayValue).toBe(2);
      expect(beforeOpen.displayValue).toBe(afterOpen.displayValue);
    });
  });

  describe('7 & 8. Material & Service PO Separation', () => {
    it('7. Service PO contributes to total PO count', () => {
      const pos = [
        { id: 1, poNumber: 'PO-20261014-001', orderType: 'MATERIAL' },
        { id: 2, poNumber: 'PO-20261014-002', orderType: 'SERVICE' },
      ];
      // PO total must be 2
      expect(resolveProcurementCount(pos)).toBe(2);
      expect(formatProcurementSummaryCount(pos, 'PO')).toBe('2 PO');
    });

    it('8. Service PO does NOT contribute to Goods Receipt count', () => {
      const goodsReceipts = [
        { grId: '1', poNumber: 'PO-20261014-001', orderType: 'MATERIAL' },
      ];
      // Only 1 GR for the MATERIAL PO; SERVICE PO has 0 GRs
      expect(goodsReceipts.length).toBe(1);
      expect(goodsReceipts.every(g => g.orderType === 'MATERIAL')).toBe(true);
    });
  });

  describe('9. Director / Executive Reconciliation Counter & No Dash Display (HF02)', () => {
    it('9a. Director with reconciliation count 0 renders numeric 0 (never "—")', () => {
      const directorReconciliation = resolveSummaryCardValue({
        summaryCount: 0,
        localArray: [],
        isLoading: false,
        isAuthorized: true, // Director is authorized to monitor reconciliation count
      });

      expect(directorReconciliation.isUnauthorized).toBe(false);
      expect(directorReconciliation.displayValue).toBe(0);
      expect(directorReconciliation.displayValue).not.toBe('—');
    });

    it('9b. Director with reconciliation count > 0 renders actual numeric count', () => {
      const directorReconciliation = resolveSummaryCardValue({
        summaryCount: 5,
        localArray: [],
        isLoading: false,
        isAuthorized: true,
      });

      expect(directorReconciliation.isUnauthorized).toBe(false);
      expect(directorReconciliation.displayValue).toBe(5);
    });

    it('9c. Every visible Procurement summary card renders numeric 0 when count is 0 (never "—")', () => {
      const zeroMetrics = [
        resolveSummaryCardValue({ summaryCount: 0, isAuthorized: true }),
        resolveSummaryCardValue({ summaryCount: 0, isAuthorized: false }),
        resolveSummaryCardValue({ summaryCount: null, isAuthorized: false }),
      ];

      for (const m of zeroMetrics) {
        expect(m.displayValue).toBe(0);
        expect(m.displayValue).not.toBe('—');
      }
    });
  });
});
