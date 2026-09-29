import { test, expect } from '@playwright/test';
import { loginViaUi } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const HISTORICAL_TENDER = 'CANONICAL-E2E-1790602856449';

test.describe('R9.1B-HARNESS-FIX-12: Targeted Executive GO Decision Selector Disambiguation', () => {
  test('Read-only verification of exact GO — LANJUTKAN decision tag on historical tender', async ({ page }) => {
    // 1. Login as Director
    await loginViaUi(page, BASE_URL, 'director@epms.com');

    // 2. Navigate to Sales
    await page.goto(`${BASE_URL}/sales`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // 3. Locate exact card for CANONICAL-E2E-1790602856449
    console.log(`[HARNESS CHECK] Locating card for "${HISTORICAL_TENDER}"...`);
    const execCard = page.locator('.ant-card').filter({ hasText: HISTORICAL_TENDER }).first();
    await expect(execCard).toBeVisible({ timeout: 15000 });
    console.log('[HARNESS CHECK] Executive card is visible.');

    // 4. Open Detail Proyek drawer
    await execCard.click();
    const execDrawer = page.locator('.ant-drawer-content:has-text("Detail Proyek")');
    await expect(execDrawer).toBeVisible({ timeout: 10000 });
    console.log('[HARNESS CHECK] Executive Drawer is visible.');

    // 5. Wait for drawer loading spinner to detach
    const spinner = execDrawer.locator('.ant-spin');
    if (await spinner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(spinner).not.toBeVisible({ timeout: 10000 });
    }

    // 6. Inspect all tags
    const allTags = execDrawer.locator('.ant-tag');
    const tagCount = await allTags.count();
    console.log(`[HARNESS CHECK] Total .ant-tag elements in drawer: ${tagCount}`);
    for (let i = 0; i < tagCount; i++) {
      const text = await allTags.nth(i).innerText();
      console.log(`[HARNESS CHECK] Tag #${i}: "${text}"`);
    }

    // 7. Assert exact GO decision tag (anchored: either "GO — LANJUTKAN" or "GO", strictly excluding "WAITING_GO_NO_GO")
    const goDecisionTag = execDrawer
      .locator('.ant-tag')
      .filter({ hasText: /^GO — LANJUTKAN$|^GO$/ });

    await expect(goDecisionTag).toHaveCount(1);
    await expect(goDecisionTag).toBeVisible({ timeout: 10000 });
    console.log('[HARNESS CHECK] Exact GO decision tag count is 1 and visible.');

    // 7. Close drawer cleanly without any business mutation
    const closeExecDrawerBtn = execDrawer.locator('.ant-drawer-close');
    await closeExecDrawerBtn.click();
    await expect(execDrawer).not.toBeVisible({ timeout: 10000 });
    console.log('[HARNESS CHECK] Drawer closed cleanly. ZERO mutations performed.');
  });
});
