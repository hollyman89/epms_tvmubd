import { test, expect } from '@playwright/test';
import { loginViaUi, activatePurchaseRequestTab, findTableRowByTextWithPagination } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const HISTORICAL_PR = 'PR-20260928-009';
const HISTORICAL_RFQ = 'RFQ-20260928-006';
const EXPECTED_WINNER = 'PT IT Solusi Bersama';

test.describe('R9.1B-HARNESS-FIX-15: Targeted PO Modal & Payment Terms Contract Probe', () => {
  test('Read-only probe of PO modal, payment terms structure, and preset / custom activation', async ({ page }) => {
    // 1. Login as Purchasing
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com');

    // 2. Navigate to Procurement and activate Purchase Request tab
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
    await activatePurchaseRequestTab(page);

    // 3. Locate exact PR row for PR-20260928-009 across pagination
    console.log(`[PO PROBE] Locating PR row for "${HISTORICAL_PR}"...`);
    const prRow = await findTableRowByTextWithPagination(page, HISTORICAL_PR);
    console.log('[PO PROBE] PR row is unique and visible.');

    // 4. Assert RFQ tag, EVALUATED status, and winner in PR row
    await expect(prRow.locator(`.ant-tag:has-text("${HISTORICAL_RFQ}")`)).toBeVisible({ timeout: 10000 });
    await expect(prRow.locator('.ant-tag:has-text("EVALUATED")')).toBeVisible({ timeout: 10000 });
    await expect(prRow.getByText(EXPECTED_WINNER)).toBeVisible({ timeout: 10000 });
    console.log('[PO PROBE] PR row projections verified.');

    // 5. Open RFQ Workspace
    const lihatRfqBtn = prRow.locator('button:has-text("Lihat RFQ")');
    await lihatRfqBtn.click();
    const rfqModal = page.locator('.ant-modal-content').filter({ hasText: HISTORICAL_RFQ }).first();
    await expect(rfqModal).toBeVisible({ timeout: 15000 });
    console.log('[PO PROBE] RFQ modal opened.');

    // 6. Click "Lihat Hasil Evaluasi" to open comparison modal
    const viewEvaluationBtn = rfqModal.locator('button:has-text("Lihat Hasil Evaluasi")');
    await expect(viewEvaluationBtn).toBeVisible({ timeout: 10000 });
    await viewEvaluationBtn.click();
    const comparisonModal = page.locator('.ant-modal-content').filter({ hasText: 'Evaluasi & Perbandingan Vendor' }).first();
    await expect(comparisonModal).toBeVisible({ timeout: 15000 });
    console.log('[PO PROBE] Evaluated comparison modal opened.');

    // 7. Click "Buat Purchase Order (PO)"
    const buatPoBtn = comparisonModal.locator('button:has-text("Buat Purchase Order (PO)")');
    await expect(buatPoBtn).toHaveCount(1);
    await expect(buatPoBtn).toBeVisible({ timeout: 10000 });
    await expect(buatPoBtn).toBeEnabled({ timeout: 10000 });
    await buatPoBtn.click();
    console.log('[PO PROBE] Clicked "Buat Purchase Order (PO)".');

    // 8. Assert PO Modal is opened
    const poModal = page
      .locator('.ant-modal-content')
      .filter({ hasText: 'Penerbitan Purchase Order (PO) ke Vendor Pemenang' })
      .first();
    await expect(poModal).toBeVisible({ timeout: 15000 });
    console.log('[PO PROBE] PO modal successfully opened.');

    // 9. Inspect PO reference context
    await expect(poModal.getByText('CANONICAL-E2E-1790606055877')).toBeVisible({ timeout: 10000 });
    await expect(poModal.getByText('#1377')).toBeVisible({ timeout: 10000 });
    await expect(poModal.getByText(HISTORICAL_PR)).toBeVisible({ timeout: 10000 });
    await expect(poModal.getByText(HISTORICAL_RFQ)).toBeVisible({ timeout: 10000 });
    await expect(poModal.getByText(EXPECTED_WINNER).first()).toBeVisible({ timeout: 10000 });
    console.log('[PO PROBE] PO context and winner linkage verified.');

    // 10. Probe Payment Terms section controls
    const presetA = poModal.locator('button:has-text("Preset A (30/30/30/10)")');
    const presetB = poModal.locator('button:has-text("Preset B (20/40/30/10)")');
    const presetC = poModal.locator('button:has-text("Preset C (100%)")');
    const addTermBtn = poModal.locator('button:has-text("+ Tambah Termin")');

    await expect(presetA).toBeVisible({ timeout: 5000 });
    await expect(presetB).toBeVisible({ timeout: 5000 });
    await expect(presetC).toBeVisible({ timeout: 5000 });
    await expect(addTermBtn).toBeVisible({ timeout: 5000 });
    console.log('[PO PROBE] Preset buttons (A, B, C) and "+ Tambah Termin" button are visible.');

    // Check initial data rows count (filtering out Ant Design's virtual scroll measure row)
    const initialRows = poModal.locator('.term-table-stable .ant-table-tbody tr.ant-table-row');
    const initialRowCount = await initialRows.count();
    console.log(`[PO PROBE] Initial payment terms data row count: ${initialRowCount}`);
    expect(initialRowCount).toBe(1);

    // Check submit button initial state
    const submitPoBtn = poModal.locator('button:has-text("Terbitkan Purchase Order (PO)")');
    await expect(submitPoBtn).toBeVisible({ timeout: 5000 });
    const isInitiallyDisabled = await submitPoBtn.isDisabled();
    console.log(`[PO PROBE] Submit button initially disabled: ${isInitiallyDisabled}`);
    expect(isInitiallyDisabled).toBe(true);

    // 11. Test Preset A activation
    console.log('[PO PROBE] Testing Preset A (30/30/30/10) activation...');
    await presetA.click();
    await page.waitForTimeout(500);

    const rowsAfterPresetA = poModal.locator('.term-table-stable .ant-table-tbody tr.ant-table-row');
    const rowCountPresetA = await rowsAfterPresetA.count();
    console.log(`[PO PROBE] Row count after Preset A: ${rowCountPresetA}`);
    expect(rowCountPresetA).toBe(4);

    const validBannerA = poModal.getByText(/Total Termin: 100(\.00)?% — Valid/).first();
    await expect(validBannerA).toBeVisible({ timeout: 5000 });
    console.log('[PO PROBE] Valid banner confirmed for Preset A: "Total Termin: 100.00% — Valid".');

    const isEnabledAfterPresetA = await submitPoBtn.isEnabled();
    console.log(`[PO PROBE] Submit button enabled after Preset A: ${isEnabledAfterPresetA}`);
    expect(isEnabledAfterPresetA).toBe(true);

    // 12. Close modal cleanly without submitting (READ-ONLY)
    console.log('[PO PROBE] Closing PO modal without submission (READ-ONLY)...');
    const closeBtn = poModal.locator('button:has-text("Batal")').first();
    await closeBtn.click();
    await expect(poModal).not.toBeVisible({ timeout: 10000 });
    console.log('[PO PROBE] Read-only probe completed cleanly. ZERO mutations.');
  });
});
