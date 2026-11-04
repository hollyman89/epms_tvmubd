import fs from 'fs';
import path from 'path';

describe('PM Service Claim Verification Modal Mobile Responsive Contracts (MOB-PROC-001)', () => {
  const modalTsxPath = path.resolve(__dirname, '../PmServiceClaimVerificationModal.tsx');
  const modalCssPath = path.resolve(__dirname, '../PmServiceClaimVerificationModal.module.css');

  let modalTsx: string;
  let modalCss: string;

  beforeAll(() => {
    modalTsx = fs.readFileSync(modalTsxPath, 'utf8');
    modalCss = fs.readFileSync(modalCssPath, 'utf8');
  });

  // 1. Desktop layout preserved
  test('1. Desktop layout preserved: 1040px ceiling, 2-column infoGrid, and right-aligned footer actions', () => {
    expect(modalTsx).toContain('width="min(1040px, 96vw)"');
    expect(modalCss).toMatch(/\.infoGrid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*1fr\)/);
    expect(modalCss).toMatch(/\.decisionButtonGroup\s*\{[^}]*display:\s*flex/);
    expect(modalCss).toMatch(/\.modalFooterActions\s*\{[^}]*justify-content:\s*flex-end/);
  });

  // 2. Mobile modal width bounded to viewport
  test('2. Mobile modal width bounded to viewport: width="min(1040px, 96vw)" ensures viewport adaptation on < 768px', () => {
    expect(modalTsx).toContain('width="min(1040px, 96vw)"');
    expect(modalTsx).not.toContain('width={1040}');
  });

  // 3. Footer wraps/stacks on mobile
  test('3. Footer wraps and stacks on mobile: modalFooterActions stacks buttons vertically with full width', () => {
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.modalFooterActions\s*\{[\s\S]*?flex-direction:\s*column-reverse/);
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.modalFooterActions\s*\{[\s\S]*?align-items:\s*stretch/);
    expect(modalCss).toMatch(/\.secondaryActionBtn,\s*\.primaryActionBtn\s*\{[^}]*width:\s*100%\s*!important/);
  });

  // 4. Setujui Teknis direct action button present
  test('4. Setujui Teknis direct action button present with confirmation modal trigger', () => {
    expect(modalTsx).toContain('Setujui Teknis');
    expect(modalTsx).toContain('onClick={() => setIsApproveModalOpen(true)}');
    expect(modalTsx).toContain('CheckCircleOutlined');
  });

  // 5. Minta Revisi direct action button present
  test('5. Minta Revisi direct action button present with revision modal trigger', () => {
    expect(modalTsx).toContain('Minta Revisi');
    expect(modalTsx).toContain('setIsReturnModalOpen(true)');
    expect(modalTsx).toContain('RollbackOutlined');
  });

  // 6. Tolak direct action button present
  test('6. Tolak direct action button present with rejection modal trigger', () => {
    expect(modalTsx).toContain('Tolak');
    expect(modalTsx).toContain('setIsRejectModalOpen(true)');
    expect(modalTsx).toContain('CloseCircleOutlined');
  });

  // 7. Decision inputs inside dedicated modals
  test('7. Decision inputs inside dedicated modals: required whitespace-validated revisionNotes and rejectionReason', () => {
    expect(modalTsx).toContain('name="revisionNotes"');
    expect(modalTsx).toContain('Catatan Permintaan Revisi (Wajib)');
    expect(modalTsx).toContain('name="rejectionReason"');
    expect(modalTsx).toContain('Alasan Penolakan (Wajib)');
    expect(modalTsx).toContain('whitespace: true');
    expect(modalTsx).toContain('<TextArea');
  });

  // 8. No business action removed and execution handlers intact
  test('8. Direct action execution handlers and cancellation flows intact without redundant execution button', () => {
    expect(modalTsx).toContain('onOk={handleConfirmTechnicalApprove}');
    expect(modalTsx).toContain('onOk={handleConfirmTechnicalReturn}');
    expect(modalTsx).toContain('onOk={handleConfirmTechnicalReject}');
    expect(modalTsx).not.toContain('Simpan Verifikasi Teknis');
    expect(modalTsx).toContain('onCancel={onClose}');
    expect(modalTsx).toContain('onClick={onClose}');
  });

  // 9. Mobile body remains scrollable
  test('9. Mobile body remains scrollable: table has internal horizontal scroll container', () => {
    expect(modalTsx).toContain('className={styles.tableWrapper}');
    expect(modalTsx).toContain('scroll={{ x: 950 }}');
    expect(modalCss).toMatch(/\.tableWrapper\s*\{[^}]*overflow-x:\s*auto/);
    expect(modalCss).toMatch(/\.tableWrapper\s*\{[^}]*-webkit-overflow-scrolling:\s*touch/);
  });

  // 10. No page-level horizontal overflow contract
  test('10. No page-level horizontal overflow contract: tableWrapper max-width 100%, infoGrid stacks on mobile', () => {
    expect(modalCss).toMatch(/\.tableWrapper\s*\{[^}]*max-width:\s*100%/);
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.infoGrid\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.decisionButtonGroup\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  });

  // 11. Desktop footer behavior preserved
  test('11. Desktop footer behavior preserved: horizontal flex row with right alignment on desktop', () => {
    expect(modalCss).toMatch(/\.modalFooterActions\s*\{[^}]*display:\s*flex/);
    expect(modalCss).toMatch(/\.modalFooterActions\s*\{[^}]*justify-content:\s*flex-end/);
    expect(modalCss).toMatch(/\.decisionButtonGroup\s*\{[^}]*display:\s*flex/);
  });
});
