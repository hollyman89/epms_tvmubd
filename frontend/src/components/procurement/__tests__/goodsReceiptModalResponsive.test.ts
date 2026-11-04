import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * EPMS — GOODS RECEIPT MODAL RESPONSIVE UI/UX SUITE
 *
 * Verifies:
 * 1. Responsive architecture: CSS module with mobile (<640px) and desktop (>=641px) dual views.
 * 2. Internal scrolling and viewport protection: modalBody with max-height and overflow-y: auto.
 * 3. Mobile PWA presentation: mobileItemCard, metrics grid, touch-friendly inputs, stacked footer.
 * 4. Desktop presentation: desktopTableView with table horizontal scroll (x: 800).
 * 5. Input guards & validations: anti over-receipt clamp [0, remainingQty], negative prevention.
 * 6. Business rules: Material PO eligibility and SERVICE PO exclusion.
 */

describe('Goods Receipt Modal Responsive UI/UX Suite', () => {
  const modalPath = path.resolve(__dirname, '../GoodsReceiptModal.tsx');
  const cssPath = path.resolve(__dirname, '../GoodsReceiptModal.module.css');
  const procurementPagePath = path.resolve(__dirname, '../../ProcurementPage.tsx');

  const modalSource = fs.readFileSync(modalPath, 'utf8');
  const cssSource = fs.readFileSync(cssPath, 'utf8');
  const procurementPageSource = fs.readFileSync(procurementPagePath, 'utf8');

  describe('1. Responsive Architecture & CSS Module', () => {
    it('should import GoodsReceiptModal.module.css', () => {
      expect(modalSource).toContain("import styles from './GoodsReceiptModal.module.css';");
    });

    it('should apply grModal className to Modal root', () => {
      expect(modalSource).toContain('className={styles.grModal}');
    });

    it('should declare modalBody with viewport max-height and internal scrolling', () => {
      expect(modalSource).toContain('className={styles.modalBody}');
      expect(cssSource).toContain('.modalBody');
      expect(cssSource).toContain('max-height: calc(100vh - 160px)');
      expect(cssSource).toContain('overflow-y: auto');
      expect(cssSource).toContain('overflow-x: hidden');
      expect(cssSource).toContain('-webkit-overflow-scrolling: touch');
    });

    it('should declare dual view architecture in CSS (desktopTableView vs mobileCardsView)', () => {
      expect(cssSource).toContain('.desktopTableView');
      expect(cssSource).toContain('.mobileCardsView');
      expect(cssSource).toContain('@media (max-width: 640px)');
    });
  });

  describe('2. Desktop & Tablet Presentation (>=641px)', () => {
    it('should render desktopTableView containing Table with horizontal scroll', () => {
      expect(modalSource).toContain('className={styles.desktopTableView}');
      expect(modalSource).toContain('scroll={{ x: 800, y: 320 }}');
    });

    it('should define column widths and alignments for desktop table', () => {
      expect(modalSource).toContain("title: 'No'");
      expect(modalSource).toContain("title: 'Nama Item & Spesifikasi'");
      expect(modalSource).toContain("title: 'Qty Dipesan'");
      expect(modalSource).toContain("title: 'Sudah Diterima'");
      expect(modalSource).toContain("title: 'Sisa Outstanding'");
      expect(modalSource).toContain("title: 'Satuan'");
      expect(modalSource).toContain("title: 'Catatan Kondisi Barang'");
    });
  });

  describe('3. Mobile PWA Presentation (<=640px)', () => {
    it('should render mobileCardsView with structured mobileItemCard', () => {
      expect(modalSource).toContain('className={styles.mobileCardsView}');
      expect(modalSource).toContain('className={styles.mobileItemCard}');
      expect(modalSource).toContain('className={styles.itemIndexBadge}');
      expect(modalSource).toContain('className={styles.itemName}');
    });

    it('should render 2x2 metrics grid for essential item numbers', () => {
      expect(modalSource).toContain('className={styles.mobileMetricsGrid}');
      expect(modalSource).toContain('className={styles.mobileMetricBox}');
      expect(modalSource).toContain('Qty Dipesan');
      expect(modalSource).toContain('Sudah Diterima');
      expect(modalSource).toContain('Sisa Outstanding');
      expect(modalSource).toContain('Satuan');
    });

    it('should render touch-friendly inputs in mobile cards view', () => {
      expect(modalSource).toContain('className={styles.mobileInputRow}');
      expect(modalSource).toContain('className={styles.mobileInputNumber}');
      expect(modalSource).toContain('className={styles.mobileRemarksInput}');
    });

    it('should render full-width touch buttons in mobile footer (@media <= 640px)', () => {
      expect(cssSource).toContain('.modalFooter');
      expect(cssSource).toContain('.btnFooterSubmit');
      expect(cssSource).toContain('.btnFooterCancel');
      expect(cssSource).toContain('height: 42px !important');
      expect(cssSource).toContain('width: 100% !important');
    });
  });

  describe('4. Quantity & Over-Receipt Validation Guards', () => {
    it('should implement Layer 1 clamp guard [0, maxAllowed]', () => {
      expect(modalSource).toContain('handleItemQtyChange');
      expect(modalSource).toContain('Math.max(0, Math.min(rawVal, maxAllowed))');
      expect(modalSource).toContain('Kuantitas diterima tidak boleh bernilai negatif');
      expect(modalSource).toContain('Qty diterima maksimal');
    });

    it('should implement Layer 2 pre-submit SSOT validation', () => {
      expect(modalSource).toContain('inputQty > liveRemaining');
      expect(modalSource).toContain('inputQty < 0');
      expect(modalSource).toContain('Harap masukkan kuantitas diterima minimal > 0');
    });

    it('should provide "Terima Semua Item Tersisa" bulk action', () => {
      expect(modalSource).toContain('handleReceiveAll');
      expect(modalSource).toContain('Terima Semua Item Tersisa');
      expect(modalSource).toContain('className={styles.btnReceiveAll}');
    });
  });

  describe('5. Delivery Note & Remarks Support', () => {
    it('should include deliveryNoteNumber and remarks form fields', () => {
      expect(modalSource).toContain('name="deliveryNoteNumber"');
      expect(modalSource).toContain('name="remarks"');
      expect(modalSource).toContain('name="receiptDate"');
    });

    it('should pass trimmed deliveryNoteNumber to createGoodsReceipt payload', () => {
      expect(modalSource).toContain('deliveryNoteNumber: values.deliveryNoteNumber?.trim() || undefined');
      expect(modalSource).toContain('remarks: values.remarks || \'\'');
    });
  });

  describe('6. Business Rules & Material PO Eligibility', () => {
    it('should allow Goods Receipt only for eligible Material POs in ProcurementPage', () => {
      expect(procurementPageSource).toContain("isEligibleForGr && r.orderType !== 'SERVICE'");
      expect(procurementPageSource).toContain('Terima Barang');
    });

    it('should route SERVICE PO to SPK / Work Order and Service Claim, excluding Goods Receipt', () => {
      expect(procurementPageSource).toContain("r.orderType === 'SERVICE'");
      expect(procurementPageSource).toContain('SPK / Work Order');
    });
  });
});
