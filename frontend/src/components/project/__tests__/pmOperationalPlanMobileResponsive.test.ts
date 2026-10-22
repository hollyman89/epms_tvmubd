import fs from 'fs';
import path from 'path';

describe('PM Operational Plan Mobile Responsive Layout Contracts (P0 Fix)', () => {
  const modalTsxPath = path.resolve(__dirname, '../PmOperationalPlanModal.tsx');
  const modalCssPath = path.resolve(__dirname, '../PmOperationalPlanModal.module.css');

  let tsxContent: string;
  let cssContent: string;

  beforeAll(() => {
    tsxContent = fs.readFileSync(modalTsxPath, 'utf8');
    cssContent = fs.readFileSync(modalCssPath, 'utf8');
  });

  // 1. Mobile sidebar stacks above content
  test('1. Mobile sidebar stacks above content: workspaceContainer switches to flex-direction column on mobile', () => {
    expect(tsxContent).toContain('className={styles.workspaceContainer}');
    expect(tsxContent).toContain('className={styles.leftCompletenessPanel}');
    expect(tsxContent).toContain('className={styles.rightMainViewport}');

    // CSS must have media query for < 768px changing workspaceContainer to column
    expect(cssContent).toMatch(/@media\s*\(max-width:\s*767px\)/);
    expect(cssContent).toContain('flex-direction: column !important');
  });

  // 2. Desktop sidebar remains two-column
  test('2. Desktop sidebar remains two-column: workspaceContainer uses row and leftCompletenessPanel is 230px on desktop', () => {
    expect(cssContent).toMatch(/\.workspaceContainer\s*\{[^}]*flex-direction:\s*row/);
    expect(cssContent).toMatch(/\.leftCompletenessPanel\s*\{[^}]*width:\s*230px/);
    expect(cssContent).toMatch(/\.leftCompletenessPanel\s*\{[^}]*min-width:\s*230px/);
    expect(cssContent).toMatch(/\.leftCompletenessPanel\s*\{[^}]*max-width:\s*230px/);
  });

  // 3. Mobile main content width remains readable
  test('3. Mobile main content width remains readable: rightMainViewport and completeness panel expand to 100% on mobile', () => {
    expect(cssContent).toContain('.rightMainViewport');
    expect(cssContent).toMatch(/\.rightMainViewport\s*\{[^}]*width:\s*100%\s*!important/);
    expect(cssContent).toMatch(/\.leftCompletenessPanel\s*\{[^}]*width:\s*100%\s*!important/);
  });

  // 4. Responsive grid stacks
  test('4. Responsive grid stacks: Cost Item Row and nested forms use xs={24} for clean mobile stacking', () => {
    // Primary cost row inputs
    expect(tsxContent).toContain('<Col xs={24} sm={8}>');
    expect(tsxContent).toContain('<Col xs={10} sm={3}>');
    expect(tsxContent).toContain('<Col xs={14} sm={3}>');
    expect(tsxContent).toContain('<Col xs={24} sm={4}>');
    expect(tsxContent).toContain('<Col xs={14} sm={3} style={{ textAlign: \'right\' }}>');

    // Expanded detail rows
    expect(tsxContent).toContain('<Col xs={24} sm={10}>');
    expect(tsxContent).toContain('<Col xs={24} sm={6}>');

    // Initial Condition
    expect(tsxContent).toContain('<Col xs={24} sm={12}>');
  });

  // 5. Footer actions remain visible and wrap cleanly on mobile
  test('5. Footer actions remain visible: modalFooterContainer and footerRightButtons wrap/stack cleanly', () => {
    expect(tsxContent).toContain('className={styles.modalFooterContainer}');
    expect(tsxContent).toContain('className={styles.footerRightButtons}');
    expect(tsxContent).toContain('className={styles.footerDraftBtn}');
    expect(tsxContent).toContain('className={styles.footerSubmitBtn}');
    expect(tsxContent).toContain('className={styles.footerSubRow}');

    expect(cssContent).toMatch(/\.modalFooterContainer\s*\{[^}]*flex-direction:\s*column-reverse\s*!important/);
    expect(cssContent).toMatch(/\.footerRightButtons\s*\{[^}]*flex-direction:\s*column\s*!important/);
  });

  // 6. No business actions removed
  test('6. No business actions removed: Tutup, Tinjau Ringkasan, Simpan Draft, and Ajukan Review all preserved', () => {
    expect(tsxContent).toContain('Tutup');
    expect(tsxContent).toContain('Tinjau Ringkasan');
    expect(tsxContent).toContain('Simpan Draft');
    expect(tsxContent).toContain('Ajukan untuk Management Review');
    expect(tsxContent).toContain('Ajukan Ulang ke Management Review');
  });

  // 7. Desktop layout preserved
  test('7. Desktop layout preserved: desktop modal width and footer inline alignment intact', () => {
    expect(tsxContent).toContain('width="min(1280px, 92vw)"');
    expect(tsxContent).toContain('maxWidth: \'1280px\'');
    expect(cssContent).toMatch(/\.footerRightButtons\s*\{[^}]*display:\s*flex;\s*align-items:\s*center;\s*gap:\s*8px;/);
    expect(cssContent).toMatch(/\.footerSubRow\s*\{[^}]*display:\s*flex;\s*align-items:\s*center;\s*gap:\s*8px;/);
  });

  // 8. Kelengkapan 2x2 grid navigation on mobile
  test('8. Kelengkapan 2x2 grid navigation: completenessSteps uses 2 columns on mobile and controls active section', () => {
    expect(cssContent).toMatch(/\.completenessSteps\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important/);
    expect(tsxContent).toContain('handleSelectSection(\'cost\')');
    expect(tsxContent).toContain('handleSelectSection(\'wbs\')');
    expect(tsxContent).toContain('handleSelectSection(\'schedule\')');
    expect(tsxContent).toContain('handleSelectSection(\'initialCondition\')');
    expect(tsxContent).toContain('styles.completenessCardActive');
  });

  // 9. Mobile working area shows only selected section
  test('9. Mobile working area: sectionItem is hidden by default and sectionItemActive is displayed on mobile', () => {
    expect(cssContent).toMatch(/\.sectionItem\s*\{[^}]*display:\s*none\s*!important/);
    expect(cssContent).toMatch(/\.sectionItemActive\s*\{[^}]*display:\s*block\s*!important/);
    expect(tsxContent).toContain('${styles.sectionItem} ${mobileActiveSection === \'cost\' ? styles.sectionItemActive : \'\'}');
    expect(tsxContent).toContain('${styles.sectionItem} ${mobileActiveSection === \'wbs\' ? styles.sectionItemActive : \'\'}');
    expect(tsxContent).toContain('${styles.sectionItem} ${mobileActiveSection === \'schedule\' ? styles.sectionItemActive : \'\'}');
    expect(tsxContent).toContain('${styles.sectionItem} ${mobileActiveSection === \'initialCondition\' ? styles.sectionItemActive : \'\'}');
  });

  // 10. Compact Mobile Workflow Governance
  test('10. Mobile Workflow: compact header card with toggle for full stepper', () => {
    expect(tsxContent).toContain('className={styles.mobileWorkflowHeader}');
    expect(tsxContent).toContain('Status Workflow');
    expect(tsxContent).toContain('Lihat Alur Persetujuan ▼');
    expect(tsxContent).toContain('className={`${styles.workflowStepperWrapper} ${isMobileWorkflowExpanded ? styles.workflowExpanded : \'\'}`}');
    expect(cssContent).toContain('.mobileWorkflowHeader');
    expect(cssContent).toContain('.workflowStepperWrapper');
  });

  // 11. Project info layout contract
  test('11. Project info: Nama Proyek and Customer & Kontrak use xs={24} on mobile', () => {
    expect(tsxContent).toContain('<Col xs={24} sm={6} md={5}>\n              <Text type="secondary" style={{ fontSize: 10, textTransform: \'uppercase\', letterSpacing: 0.5, display: \'block\' }}>\n                Nama Proyek');
    expect(tsxContent).toContain('<Col xs={24} sm={6} md={5}>\n              <Text type="secondary" style={{ fontSize: 10, textTransform: \'uppercase\', letterSpacing: 0.5, display: \'block\' }}>\n                Customer & Kontrak');
  });
});
