import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * EPMS — SERVICE CLAIM COMMERCIAL VERIFICATION DIRECT ACTION BUTTONS TEST SUITE
 *
 * Verifies Option A implementation in ServiceClaimModal.tsx:
 * 1. Removal of redundant 'Eksekusi Keputusan' in commercial verification mode.
 * 2. Elimination of inert preselected 'decisionAction' state for commercial verification.
 * 3. Direct action buttons: 'Setujui Komersial', 'Minta Revisi', 'Tolak Klaim', and 'Batal'.
 * 4. Confirmation dialog for Setujui Komersial (submits decision: APPROVE without revisionNotes).
 * 5. Input dialog for Minta Revisi enforcing non-empty revisionNotes (submits decision: RETURN).
 * 6. Input dialog for Tolak Klaim enforcing non-empty rejectionReason (submits decision: REJECT).
 * 7. Duplicate submission prevention during pending requests (isSubmitting guard).
 * 8. Error handling and canonical state refresh upon success.
 * 9. Preservation of PM technical verification invariant and RBAC gating.
 */

describe('Service Claim Commercial Direct Action Buttons Suite (Option A)', () => {
  const componentPath = path.resolve(__dirname, '../ServiceClaimModal.tsx');
  const stylesheetPath = path.resolve(__dirname, '../ServiceClaimModal.module.css');

  const componentSource = fs.readFileSync(componentPath, 'utf8');
  const stylesheetSource = fs.readFileSync(stylesheetPath, 'utf8');

  describe('1. Component Architecture & Elimination of Redundant Affordance', () => {
    it('should NOT contain "Eksekusi Keputusan" in commercial verification mode', () => {
      // Commercial verification section must not contain the old 'Eksekusi Keputusan' button
      const commercialSectionMatch = componentSource.match(/VIEW MODE: VERIFY COMMERCIAL[\s\S]*?VIEW MODE: VERIFY TECHNICAL/);
      expect(commercialSectionMatch).toBeTruthy();
      const commercialSection = commercialSectionMatch![0];
      expect(commercialSection).not.toContain('Eksekusi Keputusan');
    });

    it('should render direct action buttons with explicit IDs and icons in commercial mode', () => {
      const commercialSectionMatch = componentSource.match(/VIEW MODE: VERIFY COMMERCIAL[\s\S]*?VIEW MODE: VERIFY TECHNICAL/);
      expect(commercialSectionMatch).toBeTruthy();
      const commercialSection = commercialSectionMatch![0];

      expect(commercialSection).toContain('id="btn-commercial-approve"');
      expect(commercialSection).toContain('Setujui Komersial');
      expect(commercialSection).toContain('id="btn-commercial-return"');
      expect(commercialSection).toContain('Minta Revisi');
      expect(commercialSection).toContain('id="btn-commercial-reject"');
      expect(commercialSection).toContain('Tolak Klaim');
      expect(commercialSection).toContain('Batal');
    });

    it('should maintain responsive action container classes in CSS and component', () => {
      expect(stylesheetSource).toContain('.decisionActionGroup');
      expect(stylesheetSource).toContain('.modalFooterActions');
      expect(componentSource).toContain('className={styles.decisionActionGroup}');
      expect(componentSource).toContain('className={styles.modalFooterActions}');
    });
  });

  describe('2. Direct Confirmation Dialog for Setujui Komersial (APPROVE)', () => {
    it('should declare confirmation modal for commercial approval', () => {
      expect(componentSource).toContain('title="Konfirmasi Persetujuan Komersial"');
      expect(componentSource).toContain('open={isApproveModalOpen}');
      expect(componentSource).toContain('onOk={handleConfirmCommercialApprove}');
      expect(componentSource).toContain('okText="Ya, Setujui Komersial"');
    });

    it('should submit decision: APPROVE without requiring revision notes', () => {
      expect(componentSource).toContain("decision: 'APPROVE'");
      // handleConfirmCommercialApprove must not validate revisionNotes or rejectionReason
      const approveHandlerMatch = componentSource.match(/const handleConfirmCommercialApprove = async \(\) => {[\s\S]*?};/);
      expect(approveHandlerMatch).toBeTruthy();
      const handlerBody = approveHandlerMatch![0];
      expect(handlerBody).toContain("decision: 'APPROVE'");
      expect(handlerBody).not.toContain('values.revisionNotes');
      expect(handlerBody).not.toContain('values.rejectionReason');
    });
  });

  describe('3. Direct Input Dialog for Minta Revisi (RETURN)', () => {
    it('should declare modal dialog with revisionNotes form field', () => {
      expect(componentSource).toContain('title={`Minta Revisi Klaim Jasa — ${selectedClaim.claimNumber}`}');
      expect(componentSource).toContain('open={isReturnModalOpen}');
      expect(componentSource).toContain('onOk={handleConfirmCommercialReturn}');
      expect(componentSource).toContain('okText="Kirim Permintaan Revisi"');
      expect(componentSource).toContain('name="revisionNotes"');
    });

    it('should enforce required non-empty validation with whitespace check on revisionNotes', () => {
      expect(componentSource).toContain("rules={[\n                      { required: true, whitespace: true, message: 'Catatan revisi wajib diisi!' },\n                    ]}");
    });

    it('should submit decision: RETURN with revisionNotes payload', () => {
      const returnHandlerMatch = componentSource.match(/const handleConfirmCommercialReturn = async \(\) => {[\s\S]*?};/);
      expect(returnHandlerMatch).toBeTruthy();
      const handlerBody = returnHandlerMatch![0];
      expect(handlerBody).toContain("decision: 'RETURN'");
      expect(handlerBody).toContain('revisionNotes: values.revisionNotes');
    });
  });

  describe('4. Direct Input Dialog for Tolak Klaim (REJECT)', () => {
    it('should declare modal dialog with rejectionReason form field and danger style', () => {
      expect(componentSource).toContain('title={`Tolak Klaim Jasa — ${selectedClaim.claimNumber}`}');
      expect(componentSource).toContain('open={isRejectModalOpen}');
      expect(componentSource).toContain('onOk={handleConfirmCommercialReject}');
      expect(componentSource).toContain('okText="Tolak Klaim"');
      expect(componentSource).toContain('name="rejectionReason"');
      expect(componentSource).toContain('okButtonProps={{ danger: true }}');
    });

    it('should enforce required non-empty validation with whitespace check on rejectionReason', () => {
      expect(componentSource).toContain("rules={[\n                      { required: true, whitespace: true, message: 'Alasan penolakan wajib diisi!' },\n                    ]}");
    });

    it('should submit decision: REJECT with rejectionReason payload', () => {
      const rejectHandlerMatch = componentSource.match(/const handleConfirmCommercialReject = async \(\) => {[\s\S]*?};/);
      expect(rejectHandlerMatch).toBeTruthy();
      const handlerBody = rejectHandlerMatch![0];
      expect(handlerBody).toContain("decision: 'REJECT'");
      expect(handlerBody).toContain('rejectionReason: values.rejectionReason');
    });
  });

  describe('5. Duplicate Submission Prevention & Loading State', () => {
    it('should guard each handler against duplicate execution during pending submission', () => {
      expect(componentSource).toContain('if (!selectedClaim || isSubmitting) return;');
      expect(componentSource).toContain('confirmLoading={isSubmitting}');
      expect(componentSource).toContain('disabled={isSubmitting}');
    });

    it('should reset isSubmitting in finally block across all three handlers', () => {
      const approveFinally = componentSource.match(/handleConfirmCommercialApprove[\s\S]*?finally\s*{\s*setIsSubmitting\(false\);/);
      const returnFinally = componentSource.match(/handleConfirmCommercialReturn[\s\S]*?finally\s*{\s*setIsSubmitting\(false\);/);
      const rejectFinally = componentSource.match(/handleConfirmCommercialReject[\s\S]*?finally\s*{\s*setIsSubmitting\(false\);/);

      expect(approveFinally).toBeTruthy();
      expect(returnFinally).toBeTruthy();
      expect(rejectFinally).toBeTruthy();
    });
  });

  describe('6. Canonical State Refresh & Error Propagation', () => {
    it('should display backend error via message.error and avoid optimistic state corruption', () => {
      expect(componentSource).toContain("message.error(err?.response?.data?.message || 'Gagal memproses persetujuan komersial.');");
      expect(componentSource).toContain("message.error(err?.response?.data?.message || 'Gagal memproses permintaan revisi.');");
      expect(componentSource).toContain("message.error(err?.response?.data?.message || 'Gagal memproses penolakan klaim.');");
    });

    it('should invoke loadData, return to LIST view, and trigger onClaimUpdated upon success', () => {
      expect(componentSource).toContain('await loadData();\n      setViewMode(\'LIST\');\n      if (onClaimUpdated) onClaimUpdated();');
    });
  });

  describe('7. Segregation of Duties & RBAC Role Isolation', () => {
    it('should preserve role gating: only PROCUREMENT / PURCHASING can verify commercial', () => {
      expect(componentSource).toContain("const canVerifyCommercial = isSuperAdmin || (isPurchasingOrProcurement && !isProjectManager);");
      expect(componentSource).toContain("const canVerifyTechnical = isSuperAdmin || (isProjectManager && !isPurchasingOrProcurement);");
    });

    it('should check canVerifyCommercial at handler entry and reject unauthorized execution', () => {
      expect(componentSource).toContain("if (!canVerifyCommercial) {\n      message.warning('Anda tidak memiliki hak akses untuk melakukan verifikasi komersial.');\n      return;\n    }");
    });

    it('should preserve PM technical verification view upgraded with direct action handlers', () => {
      expect(componentSource).toContain('const handleConfirmTechnicalApprove = async () => {');
      expect(componentSource).toContain('const handleConfirmTechnicalReturn = async () => {');
      expect(componentSource).toContain('const handleConfirmTechnicalReject = async () => {');
      expect(componentSource).toContain('{/* VIEW MODE: VERIFY TECHNICAL (PM) */}');
      expect(componentSource).not.toContain('Eksekusi Keputusan Teknis');
    });
  });
});

