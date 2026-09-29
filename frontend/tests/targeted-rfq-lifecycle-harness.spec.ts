import { test, expect } from '@playwright/test';
import { loginViaUi, activatePurchaseRequestTab, findTableRowByTextWithPagination } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const HISTORICAL_PR = 'PR-20260928-004';
const HISTORICAL_RFQ = 'RFQ-20260928-002';

test.describe('R9.1B-HARNESS-FIX-09: Targeted RFQ Post-Creation Modal Lifecycle Harness', () => {
  test('Read-only verification of PR row projection, Lihat RFQ action, and RFQ workspace modal', async ({ page }) => {
    // 1. Login as Purchasing
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com');

    // 2. Navigate to Procurement and activate Purchase Request tab
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
    await activatePurchaseRequestTab(page);

    // 3. Locate exact PR row for PR-20260928-004 across pagination
    console.log(`[HARNESS CHECK] Locating PR row for "${HISTORICAL_PR}"...`);
    const prRow = await findTableRowByTextWithPagination(page, HISTORICAL_PR);
    console.log('[HARNESS CHECK] PR row is unique and visible.');

    // 4. Assert RFQ number and OPEN status visible inside PR row
    const rfqTag = prRow.locator(`.ant-tag:has-text("${HISTORICAL_RFQ}")`);
    await expect(rfqTag).toBeVisible({ timeout: 10000 });
    console.log(`[HARNESS CHECK] RFQ tag "${HISTORICAL_RFQ}" is visible in PR row.`);

    const rfqStatusTag = prRow.locator('.ant-tag:has-text("OPEN")');
    await expect(rfqStatusTag).toBeVisible({ timeout: 10000 });
    console.log('[HARNESS CHECK] Status tag "OPEN" is visible in PR row.');

    // 5. Assert "Lihat RFQ" button is unique, visible, and enabled
    const lihatRfqBtn = prRow.locator('button:has-text("Lihat RFQ")');
    await expect(lihatRfqBtn).toHaveCount(1);
    await expect(lihatRfqBtn).toBeVisible({ timeout: 10000 });
    await expect(lihatRfqBtn).toBeEnabled({ timeout: 10000 });
    console.log('[HARNESS CHECK] "Lihat RFQ" button is unique, visible, and enabled.');

    // 6. Click "Lihat RFQ"
    console.log('[HARNESS CHECK] Clicking "Lihat RFQ"...');
    await lihatRfqBtn.click();

    // 7. Assert RFQ workspace modal opens with exact RFQ number
    const rfqModal = page.locator('.ant-modal-content').filter({ hasText: HISTORICAL_RFQ }).first();
    await expect(rfqModal).toBeVisible({ timeout: 15000 });
    console.log(`[HARNESS CHECK] RFQ workspace modal successfully opened for "${HISTORICAL_RFQ}".`);

    // 8. Verify quotation workspace section and controls exist
    const quoteSection = rfqModal.locator('text=/Daftar Penawaran Vendor/');
    await expect(quoteSection).toBeVisible({ timeout: 10000 });

    const quoteBtn = rfqModal.locator('button:has-text("Input Penawaran Vendor"), button:has-text("Tambah Vendor")').first();
    await expect(quoteBtn).toBeVisible({ timeout: 10000 });
    console.log('[HARNESS CHECK] Quotation workspace and vendor input controls verified.');

    // 9. Close modal without mutation
    const closeBtn = rfqModal.locator('button:has-text("Tutup")').or(rfqModal.locator('.ant-modal-close')).first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
      await expect(rfqModal).not.toBeVisible({ timeout: 10000 });
      console.log('[HARNESS CHECK] Modal closed cleanly. ZERO business mutations.');
    }
  });
});
