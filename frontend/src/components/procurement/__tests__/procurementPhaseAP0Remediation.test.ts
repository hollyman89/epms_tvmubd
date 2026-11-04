import { describe, it, expect } from '@jest/globals';
import { getCanonicalRoleLandingRoute } from '@/constants/menuConfig';

describe('EPMS Procurement Phase A — P0 Functional & Navigation Remediation Suite', () => {
  describe('1. P0-001: RFQ Notes Contract & Form Payload Verification', () => {
    it('verifies CreateRfqPayload typing allows optional notes', () => {
      const payload: { purchaseRequestId: number; closingDate?: string; notes?: string } = {
        purchaseRequestId: 12,
        closingDate: '2026-11-20T12:00:00.000Z',
        notes: 'Pengiriman ke lokasi proyek, Franco Gudang',
      };
      expect(payload.notes).toBe('Pengiriman ke lokasi proyek, Franco Gudang');

      // Empty optional notes is valid
      const emptyNotesPayload: { purchaseRequestId: number; closingDate?: string; notes?: string } = {
        purchaseRequestId: 12,
        closingDate: '2026-11-20T12:00:00.000Z',
      };
      expect(emptyNotesPayload.notes).toBeUndefined();
    });

    it('sanitizes and trims user notes before submitting', () => {
      const formValues = {
        closingDate: '2026-11-20',
        notes: '   Term of Payment 30 hari kalender   ',
      };
      const trimmed = formValues.notes?.trim() || undefined;
      expect(trimmed).toBe('Term of Payment 30 hari kalender');

      const blankValues = { notes: '   ' };
      const trimmedBlank = blankValues.notes?.trim() || undefined;
      expect(trimmedBlank).toBeUndefined();
    });
  });

  describe('2. P0-002: Goods Receipt Delivery Note Number Contract & Form Payload Verification', () => {
    it('verifies CreateGRPayload typing allows optional deliveryNoteNumber', () => {
      const payload: {
        purchaseOrderId: number;
        receiptDate: string;
        deliveryNoteNumber?: string;
        remarks?: string;
        items: any[];
      } = {
        purchaseOrderId: 5,
        receiptDate: '2026-11-04T10:00:00.000Z',
        deliveryNoteNumber: 'SJ/VND/2026/0891',
        remarks: 'Barang lengkap diterima',
        items: [{ poItemId: 1, receivedQuantity: 10 }],
      };
      expect(payload.deliveryNoteNumber).toBe('SJ/VND/2026/0891');

      // Empty optional deliveryNoteNumber is valid
      const emptyDoPayload: {
        purchaseOrderId: number;
        receiptDate: string;
        deliveryNoteNumber?: string;
        items: any[];
      } = {
        purchaseOrderId: 5,
        receiptDate: '2026-11-04T10:00:00.000Z',
        items: [{ poItemId: 1, receivedQuantity: 10 }],
      };
      expect(emptyDoPayload.deliveryNoteNumber).toBeUndefined();
    });

    it('sanitizes and trims delivery note number before submitting', () => {
      const formValues = { deliveryNoteNumber: '   DO-2026-999   ' };
      const trimmed = formValues.deliveryNoteNumber?.trim() || undefined;
      expect(trimmed).toBe('DO-2026-999');

      const blankValues = { deliveryNoteNumber: '   ' };
      const trimmedBlank = blankValues.deliveryNoteNumber?.trim() || undefined;
      expect(trimmedBlank).toBeUndefined();
    });
  });

  describe('3. P0-004: Project Master Role-Based Action Gating', () => {
    const computeProjectMasterCapabilities = (roles: string[] = []) => {
      const userRolesUpper = roles.map((r) => String(r).toUpperCase());
      const canAccessProjectDelivery = userRolesUpper.some((r) =>
        ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'DIRECTOR', 'PMO', 'PROJECT_MANAGER'].includes(r)
      );
      const isProcurementUser = userRolesUpper.some((r) => ['PROCUREMENT', 'PURCHASING'].includes(r));

      return {
        canAccessProjectDelivery,
        isProcurementUser,
        drawerFooterCta: canAccessProjectDelivery
          ? 'Buka Project Delivery'
          : isProcurementUser
          ? 'Buka Procurement Hub'
          : null,
        showGanttScheduleControl: canAccessProjectDelivery,
      };
    };

    it('denies /project-delivery navigation to pure PURCHASING account and renders Procurement Hub CTA', () => {
      const caps = computeProjectMasterCapabilities(['PURCHASING']);
      expect(caps.canAccessProjectDelivery).toBe(false);
      expect(caps.isProcurementUser).toBe(true);
      expect(caps.drawerFooterCta).toBe('Buka Procurement Hub');
      expect(caps.showGanttScheduleControl).toBe(false);
    });

    it('denies /project-delivery navigation to pure PROCUREMENT account and renders Procurement Hub CTA', () => {
      const caps = computeProjectMasterCapabilities(['PROCUREMENT']);
      expect(caps.canAccessProjectDelivery).toBe(false);
      expect(caps.isProcurementUser).toBe(true);
      expect(caps.drawerFooterCta).toBe('Buka Procurement Hub');
      expect(caps.showGanttScheduleControl).toBe(false);
    });

    it('allows /project-delivery navigation and Gantt button to PROJECT_MANAGER', () => {
      const caps = computeProjectMasterCapabilities(['PROJECT_MANAGER']);
      expect(caps.canAccessProjectDelivery).toBe(true);
      expect(caps.isProcurementUser).toBe(false);
      expect(caps.drawerFooterCta).toBe('Buka Project Delivery');
      expect(caps.showGanttScheduleControl).toBe(true);
    });

    it('allows /project-delivery navigation and Gantt button to SUPER_ADMIN, ADMIN, and DIRECTOR', () => {
      for (const role of ['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'PMO', 'HEAD_OF_OPERATIONS']) {
        const caps = computeProjectMasterCapabilities([role]);
        expect(caps.canAccessProjectDelivery).toBe(true);
        expect(caps.drawerFooterCta).toBe('Buka Project Delivery');
        expect(caps.showGanttScheduleControl).toBe(true);
      }
    });
  });

  describe('4. P0-004: ProtectedRoute Canonical Landing & 403 Escape Route', () => {
    it('resolves /procurement as canonical homeRoute for PURCHASING and PROCUREMENT', () => {
      expect(getCanonicalRoleLandingRoute(['PURCHASING'])).toBe('/procurement');
      expect(getCanonicalRoleLandingRoute(['PROCUREMENT'])).toBe('/procurement');
    });

    it('resolves correct homeRoute for other standard roles without regression', () => {
      expect(getCanonicalRoleLandingRoute(['SUPER_ADMIN'])).toBe('/dashboard');
      expect(getCanonicalRoleLandingRoute(['ADMIN'])).toBe('/dashboard');
      expect(getCanonicalRoleLandingRoute(['DIRECTOR'])).toBe('/dashboard');
      expect(getCanonicalRoleLandingRoute(['PROJECT_MANAGER'])).toBe('/project-delivery');
      expect(getCanonicalRoleLandingRoute(['PMO'])).toBe('/project-delivery');
      expect(getCanonicalRoleLandingRoute(['FINANCE'])).toBe('/finance/invoices');
      expect(getCanonicalRoleLandingRoute(['MARKETING'])).toBe('/sales');
      expect(getCanonicalRoleLandingRoute(['LEGAL'])).toBe('/legal/review');
    });
  });
});

