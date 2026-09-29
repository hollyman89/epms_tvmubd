import { test, expect } from '@playwright/test';
import { loginViaUi, activatePurchaseRequestTab, findTableRowByTextWithPagination } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const HISTORICAL_PR = 'PR-20260928-008';
const HISTORICAL_RFQ = 'RFQ-20260928-005';
const EXPECTED_WINNER = 'PT IT Solusi Bersama';

test.describe('R9.1B-HARNESS-FIX-14: Targeted Vendor Evaluation Finalization Modal Lifecycle', () => {
  test('Read-only verification of RFQ EVALUATED projection, Lihat Hasil Evaluasi, and Buat PO action', async ({ page }) => {
    // 1. Login as Purchasing
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com');

    // 2. Navigate to Procurement and activate Purchase Request tab
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
    await activatePurchaseRequestTab(page);

    // 3. Locate exact PR row for PR-20260928-008 across pagination
    console.log(`[HARNESS CHECK] Locating PR row for "${HISTORICAL_PR}"...`);
    const prRow = await findTableRowByTextWithPagination(page, HISTORICAL_PR);
    console.log('[HARNESS CHECK] PR row is unique and visible.');

    // 4. Assert RFQ tag, EVALUATED status, and winner in PR row
    const rfqTag = prRow.locator(`.ant-tag:has-text("${HISTORICAL_RFQ}")`);
    await expect(rfqTag).toBeVisible({ timeout: 10000 });
    console.log(`[HARNESS CHECK] RFQ tag "${HISTORICAL_RFQ}" is visible in PR row.`);

    const rfqStatusTag = prRow.locator('.ant-tag:has-text("EVALUATED")');
    await expect(rfqStatusTag).toBeVisible({ timeout: 10000 });
    console.log('[HARNESS CHECK] Status tag "EVALUATED" is visible in PR row.');

    await expect(prRow.getByText(EXPECTED_WINNER)).toBeVisible({ timeout: 10000 });
    console.log(`[HARNESS CHECK] Winner "${EXPECTED_WINNER}" is visible in PR row.`);

    // 5. Assert "Lihat RFQ" button is unique, visible, and enabled
    const lihatRfqBtn = prRow.locator('button:has-text("Lihat RFQ")');
    await expect(lihatRfqBtn).toHaveCount(1);
    await expect(lihatRfqBtn).toBeVisible({ timeout: 10000 });
    await expect(lihatRfqBtn).toBeEnabled({ timeout: 10000 });
    console.log('[HARNESS CHECK] "Lihat RFQ" button is unique, visible, and enabled.');

    // 6. Click "Lihat RFQ"
    console.log('[HARNESS CHECK] Clicking "Lihat RFQ"...');
    await lihatRfqBtn.click();

    // 7. Assert parent RFQ workspace modal opens
    const rfqModal = page.locator('.ant-modal-content').filter({ hasText: HISTORICAL_RFQ }).first();
    await expect(rfqModal).toBeVisible({ timeout: 15000 });
    console.log(`[HARNESS CHECK] Parent RFQ workspace modal successfully opened for "${HISTORICAL_RFQ}".`);

    // 8. Assert EVALUATED status and Winner projection inside parent RFQ workspace
    const evaluatedStatusTag = rfqModal.locator('.ant-tag').filter({ hasText: 'EVALUATED' }).first();
    await expect(evaluatedStatusTag).toBeVisible({ timeout: 10000 });

    const winnerTag = rfqModal.locator('.ant-tag').filter({ hasText: new RegExp(`EVALUATED — Pemenang:.*${EXPECTED_WINNER}`) }).first();
    await expect(winnerTag).toBeVisible({ timeout: 10000 });
    console.log(`[HARNESS CHECK] RFQ modal reflects status EVALUATED with winner "${EXPECTED_WINNER}".`);

    // 9. Assert "Lihat Hasil Evaluasi" button is unique, visible, and enabled
    const viewEvaluationBtn = rfqModal.locator('button:has-text("Lihat Hasil Evaluasi")');
    await expect(viewEvaluationBtn).toHaveCount(1);
    await expect(viewEvaluationBtn).toBeVisible({ timeout: 10000 });
    await expect(viewEvaluationBtn).toBeEnabled({ timeout: 10000 });
    console.log('[HARNESS CHECK] "Lihat Hasil Evaluasi" button is unique, visible, and enabled.');

    // 10. Click "Lihat Hasil Evaluasi"
    console.log('[HARNESS CHECK] Clicking "Lihat Hasil Evaluasi"...');
    await viewEvaluationBtn.click();

    // 11. Assert evaluated comparison modal opens
    const comparisonModal = page.locator('.ant-modal-content').filter({ hasText: 'Evaluasi & Perbandingan Vendor' }).first();
    await expect(comparisonModal).toBeVisible({ timeout: 15000 });
    console.log('[HARNESS CHECK] Evaluated comparison modal successfully opened.');

    // 12. Assert evaluation terminal banner and winner inside comparison modal
    const evaluatedBanner = comparisonModal.locator('.ant-alert-success').filter({ hasText: 'Vendor Comparison Selesai' });
    await expect(evaluatedBanner).toBeVisible({ timeout: 10000 });
    await expect(comparisonModal.getByText(EXPECTED_WINNER).first()).toBeVisible({ timeout: 10000 });
    console.log('[HARNESS CHECK] "Vendor Comparison Selesai" banner and winner verified.');

    // 13. Assert "Buat Purchase Order (PO)" action contract
    const buatPoBtn = comparisonModal.locator('button:has-text("Buat Purchase Order (PO)")');
    await expect(buatPoBtn).toHaveCount(1);
    await expect(buatPoBtn).toBeVisible({ timeout: 10000 });
    await expect(buatPoBtn).toBeEnabled({ timeout: 10000 });
    console.log('[HARNESS CHECK] "Buat Purchase Order (PO)" is unique, visible, and enabled (NOT clicked in read-only test).');

    // 14. Clean close of modals without mutation
    const closeComparisonBtn = comparisonModal.locator('button:has-text("Tutup")').first();
    if (await closeComparisonBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeComparisonBtn.click();
      await expect(comparisonModal).not.toBeVisible({ timeout: 10000 });
    }

    const closeRfqBtn = rfqModal.locator('button:has-text("Tutup")').or(rfqModal.locator('.ant-modal-close')).first();
    if (await closeRfqBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeRfqBtn.click();
      await expect(rfqModal).not.toBeVisible({ timeout: 10000 });
    }

    console.log('[HARNESS CHECK] Read-only verification completed cleanly. ZERO mutations.');
  });
});
