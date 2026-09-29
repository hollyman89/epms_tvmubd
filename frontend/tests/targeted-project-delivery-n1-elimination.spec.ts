import { test, expect } from '@playwright/test';
import { loginViaUi } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';

test.describe('R9.1B-FIX-18: Project Delivery Readiness N+1 Elimination', () => {
  test('PM Project Delivery: zero per-project operational-readiness requests and valid statuses', async ({ page }) => {
    let operationalBoardRequests = 0;
    let operationalReadinessRequests = 0;

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/project/operational-board')) {
        operationalBoardRequests++;
      }
      if (url.includes('/operational-readiness')) {
        operationalReadinessRequests++;
      }
    });

    // 1. Login as PM
    await loginViaUi(page, BASE_URL, 'pm@epms.com');

    // Reset counters after login so we isolate project-delivery navigation
    operationalBoardRequests = 0;
    operationalReadinessRequests = 0;

    // 2. Navigate to /project-delivery
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 3. Wait for operational board data to render
    const table = page.locator('.ant-table');
    await expect(table.first()).toBeVisible({ timeout: 15000 });

    // Allow any trailing async requests to settle
    await page.waitForTimeout(1500);

    console.log(`[PM TEST] Operational Board requests: ${operationalBoardRequests}`);
    console.log(`[PM TEST] Operational Readiness requests: ${operationalReadinessRequests}`);

    // 4. Assert zero per-project operational-readiness requests
    expect(operationalBoardRequests).toBeGreaterThanOrEqual(1);
    expect(operationalReadinessRequests).toBe(0);

    // 5. Verify no "STATUS TIDAK TERSEDIA" or timeout errors in table
    const unavailableTags = page.locator('.ant-table').locator('text="STATUS TIDAK TERSEDIA"');
    const unavailableCount = await unavailableTags.count();
    expect(unavailableCount).toBe(0);

    const memuatTags = page.locator('.ant-table').locator('text="○ MEMUAT STATUS..."');
    const memuatCount = await memuatTags.count();
    expect(memuatCount).toBe(0);
  });

  test('PMO Project Delivery: zero per-project operational-readiness requests and valid statuses for all queue rows', async ({ page }) => {
    let operationalBoardRequests = 0;
    let operationalReadinessRequests = 0;

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/project/operational-board')) {
        operationalBoardRequests++;
      }
      if (url.includes('/operational-readiness')) {
        operationalReadinessRequests++;
      }
    });

    // 1. Login as PMO
    await loginViaUi(page, BASE_URL, 'pmo@epms.com');

    // Reset counters after login so we isolate project-delivery navigation
    operationalBoardRequests = 0;
    operationalReadinessRequests = 0;

    // 2. Navigate to /project-delivery
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 3. Wait for table
    const table = page.locator('.ant-table');
    await expect(table.first()).toBeVisible({ timeout: 15000 });

    // Check rows count in PMO queue (which typically has dozens of contracts/projects)
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    console.log(`[PMO TEST] Rendered rows: ${rowCount}`);
    expect(rowCount).toBeGreaterThan(0);

    // Allow any trailing network activity to settle
    await page.waitForTimeout(2000);

    console.log(`[PMO TEST] Operational Board requests: ${operationalBoardRequests}`);
    console.log(`[PMO TEST] Operational Readiness requests: ${operationalReadinessRequests}`);

    // 4. Assert ZERO readiness N+1 requests
    expect(operationalBoardRequests).toBeGreaterThanOrEqual(1);
    expect(operationalReadinessRequests).toBe(0);

    // 5. Verify no "STATUS TIDAK TERSEDIA" in any row
    const unavailableTags = page.locator('.ant-table').locator('text="STATUS TIDAK TERSEDIA"');
    const unavailableCount = await unavailableTags.count();
    expect(unavailableCount).toBe(0);

    const memuatTags = page.locator('.ant-table').locator('text="○ MEMUAT STATUS..."');
    const memuatCount = await memuatTags.count();
    expect(memuatCount).toBe(0);

    // 6. Switch to Tab 2 (Proyek Berjalan / Active Projects) and assert zero readiness requests
    const tab2 = page.locator('.ant-tabs-tab').filter({ hasText: 'Proyek Berjalan' });
    if (await tab2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tab2.click();
      await page.waitForTimeout(1000);
      expect(operationalReadinessRequests).toBe(0);
    }
  });
});
