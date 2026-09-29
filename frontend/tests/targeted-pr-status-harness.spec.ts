import { test, expect } from '@playwright/test';
import { loginViaUi, activatePurchaseRequestTab, findTableRowByTextWithPagination } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const HISTORICAL_PR_NUMBER = 'PR-20260928-002';

test.describe('R9.1B-HARNESS-FIX-04: Targeted PR Status UI Contract', () => {
  test('Verify PR row uniqueness and exact UI presentation status label Menunggu Review Finance on PR-20260928-002', async ({ page }) => {
    // 1. Login as Purchasing Officer
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com');

    // 2. Navigate to /procurement
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });

    // 3. Switch to Purchase Request tab deterministically
    await activatePurchaseRequestTab(page);
    const prCard = page.locator('.ant-card').filter({ hasText: 'Daftar Purchase Request' });
    await expect(prCard).toBeVisible({ timeout: 15000 });

    // 4. Locate exact PR row by historical PR number across pagination
    console.log(`[HARNESS CHECK] Locating row for "${HISTORICAL_PR_NUMBER}"...`);
    const prRow = await findTableRowByTextWithPagination(page, HISTORICAL_PR_NUMBER, { containerLocator: prCard });
    console.log(`[HARNESS CHECK] Row count is exactly 1 and visible.`);

    // 5. Locate exact status tag within that unique row
    const statusTag = prRow.locator('.ant-tag');
    console.log('[HARNESS CHECK] Locating status tag within PR row...');
    await expect(statusTag).toHaveCount(1);
    await expect(statusTag).toBeVisible({ timeout: 10000 });

    // 6. Assert exact UI presentation label is "Menunggu Review Finance"
    const tagText = (await statusTag.innerText()).trim();
    console.log(`[HARNESS CHECK] Rendered status tag text: "${tagText}"`);
    expect(tagText).toBe('Menunggu Review Finance');
    console.log('[HARNESS CHECK] Exact UI status label "Menunggu Review Finance" verified successfully!');

    // 7. Verify Workflow Runtime State via API
    const wfState = await page.evaluate(async () => {
      const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:4000/api/v1/workflow/instances/entity/PURCHASE_REQUEST/6', {
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
    });
    console.log('[HARNESS CHECK] Workflow instance state:', JSON.stringify(wfState));
    expect(wfState.ok).toBe(true);
    expect(wfState.status).toBe('IN_PROGRESS');
    expect(wfState.currentNodeId).toBe('node_finance_review');

    // 8. Non-mutating verification: NO approvals or mutations performed
    console.log('[HARNESS CHECK] Verification complete with ZERO mutations.');
  });
});
