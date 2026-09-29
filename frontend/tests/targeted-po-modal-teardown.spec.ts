import { test, expect } from '@playwright/test';
import { loginViaUi, activatePurchaseRequestTab, findTableRowByTextWithPagination } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const HISTORICAL_PR = 'PR-20260928-009';
const HISTORICAL_RFQ = 'RFQ-20260928-006';
const EXPECTED_WINNER = 'PT IT Solusi Bersama';
const EXPECTED_PO = 'PO-20260928-002';

test.describe('R9.1B-HARNESS-FIX-16: Targeted PO Modal Teardown & Overlay Cleanliness Probe', () => {
  test('Phase B, C, D, E, F: Read-only verification of 3-layer modal stack, deterministic close sequence, overlay gate, and PO tab verification', async ({ page }) => {
    // 1. Login as Purchasing
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com');

    // 2. Navigate to Procurement and activate Purchase Request tab
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
    await activatePurchaseRequestTab(page);

    // 3. Locate exact PR row for PR-20260928-009 across pagination
    console.log(`\n[PHASE B] Locating PR row for "${HISTORICAL_PR}"...`);
    const prRow = await findTableRowByTextWithPagination(page, HISTORICAL_PR);

    // Assert RFQ tag and EVALUATED status
    await expect(prRow.locator(`.ant-tag:has-text("${HISTORICAL_RFQ}")`)).toBeVisible({ timeout: 10000 });
    await expect(prRow.locator('.ant-tag:has-text("EVALUATED")')).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // LAYER 1: RFQ WORKSPACE MODAL
    // =========================================================================
    console.log(`[PHASE B] Opening Layer 1: RFQ Workspace Modal for "${HISTORICAL_RFQ}"...`);
    const lihatRfqBtn = prRow.locator('button:has-text("Lihat RFQ")');
    await expect(lihatRfqBtn).toBeVisible({ timeout: 10000 });
    await lihatRfqBtn.click();

    const rfqModal = page.locator('.ant-modal-content').filter({ hasText: HISTORICAL_RFQ }).first();
    await expect(rfqModal).toBeVisible({ timeout: 15000 });
    const rfqTitle = await rfqModal.locator('.ant-modal-title').innerText();
    console.log(`[PHASE B] Layer 1 (RFQ Workspace) Title: "${rfqTitle.replace(/\n/g, ' ')}"`);

    // =========================================================================
    // LAYER 2: VENDOR COMPARISON MODAL
    // =========================================================================
    console.log(`[PHASE B] Opening Layer 2: Vendor Comparison Modal...`);
    const viewEvaluationBtn = rfqModal.locator('button:has-text("Lihat Hasil Evaluasi")');
    await expect(viewEvaluationBtn).toBeVisible({ timeout: 10000 });
    await viewEvaluationBtn.click();

    const comparisonModal = page.locator('.ant-modal-content').filter({ hasText: 'Evaluasi & Perbandingan Vendor' }).first();
    await expect(comparisonModal).toBeVisible({ timeout: 15000 });
    const comparisonTitle = await comparisonModal.locator('.ant-modal-title').innerText();
    console.log(`[PHASE B] Layer 2 (Vendor Comparison) Title: "${comparisonTitle.replace(/\n/g, ' ')}"`);

    // =========================================================================
    // LAYER 3: PURCHASE ORDER MODAL
    // =========================================================================
    console.log(`[PHASE B] Opening Layer 3: PO Modal...`);
    const poBtn = comparisonModal.locator('button:has-text("Buat Purchase Order (PO)"), button:has-text("Lihat Purchase Order")').first();
    await expect(poBtn).toBeVisible({ timeout: 10000 });
    await poBtn.click();

    const poModal = page.locator('.ant-modal-content').filter({ has: page.locator('.ant-modal-title:has-text("Purchase Order")') });
    await expect(poModal).toHaveCount(1);
    await expect(poModal).toBeVisible({ timeout: 15000 });
    const poTitle = await poModal.locator('.ant-modal-title').innerText();
    console.log(`[PHASE B] Layer 3 (PO Modal) Title: "${poTitle.replace(/\n/g, ' ')}"`);

    // ── AUDIT FULL MODAL STACK BEFORE TEARDOWN ──
    const openModalsCount = await page.locator('.ant-modal-content:visible').count();
    console.log(`[PHASE B] Total visible modal layers in DOM: ${openModalsCount} (Expected: 3)`);
    expect(openModalsCount).toBe(3);

    // =========================================================================
    // PHASE C: STATE-BASED CLOSE SEQUENCE
    // =========================================================================
    console.log('\n[PHASE C] Starting deterministic modal teardown sequence...');

    // STEP 1: Close PO Modal (Layer 3)
    console.log('[PHASE C] Step 1: Closing PO Modal via scoped close button...');
    const closePoBtn = poModal.locator('.ant-modal-footer button').filter({ hasText: /Tutup|Batal/ }).first();
    await expect(closePoBtn).toBeVisible({ timeout: 5000 });
    await closePoBtn.click();

    await expect(poModal).not.toBeVisible({ timeout: 10000 });
    console.log('[PHASE C] Step 1 Complete: PO Modal closed and hidden/detached.');

    // STEP 2: Close Vendor Comparison Modal (Layer 2)
    console.log('[PHASE C] Step 2: Closing Vendor Comparison Modal via scoped close button...');
    const closeComparisonBtn = comparisonModal.locator('.ant-modal-footer button').filter({ hasText: /Tutup|Batal/ }).first();
    await expect(closeComparisonBtn).toBeVisible({ timeout: 5000 });
    await closeComparisonBtn.click();

    await expect(comparisonModal).not.toBeVisible({ timeout: 10000 });
    console.log('[PHASE C] Step 2 Complete: Vendor Comparison Modal closed and hidden/detached.');

    // STEP 3: Close RFQ Workspace Modal (Layer 1)
    console.log('[PHASE C] Step 3: Closing RFQ Workspace Modal via scoped close button...');
    const closeRfqBtn = rfqModal.locator('.ant-modal-footer button').filter({ hasText: /Tutup|Batal/ }).first();
    await expect(closeRfqBtn).toBeVisible({ timeout: 5000 });
    await closeRfqBtn.click();

    await expect(rfqModal).not.toBeVisible({ timeout: 10000 });
    console.log('[PHASE C] Step 3 Complete: RFQ Workspace Modal closed and hidden/detached.');

    // =========================================================================
    // PHASE D: OVERLAY CLEANLINESS GATE
    // =========================================================================
    console.log('\n[PHASE D] Executing Overlay Cleanliness Gate...');
    const remainingVisibleModals = await page.locator('.ant-modal-content:visible').count();
    console.log(`[PHASE D] Remaining visible modals: ${remainingVisibleModals} (Expected: 0)`);
    expect(remainingVisibleModals).toBe(0);

    // Verify modal mask is fully gone / not visible
    const visibleMasks = page.locator('.ant-modal-mask:not(.ant-modal-mask-hidden)');
    await expect(visibleMasks).toHaveCount(0, { timeout: 5000 });

    // Verify modal wrap overlay is fully gone / not visible
    const visibleWraps = page.locator('.ant-modal-wrap:not([style*="display: none"])');
    await expect(visibleWraps).toHaveCount(0, { timeout: 5000 });
    console.log('[PHASE D] Overlay Cleanliness Gate PASSED: Zero blocking modals, masks, or wraps.');

    // =========================================================================
    // PHASE E: PURCHASE ORDER TAB ACTIVATION
    // =========================================================================
    console.log('\n[PHASE E] Activating Purchase Order Tab...');
    const poTab = page.locator('.ant-tabs-tab').filter({ hasText: 'Purchase Order' });
    await expect(poTab).toHaveCount(1);
    await expect(poTab).toBeVisible({ timeout: 10000 });

    // Normal non-force click
    await poTab.click();

    // Assert tab active state
    await expect(poTab).toHaveClass(/ant-tabs-tab-active/, { timeout: 10000 });
    console.log('[PHASE E] Purchase Order tab clicked normally and active state verified.');

    const poCard = page.locator('.ant-card').filter({ hasText: 'Daftar Purchase Order' });
    await expect(poCard).toBeVisible({ timeout: 15000 });
    const poTable = poCard.locator('.ant-table');
    await expect(poTable).toBeVisible({ timeout: 10000 });
    console.log('[PHASE E] Purchase Order Table is visible in DOM.');

    // =========================================================================
    // PHASE F: TERMINAL PO ROW VERIFICATION (READ-ONLY)
    // =========================================================================
    console.log(`\n[PHASE F] Verifying terminal PO row for "${EXPECTED_PO}"...`);
    const poRow = poTable.locator('tr').filter({ hasText: EXPECTED_PO });
    await expect(poRow).toHaveCount(1);
    await expect(poRow).toBeVisible({ timeout: 15000 });

    // Verify Status = ISSUED
    const poRowStatus = poRow.locator('.ant-tag:has-text("ISSUED")');
    await expect(poRowStatus).toHaveCount(1);
    await expect(poRowStatus).toBeVisible({ timeout: 10000 });

    // Verify Vendor = PT IT Solusi Bersama
    await expect(poRow.getByText(EXPECTED_WINNER)).toBeVisible({ timeout: 10000 });

    console.log(`[PHASE F] Canonical PO row verified: Number="${EXPECTED_PO}", Winner="${EXPECTED_WINNER}", Status="ISSUED".`);
    console.log('[PHASE F] Zero mutation performed.');
  });
});
