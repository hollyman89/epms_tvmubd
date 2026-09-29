import { test, expect } from '@playwright/test';
import { loginViaUi, activateProjectDeliveryTab2 } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const HISTORICAL_TENDER_NAME = 'CANONICAL-E2E-1790575541012';

test.describe('R9.1B-HARNESS-FIX-02: Targeted Verification of DatePicker + Checkbox', () => {
  test('Prove complete sequence: modal open -> title -> date committed -> popup closed -> checkbox checked normally', async ({ page }) => {
    // 1. Login as PM
    await loginViaUi(page, BASE_URL, 'pm@epms.com');

    // 2. Navigate and activate Tab 2
    const activeTabPane = await activateProjectDeliveryTab2(page, BASE_URL);

    // 3. Locate historical Project 1366 row in Tab 2
    const projectRow = activeTabPane.locator(`tr:has-text("${HISTORICAL_TENDER_NAME}")`);
    await expect(projectRow).toHaveCount(1);
    await expect(projectRow).toBeVisible({ timeout: 15000 });

    // 4. Click "Paket Pengadaan" button
    const paketPengadaanBtn = projectRow.locator('button:has-text("Paket Pengadaan")');
    await expect(paketPengadaanBtn).toBeVisible({ timeout: 10000 });
    await paketPengadaanBtn.click();

    // 5. Verify modal opens
    const packageModal = page.locator('.ant-modal-content').filter({ hasText: 'Paket Pengadaan Proyek' }).first();
    await expect(packageModal).toBeVisible({ timeout: 15000 });

    // 6. Click "Buat Paket Pengadaan Baru"
    const buatPaketBtn = packageModal.locator('button:has-text("Buat Paket Pengadaan Baru")');
    await expect(buatPaketBtn).toBeVisible({ timeout: 10000 });
    await buatPaketBtn.click();

    // 7. Enter Package Title
    const titleInput = packageModal.locator('#title');
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await titleInput.click();
    await titleInput.fill('Paket Pengadaan Material Utama Konstruksi');
    await expect(titleInput).toHaveValue('Paket Pengadaan Material Utama Konstruksi');
    console.log('[HARNESS CHECK] 1. Title entered and asserted.');

    // 8. Deterministic DatePicker interaction
    const reqDateInput = packageModal.locator('#requiredDate');
    await expect(reqDateInput).toBeVisible({ timeout: 10000 });
    await reqDateInput.click();

    const activePopup = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
    await expect(activePopup).toBeVisible({ timeout: 5000 });
    console.log('[HARNESS CHECK] 2. Active DatePicker popup visible.');

    // Select today cell inside active popup
    const todayCellInner = activePopup.locator('.ant-picker-cell-today .ant-picker-cell-inner');
    await expect(todayCellInner).toBeVisible({ timeout: 5000 });
    await todayCellInner.click();

    // Assert popup closes completely
    await expect(page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')).toHaveCount(0, { timeout: 5000 });
    console.log('[HARNESS CHECK] 3. DatePicker popup closed (count = 0).');

    // Assert date value committed
    const committedVal = await reqDateInput.inputValue();
    console.log(`[HARNESS CHECK] 4. Date value committed: "${committedVal}"`);
    expect(committedVal).not.toBe('');
    expect(committedVal).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    // 9. Cost item checkbox interaction WITHOUT force: true
    console.log('[HARNESS CHECK] 5. Locating cost item row...');
    const costItemRow = packageModal.locator('.ant-table-tbody tr').filter({ hasText: 'Material Utama Konstruksi & Fabrikasi' }).first();
    await expect(costItemRow).toBeVisible({ timeout: 10000 });

    const checkboxWrapper = costItemRow.locator('.ant-checkbox-wrapper');
    await expect(checkboxWrapper).toBeVisible({ timeout: 10000 });
    await expect(checkboxWrapper).toBeEnabled({ timeout: 5000 });

    console.log('[HARNESS CHECK] 6. Clicking checkbox wrapper normally without force...');
    await checkboxWrapper.click();

    const checkboxInput = costItemRow.locator('input[type="checkbox"]');
    await expect(checkboxInput).toBeChecked({ timeout: 5000 });
    console.log('[HARNESS CHECK] 7. Cost item checkbox checked successfully without force!');

    // 10. Close cleanly via Batal (no business submission)
    const batalBtn = packageModal.locator('button:has-text("Batal")');
    await batalBtn.click();
    console.log('[HARNESS CHECK] 8. Verification complete. Zero business mutations.');
  });
});
