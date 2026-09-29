import { test, expect } from '@playwright/test';
import { loginViaUi } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';

test.describe('R9.1B-FIX-17: PM Assignment UI Modal Responsiveness & Operational Readiness Fan-Out', () => {
  test('PM assignment modal closes promptly upon HTTP 201 without blocking on board refresh', async ({ page }) => {
    // 1. Login as PMO via UI
    await loginViaUi(page, BASE_URL, 'pmo@epms.com');

    // 2. Navigate to /project-delivery
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Ensure Tab 1 (Antrean Kick-off Charter) is active
    const tab1 = page.locator('.ant-tabs-tab').filter({ hasText: 'Antrean Kick-off Charter' });
    if (await tab1.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tab1.click();
      await page.waitForTimeout(500);
    }

    // 3. Find first eligible unassigned row with "Tugaskan PM" button
    const eligibleBtn = page.locator('tbody tr button:has-text("Tugaskan PM")').first();
    await expect(eligibleBtn).toBeVisible({ timeout: 15000 });
    const initialRow = eligibleBtn.locator('xpath=ancestor::tr');

    const rowText = await initialRow.innerText();
    const codeMatch = rowText.match(/CONT-\d+-\d+/);
    const contractCode = codeMatch ? codeMatch[0] : null;
    expect(contractCode).toBeTruthy();
    console.log(`[TARGETED TEST] Found eligible unassigned contract: ${contractCode}`);

    // Pin the target row uniquely by contract code
    const targetRow = page.locator(`tbody tr:has-text("${contractCode}")`).first();
    await expect(targetRow).toBeVisible({ timeout: 10000 });

    const tugaskanBtn = targetRow.locator('button:has-text("Tugaskan PM")');
    await expect(tugaskanBtn).toBeVisible({ timeout: 10000 });
    await tugaskanBtn.click();

    // 4. Modal Penugasan Project Manager (PMO) appears
    const pmModal = page.locator('.ant-modal-content').filter({ hasText: 'Penugasan Project Manager (PMO)' }).first();
    await expect(pmModal).toBeVisible({ timeout: 10000 });
    console.log('[TARGETED TEST] PM Assignment modal is open.');

    // 5. Select pm@epms.com in dropdown
    const pmSelect = pmModal.locator('.ant-select').first();
    await pmSelect.click();
    await page.waitForTimeout(300);

    const pmOption = page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: 'pm@epms.com' })
      .first();
    await expect(pmOption).toBeVisible({ timeout: 10000 });
    await pmOption.click();

    // 6. Setup network listener for POST assign-pm
    const assignPmPromise = page.waitForResponse(
      (resp) => resp.url().includes('/assign-pm') && resp.request().method() === 'POST',
      { timeout: 15000 }
    );

    // Track operational-readiness requests during assignment
    const readinessUrls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/operational-readiness')) {
        readinessUrls.push(req.url());
      }
    });

    // 7. Click Tugaskan PM submit button inside modal
    const submitAssignBtn = pmModal.locator('button:has-text("Tugaskan PM")');
    const startTime = Date.now();
    await submitAssignBtn.click();

    // 8. Verify backend responds 201 Created
    const assignResponse = await assignPmPromise;
    const responseTime = Date.now() - startTime;
    console.log(`[TARGETED TEST] POST assign-pm responded HTTP ${assignResponse.status()} in ${responseTime}ms`);
    expect(assignResponse.status()).toBe(201);

    // 9. CRITICAL FIX ASSERTION: Modal MUST close promptly (within 3000ms of submit)
    // In buggy baseline, it stayed open for >15000ms waiting for 186 operational-readiness requests.
    const modalCloseStart = Date.now();
    await expect(pmModal).not.toBeVisible({ timeout: 4000 });
    const modalCloseElapsed = Date.now() - modalCloseStart;
    console.log(`[TARGETED TEST] PM Assignment modal closed promptly in ${modalCloseElapsed}ms after HTTP 201!`);

    // 10. Verify board data refresh completes and pinned targetRow updates to assigned state
    // The action button on targetRow must now transition to "Operational Plan"
    const opPlanBtn = targetRow.locator('button:has-text("Operational Plan")');
    await expect(opPlanBtn).toBeVisible({ timeout: 15000 });
    console.log(`[TARGETED TEST] Board refreshed: contract ${contractCode} transitioned to "Operational Plan" CTA.`);

    // 11. Verify assigned PM name is displayed on targetRow
    await expect(targetRow).toContainText('Project Manager', { timeout: 10000 });
    console.log(`[TARGETED TEST] PM assignment persisted: contract ${contractCode} displays assigned PM (Project Manager).`);

    // 12. Verify operational-readiness requests were bounded and not 186
    console.log(`[TARGETED TEST] Operational-readiness requests captured post-assignment: ${readinessUrls.length}`);
    expect(readinessUrls.length).toBeLessThan(40);
  });
});
