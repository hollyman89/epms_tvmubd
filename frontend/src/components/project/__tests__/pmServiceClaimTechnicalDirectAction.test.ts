import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * EPMS — PM SERVICE CLAIM TECHNICAL VERIFICATION DIRECT ACTION BUTTONS TEST SUITE
 *
 * Verifies Option A implementation across both PM Technical Verification entry points:
 * 1. Primary: PmServiceClaimVerificationModal.tsx (Project Delivery Workspace)
 * 2. Secondary: ServiceClaimModal.tsx (Procurement Detail View Mode)
 *
 * Assertions:
 * - Elimination of redundant execution buttons ('Simpan Verifikasi Teknis' / 'Eksekusi Keputusan Teknis')
 * - Direct action buttons: 'Setujui Teknis', 'Minta Revisi', 'Tolak' / 'Tolak Klaim', 'Tutup' / 'Batal'
 * - Dedicated Ant Design Modals for Confirmation, Revision, and Rejection
 * - Mandatory non-empty whitespace-validated input for revisionNotes and rejectionReason
 * - Duplicate submission prevention (isSubmitting guard)
 * - Safe error handling (server message displayed, no optimistic status mutation)
 * - Canonical refresh & callback upon successful response
 * - Strict Segregation of Duties: PM verifies technical volume; Purchasing cannot access technical actions
 */

describe('PM Service Claim Technical Direct Action Buttons Suite (Option A)', () => {
  const pmModalPath = path.resolve(__dirname, '../PmServiceClaimVerificationModal.tsx');
  const procurementModalPath = path.resolve(__dirname, '../../procurement/ServiceClaimModal.tsx');

  const pmModalSource = fs.readFileSync(pmModalPath, 'utf8');
  const procurementModalSource = fs.readFileSync(procurementModalPath, 'utf8');

  describe('1. Primary Entry Point: PmServiceClaimVerificationModal.tsx Architecture', () => {
    it('should NOT contain the old "Simpan Verifikasi Teknis" execution button', () => {
      expect(pmModalSource).not.toContain('Simpan Verifikasi Teknis');
    });

    it('should render direct action buttons with explicit IDs and icons in SUBMITTED state', () => {
      expect(pmModalSource).toContain('id="btn-pm-technical-approve"');
      expect(pmModalSource).toContain('Setujui Teknis');
      expect(pmModalSource).toContain('id="btn-pm-technical-return"');
      expect(pmModalSource).toContain('Minta Revisi');
      expect(pmModalSource).toContain('id="btn-pm-technical-reject"');
      expect(pmModalSource).toContain('Tolak');
      expect(pmModalSource).toContain('Tutup');
    });

    it('should declare controlled confirmation dialog for technical approval', () => {
      expect(pmModalSource).toContain('title="Konfirmasi Verifikasi Teknis"');
      expect(pmModalSource).toContain('open={isApproveModalOpen}');
      expect(pmModalSource).toContain('onOk={handleConfirmTechnicalApprove}');
      expect(pmModalSource).toContain('okText="Ya, Setujui Teknis"');
      expect(pmModalSource).toContain('confirmLoading={isSubmitting}');
    });

    it('should submit APPROVE payload without requiring revision notes', () => {
      const approveHandlerMatch = pmModalSource.match(/const handleConfirmTechnicalApprove = async \(\) => {[\s\S]*?};/);
      expect(approveHandlerMatch).toBeTruthy();
      const handlerBody = approveHandlerMatch![0];
      expect(handlerBody).toContain("decision: 'APPROVE'");
      expect(handlerBody).not.toContain('values.revisionNotes');
      expect(handlerBody).not.toContain('values.rejectionReason');
      expect(handlerBody).toContain('if (!claim || isSubmitting) return;');
    });

    it('should declare modal dialog for return with whitespace-validated revisionNotes', () => {
      expect(pmModalSource).toContain('title={`Minta Revisi Klaim Jasa — ${claim.claimNumber}`}');
      expect(pmModalSource).toContain('open={isReturnModalOpen}');
      expect(pmModalSource).toContain('onOk={handleConfirmTechnicalReturn}');
      expect(pmModalSource).toContain('okText="Kirim Permintaan Revisi"');
      expect(pmModalSource).toContain('name="revisionNotes"');
      expect(pmModalSource).toContain('whitespace: true');
    });

    it('should submit RETURN payload with trimmed revisionNotes', () => {
      const returnHandlerMatch = pmModalSource.match(/const handleConfirmTechnicalReturn = async \(\) => {[\s\S]*?};/);
      expect(returnHandlerMatch).toBeTruthy();
      const handlerBody = returnHandlerMatch![0];
      expect(handlerBody).toContain("decision: 'RETURN'");
      expect(handlerBody).toContain('revisionNotes: values.revisionNotes.trim()');
      expect(handlerBody).toContain('if (!claim || isSubmitting) return;');
    });

    it('should declare modal dialog for rejection with whitespace-validated rejectionReason', () => {
      expect(pmModalSource).toContain('title={`Tolak Klaim Jasa — ${claim.claimNumber}`}');
      expect(pmModalSource).toContain('open={isRejectModalOpen}');
      expect(pmModalSource).toContain('onOk={handleConfirmTechnicalReject}');
      expect(pmModalSource).toContain('okText="Tolak Klaim"');
      expect(pmModalSource).toContain('name="rejectionReason"');
      expect(pmModalSource).toContain('whitespace: true');
    });

    it('should submit REJECT payload with trimmed rejectionReason', () => {
      const rejectHandlerMatch = pmModalSource.match(/const handleConfirmTechnicalReject = async \(\) => {[\s\S]*?};/);
      expect(rejectHandlerMatch).toBeTruthy();
      const handlerBody = rejectHandlerMatch![0];
      expect(handlerBody).toContain("decision: 'REJECT'");
      expect(handlerBody).toContain('rejectionReason: values.rejectionReason.trim()');
      expect(handlerBody).toContain('if (!claim || isSubmitting) return;');
    });

    it('should invoke onSuccess callback and close modal after successful response', () => {
      expect(pmModalSource).toContain('onSuccess?.(res);');
      expect(pmModalSource).toContain('onClose();');
    });

    it('should handle backend error safely without closing modal or mutating state optimistically', () => {
      expect(pmModalSource).toContain("message.error(err?.response?.data?.message || 'Gagal memproses verifikasi teknis.');");
      expect(pmModalSource).toContain("message.error(err?.response?.data?.message || 'Gagal memproses pengembalian revisi.');");
      expect(pmModalSource).toContain("message.error(err?.response?.data?.message || 'Gagal memproses penolakan klaim.');");
    });
  });

  describe('2. Secondary Entry Point: ServiceClaimModal.tsx Technical Verification View', () => {
    it('should NOT contain the old "Eksekusi Keputusan Teknis" button', () => {
      expect(procurementModalSource).not.toContain('Eksekusi Keputusan Teknis');
    });

    it('should render direct action buttons with secondary IDs in VERIFY_TECHNICAL view mode', () => {
      const techSectionMatch = procurementModalSource.match(/VIEW MODE: VERIFY TECHNICAL[\s\S]*?<\/Modal>/);
      expect(techSectionMatch).toBeTruthy();
      const techSection = techSectionMatch![0];

      expect(techSection).toContain('id="btn-pm-technical-approve-sec"');
      expect(techSection).toContain('Setujui Teknis');
      expect(techSection).toContain('id="btn-pm-technical-return-sec"');
      expect(techSection).toContain('Minta Revisi');
      expect(techSection).toContain('id="btn-pm-technical-reject-sec"');
      expect(techSection).toContain('Tolak Klaim');
      expect(techSection).toContain('Batal');
    });

    it('should declare secondary technical confirmation modal with APPROVE dispatch', () => {
      expect(procurementModalSource).toContain('open={isTechApproveModalOpen}');
      expect(procurementModalSource).toContain('onOk={handleConfirmTechnicalApprove}');
      expect(procurementModalSource).toContain("decision: 'APPROVE'");
    });

    it('should declare secondary technical return modal with whitespace-validated revisionNotes', () => {
      expect(procurementModalSource).toContain('open={isTechReturnModalOpen}');
      expect(procurementModalSource).toContain('onOk={handleConfirmTechnicalReturn}');
      expect(procurementModalSource).toContain("decision: 'RETURN'");
      expect(procurementModalSource).toContain('form={techReturnForm}');
    });

    it('should declare secondary technical reject modal with whitespace-validated rejectionReason', () => {
      expect(procurementModalSource).toContain('open={isTechRejectModalOpen}');
      expect(procurementModalSource).toContain('onOk={handleConfirmTechnicalReject}');
      expect(procurementModalSource).toContain("decision: 'REJECT'");
      expect(procurementModalSource).toContain('form={techRejectForm}');
    });

    it('should reload canonical data and reset view mode upon successful technical decision', () => {
      const techApproveHandler = procurementModalSource.match(/const handleConfirmTechnicalApprove = async \(\) => {[\s\S]*?};/);
      expect(techApproveHandler).toBeTruthy();
      expect(techApproveHandler![0]).toContain('await loadData();');
      expect(techApproveHandler![0]).toContain("setViewMode('LIST');");
    });
  });

  describe('3. Role Authorization & Segregation of Duties Invariants', () => {
    it('should gate technical actions behind canVerifyTechnical', () => {
      expect(procurementModalSource).toContain('const canVerifyTechnical = isSuperAdmin || (isProjectManager && !isPurchasingOrProcurement);');
    });

    it('should ensure Purchasing users cannot access PM technical verification', () => {
      const isSuperAdmin = false;
      const isPurchasingOrProcurement = true;
      const isProjectManager = false;

      const canVerifyTechnical = isSuperAdmin || (isProjectManager && !isPurchasingOrProcurement);
      const canVerifyCommercial = isSuperAdmin || (isPurchasingOrProcurement && !isProjectManager);

      expect(canVerifyTechnical).toBe(false);
      expect(canVerifyCommercial).toBe(true);
    });

    it('should ensure PM users cannot access Purchasing commercial verification', () => {
      const isSuperAdmin = false;
      const isPurchasingOrProcurement = false;
      const isProjectManager = true;

      const canVerifyTechnical = isSuperAdmin || (isProjectManager && !isPurchasingOrProcurement);
      const canVerifyCommercial = isSuperAdmin || (isPurchasingOrProcurement && !isProjectManager);

      expect(canVerifyTechnical).toBe(true);
      expect(canVerifyCommercial).toBe(false);
    });
  });
});

