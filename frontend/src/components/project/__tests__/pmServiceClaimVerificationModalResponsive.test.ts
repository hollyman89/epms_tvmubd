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

  // 4. Setujui Teknis remains present
  test('4. Setujui Teknis remains present and reachable in decisionButtonGroup', () => {
    expect(modalTsx).toContain('Setujui Teknis');
    expect(modalTsx).toContain("onClick={() => setDecisionAction('APPROVE')}");
    expect(modalTsx).toContain('CheckCircleOutlined');
  });

  // 5. Minta Revisi remains present
  test('5. Minta Revisi remains present and reachable in decisionButtonGroup', () => {
    expect(modalTsx).toContain('Minta Revisi');
    expect(modalTsx).toContain("onClick={() => setDecisionAction('RETURN')}");
    expect(modalTsx).toContain('RollbackOutlined');
  });

  // 6. Tolak remains present
  test('6. Tolak remains present and reachable in decisionButtonGroup', () => {
    expect(modalTsx).toContain('Tolak');
    expect(modalTsx).toContain("onClick={() => setDecisionAction('REJECT')}");
    expect(modalTsx).toContain('CloseCircleOutlined');
  });

  // 7. Decision inputs remain present
  test('7. Decision inputs remain present: required notes/reasons TextArea rendered when decision is RETURN or REJECT', () => {
    expect(modalTsx).toContain("decisionAction !== 'APPROVE'");
    expect(modalTsx).toContain('name="notes"');
    expect(modalTsx).toContain('Catatan Permintaan Revisi (Wajib)');
    expect(modalTsx).toContain('Alasan Penolakan (Wajib)');
    expect(modalTsx).toContain('<TextArea');
  });

  // 8. No business action removed
  test('8. No business action removed: handleExecuteDecision, onClose, and all decision flows intact', () => {
    expect(modalTsx).toContain('onClick={handleExecuteDecision}');
    expect(modalTsx).toContain('Simpan Verifikasi Teknis');
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
