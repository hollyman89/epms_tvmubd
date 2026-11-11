import fs from 'fs';
import path from 'path';

describe('PM Procurement Package Modal Mobile Responsive Contracts (Service & Material)', () => {
  const modalTsxPath = path.resolve(__dirname, '../PmProcurementPackageModal.tsx');
  const modalCssPath = path.resolve(__dirname, '../PmProcurementPackageModal.module.css');

  let modalTsx: string;
  let modalCss: string;

  beforeAll(() => {
    modalTsx = fs.readFileSync(modalTsxPath, 'utf8');
    modalCss = fs.readFileSync(modalCssPath, 'utf8');
  });

  test('1. Modal and Header: viewport-aware bounds, accessible close button clearance, and responsive title/contract badge hierarchy', () => {
    expect(modalTsx).toContain('className={styles.modalRoot}');
    expect(modalTsx).toContain('width="min(1200px, 95vw)"');
    expect(modalTsx).toContain('data-testid="procurement-package-modal-header"');
    expect(modalTsx).toContain('data-testid="procurement-package-modal-title"');
    expect(modalTsx).toContain('data-testid="procurement-package-contract-badge"');

    // Mobile viewport width with consistent side margins & scrollable body
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?width:\s*calc\(100vw\s*-\s*16px\)\s*!important/);
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?max-height:\s*calc\(100dvh\s*-\s*16px\)\s*!important/);
    expect(modalCss).toMatch(/\.modalRoot\s*:global\(\.ant-modal-body\)\s*\{[^}]*overflow-y:\s*auto/);
    expect(modalCss).toMatch(/\.modalRoot\s*:global\(\.ant-modal-header\)\s*\{[^}]*padding-right:\s*32px/);

    // Title and contract code badge stack cleanly on mobile
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.modalHeaderTitleRow\s*\{[\s\S]*?flex-direction:\s*column/);
  });

  test('2. Description & Primary Action: full-width description section separated from dedicated primary action row', () => {
    expect(modalTsx).toContain('className={styles.listToolbarSection}');
    expect(modalTsx).toContain('className={styles.descriptionSection}');
    expect(modalTsx).toContain('className={styles.primaryActionRow}');
    expect(modalTsx).toContain('className={styles.primaryCreateBtn}');
    expect(modalTsx).toContain('onClick={handleOpenCreateForm}');
    expect(modalTsx).toContain("isServiceMode ? 'Buat Pengadaan Jasa Baru' : 'Buat Paket Pengadaan Baru'");

    // Stacks vertically on mobile with 100% width button
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.listToolbarSection\s*\{[\s\S]*?flex-direction:\s*column/);
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.descriptionSection\s*\{[\s\S]*?width:\s*100%/);
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.primaryCreateBtn\s*\{[\s\S]*?width:\s*100%\s*!important/);
  });

  test('3. Package List: retains desktop Table on >768px and switches to responsive package cards on <=768px', () => {
    expect(modalTsx).toContain('className={styles.desktopTableWrapper}');
    expect(modalTsx).toContain('className={styles.mobileCardsWrapper}');
    expect(modalTsx).toContain('className={styles.mobilePackageCard}');

    // Desktop wrapper visible on desktop, hidden on mobile; mobile cards hidden on desktop, flex column on mobile
    expect(modalCss).toMatch(/\.desktopTableWrapper\s*\{[^}]*display:\s*block/);
    expect(modalCss).toMatch(/\.mobileCardsWrapper\s*\{[^}]*display:\s*none/);
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.desktopTableWrapper\s*\{[\s\S]*?display:\s*none\s*!important/);
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.mobileCardsWrapper\s*\{[\s\S]*?display:\s*flex/);
  });

  test('4. Mobile Package Card Fields & Shared Action Helper: displays all canonical fields without duplicating business logic', () => {
    // Card labels matching existing column semantics
    expect(modalTsx).toContain('Nama / Keterangan Paket');
    expect(modalTsx).toContain('Kebutuhan / Spesifikasi');
    expect(modalTsx).toContain('Item');
    expect(modalTsx).toContain('Total Estimasi');

    // Both desktop table and mobile cards invoke the shared renderPackageActions(r) and renderEmptyPackageList() helpers
    const actionHelperCalls = modalTsx.match(/renderPackageActions\(r\)/g) || [];
    expect(actionHelperCalls.length).toBe(2);

    const emptyHelperCalls = modalTsx.match(/renderEmptyPackageList\(\)/g) || [];
    expect(emptyHelperCalls.length).toBe(2);
  });

  test('5. Desktop Table & Business Handlers Intact: all columns and lifecycle handlers preserved', () => {
    expect(modalTsx).toContain("title: 'Nomor Paket'");
    expect(modalTsx).toContain("title: 'Status'");
    expect(modalTsx).toContain("title: 'Tgl Dibutuhkan'");
    expect(modalTsx).toContain("title: 'Item'");
    expect(modalTsx).toContain("title: 'Total Estimasi'");
    expect(modalTsx).toContain("title: 'Aksi'");

    expect(modalTsx).toContain('handleOpenCreateForm');
    expect(modalTsx).toContain('handleOpenEditForm');
    expect(modalTsx).toContain('handleSavePackage');
    expect(modalTsx).toContain('handleSubmitPackage');
    expect(modalTsx).toContain('handleResubmitPackage');
    expect(modalTsx).toContain('handleDeleteDraft');
    expect(modalTsx).toContain('handleCancelPackage');
  });
});

