import { test, expect } from '@playwright/test';
import { loginViaUi, activatePurchaseRequestTab, findTableRowByTextWithPagination } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const HISTORICAL_PR_NUMBER = 'PR-20260928-003';

test.describe('R9.1B-HARNESS-FIX-06: Targeted PR Terminal Status UI Contract', () => {
  test('Verify PR row uniqueness, exact UI presentation status label PR Disetujui, Buat RFQ eligibility, and runtime contracts on PR-20260928-003', async ({ page }) => {
    // 1. Login as Purchasing Officer
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com');

    // 2. Ensure /procurement is loaded
    if (!page.url().includes('/procurement')) {
      await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
    }

    // 3. Switch to Purchase Request tab deterministically
    await activatePurchaseRequestTab(page);
    const prCard = page.locator('.ant-card').filter({ hasText: 'Daftar Purchase Request' });
    await expect(prCard).toBeVisible({ timeout: 15000 });

    // 4. Locate exact PR row by historical PR number across pagination
    console.log(`[HARNESS CHECK] Locating row for "${HISTORICAL_PR_NUMBER}"...`);
    const prRow = await findTableRowByTextWithPagination(page, HISTORICAL_PR_NUMBER, { containerLocator: prCard });
    console.log('[HARNESS CHECK] Row count is exactly 1 and visible.');

    // 5. Locate exact status tag within that unique row
    const statusTag = prRow.locator('.ant-tag');
    console.log('[HARNESS CHECK] Locating status tag within PR row...');
    await expect(statusTag).toHaveCount(1);
    await expect(statusTag).toBeVisible({ timeout: 10000 });

    // 6. Assert exact UI presentation label is "PR Disetujui"
    const tagText = (await statusTag.innerText()).trim();
    console.log(`[HARNESS CHECK] Rendered status tag text: "${tagText}"`);
    expect(tagText).toBe('PR Disetujui');
    console.log('[HARNESS CHECK] Exact UI status label "PR Disetujui" verified successfully!');

    // 7. Verify Buat RFQ button is visible and enabled
    const buatRfqBtn = prRow.locator('button:has-text("Buat RFQ")');
    await expect(buatRfqBtn).toHaveCount(1);
    await expect(buatRfqBtn).toBeVisible({ timeout: 10000 });
    await expect(buatRfqBtn).toBeEnabled({ timeout: 5000 });
    console.log('[HARNESS CHECK] Buat RFQ button is visible and enabled.');

    // 8. Verify Backend / API status independently
    const apiPrData = await page.evaluate(async (num) => {
      const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:4000/api/v1/procurement/pr', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const json = await res.json();
      const list = json.data?.data || json.data || json;
      const item = Array.isArray(list) ? list.find((p: any) => p.prNumber === num) : null;
      return item ? { id: item.id, prNumber: item.prNumber, status: item.status } : null;
    }, HISTORICAL_PR_NUMBER);

    console.log('[HARNESS CHECK] Backend API PR data:', JSON.stringify(apiPrData));
    expect(apiPrData).not.toBeNull();
    expect(apiPrData?.status).toBe('APPROVED');
    console.log(`[HARNESS CHECK] Backend PR status = "${apiPrData?.status}" verified.`);

    // 9. Verify Workflow Runtime State via API
    const wfState = await page.evaluate(async (prId) => {
      const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken');
      const res = await fetch(`http://localhost:4000/api/v1/workflow/instances/entity/PURCHASE_REQUEST/${prId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return { ok: false, status: res.status };
      const json = await res.json();
      const inst = json.data?.id ? json.data : (json.data?.data || json);
      return {
        ok: true,
        status: inst.status,
        currentNodeId: inst.currentNodeId,
        workflowKey: inst.workflowDefinition?.workflowKey
      };
    }, apiPrData!.id);

    console.log('[HARNESS CHECK] Workflow instance state:', JSON.stringify(wfState));
    expect(wfState.ok).toBe(true);
    expect(wfState.status).toBe('COMPLETED');
    expect(wfState.currentNodeId).toBe('node_end');
    console.log('[HARNESS CHECK] Workflow COMPLETED at node_end verified.');

    // 10. Non-mutating verification: NO click on Buat RFQ, NO mutations performed
    console.log('[HARNESS CHECK] Verification complete with ZERO mutations.');
  });
});
