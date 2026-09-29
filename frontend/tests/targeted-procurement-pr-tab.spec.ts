import { test, expect } from '@playwright/test';
import { loginViaUi, activatePurchaseRequestTab, findTableRowByTextWithPagination } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const HISTORICAL_PR = 'PR-20260928-005';

test.describe('R9.1B-HARNESS-FIX-10: Procurement Purchase Request Tab Determinism Harness', () => {
  test('Read-only verification of deterministic Purchase Request tab activation for Finance actor', async ({ page }) => {
    console.log('\n--- [TEST ACTOR: FINANCE] ---');
    // 1. Login as Finance
    await loginViaUi(page, BASE_URL, 'finance@epms.com');

    // 2. Navigate to /procurement
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });

    // 3. Prove default tab may be Paket Pengadaan
    const pkgTab = page.getByRole('tab', { name: /Paket Pengadaan/i });
    if (await pkgTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      const pkgSelected = await pkgTab.getAttribute('aria-selected');
      console.log(`[HARNESS CHECK] Default tab "Paket Pengadaan" aria-selected = "${pkgSelected}"`);
    }

    // 4. Activate Purchase Request tab deterministically
    await activatePurchaseRequestTab(page);

    // 5. Scope exact historical PR row (PR-20260928-005) across pagination
    console.log(`[HARNESS CHECK] Locating PR row for "${HISTORICAL_PR}"...`);
    const prRow = await findTableRowByTextWithPagination(page, HISTORICAL_PR);
    console.log(`[HARNESS CHECK] Row for "${HISTORICAL_PR}" is unique and visible.`);

    // 6. Assert status tag
    const statusTag = prRow.locator('.ant-tag');
    await expect(statusTag).toBeVisible({ timeout: 10000 });
    const tagText = (await statusTag.innerText()).trim();
    console.log(`[HARNESS CHECK] PR status tag = "${tagText}"`);
    expect(tagText).toBe('Menunggu Review Finance');

    // 7. Verify Alur Approval button exists and is enabled (WITHOUT clicking)
    const alurBtn = prRow.locator('button:has-text("Alur Approval")');
    await expect(alurBtn).toHaveCount(1);
    await expect(alurBtn).toBeVisible({ timeout: 10000 });
    await expect(alurBtn).toBeEnabled({ timeout: 5000 });
    console.log('[HARNESS CHECK] "Alur Approval" button visible and enabled. ZERO mutations performed.');
  });

  test('Read-only verification of deterministic Purchase Request tab activation for Procurement actor', async ({ page }) => {
    console.log('\n--- [TEST ACTOR: PROCUREMENT] ---');
    // 1. Login as Purchasing
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com');

    // 2. Navigate to /procurement if needed
    if (!page.url().includes('/procurement')) {
      await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
    }

    // 3. Activate Purchase Request tab deterministically
    await activatePurchaseRequestTab(page);

    // 4. Scope exact historical PR row (PR-20260928-005) across pagination
    const prRow = await findTableRowByTextWithPagination(page, HISTORICAL_PR);
    console.log(`[HARNESS CHECK] Procurement actor sees unique row for "${HISTORICAL_PR}".`);
  });

  test('Read-only verification of deterministic Purchase Request tab activation for Director actor', async ({ page }) => {
    console.log('\n--- [TEST ACTOR: DIRECTOR] ---');
    // 1. Login as Director
    await loginViaUi(page, BASE_URL, 'director@epms.com');

    // 2. Navigate to /procurement
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });

    // 3. Activate Purchase Request tab deterministically
    await activatePurchaseRequestTab(page);

    // 4. Scope exact historical PR row (PR-20260928-005) across pagination
    const prRow = await findTableRowByTextWithPagination(page, HISTORICAL_PR);
    console.log(`[HARNESS CHECK] Director actor sees unique row for "${HISTORICAL_PR}".`);
  });
});
