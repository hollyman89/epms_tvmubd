import { test, expect } from '@playwright/test';
import dayjs from 'dayjs';
import { loginViaUi } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const HISTORICAL_TENDER_NAME = 'CANONICAL-E2E-1790582808295';

test.describe('R9.1B-HARNESS-FIX-03: Targeted Schedule DatePicker Determinism', () => {
  test('Audit and test deterministic Start & End date selection in Schedule', async ({ page }) => {
    // 1. Login as PM
    await loginViaUi(page, BASE_URL, 'pm@epms.com');

    // 2. Project 1367 is in Tab 1 (Antrean Kick-off Charter)
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    const charterRow = page.locator(`tr:has-text("${HISTORICAL_TENDER_NAME}")`).first();
    await expect(charterRow).toBeVisible({ timeout: 15000 });

    // 3. Open Operational Plan modal
    const planBtn = charterRow.locator('button:has-text("Operational Plan"), button:has-text("Penyusunan Plan")').first();
    await expect(planBtn).toBeVisible({ timeout: 10000 });
    await planBtn.click();

    const planModal = page.locator('.ant-modal-content').filter({ hasText: 'PM Operational Plan Workspace' }).first();
    await expect(planModal).toBeVisible({ timeout: 15000 });

    // 4. Setup Cost Item (needed to populate WBS/Schedule)
    const costSection = planModal.locator('#section-cost');
    await expect(costSection).toBeVisible({ timeout: 10000 });

    const cat1RadioItemized = costSection.locator('.ant-radio-button-wrapper').filter({ hasText: 'Rincian Item' }).first();
    await expect(cat1RadioItemized).toBeVisible({ timeout: 10000 });
    await cat1RadioItemized.click();
    await expect(cat1RadioItemized).toHaveClass(/ant-radio-button-wrapper-checked/);

    const tambahItemBtn = costSection.locator('button:has-text("Tambah Item")').first();
    await expect(tambahItemBtn).toBeVisible({ timeout: 10000 });
    await tambahItemBtn.click();

    const itemNameInput = costSection.locator('input[placeholder*="Nama Item"]').first();
    await expect(itemNameInput).toBeVisible({ timeout: 10000 });
    await itemNameInput.fill('Material Utama Konstruksi & Fabrikasi');

    const qtyInput = costSection.locator('input[placeholder*="Qty"]').first()
      .or(costSection.locator('.ant-input-number-input').first());
    await qtyInput.fill('100');

    const priceInput = costSection.locator('input[placeholder*="Harga"]').first();
    await priceInput.fill('850000');

    const detailBtn = costSection.locator('button').filter({ hasText: 'Detail' }).first();
    await detailBtn.click();
    await page.waitForTimeout(300);

    const scopeSelect = costSection.locator('.ant-select').filter({ hasText: 'Belum Ditentukan' }).first();
    await scopeSelect.click();
    await page.waitForTimeout(200);
    const projectOption = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: 'Project-Level' }).first();
    await projectOption.click();

    // 5. Setup WBS (creates deliverable for schedule)
    const wbsNav = planModal.getByText('2. WBS Structure').first();
    await wbsNav.click();
    await page.waitForTimeout(300);

    const tambahWbsBtn = planModal.locator('button:has-text("Tambah Work Package Utama"), button:has-text("Tambah Work Package")').first();
    await tambahWbsBtn.click();

    const wbsModal = page.locator('.ant-modal-content').filter({
      has: page.locator('.ant-modal-title', { hasText: 'Tambah Work Package Utama' }),
    });
    await expect(wbsModal).toBeVisible({ timeout: 10000 });

    const wbsNameInput = wbsModal.locator('#name');
    await expect(wbsNameInput).toBeVisible({ timeout: 10000 });
    await wbsNameInput.fill('Pekerjaan Konstruksi & Fabrikasi Proyek');

    const wbsWeightInput = wbsModal.locator('#weightPercentage');
    await wbsWeightInput.click();
    await wbsWeightInput.fill('100');

    const submitWbsBtn = wbsModal.locator('button:has-text("Tambahkan")');
    await submitWbsBtn.click();
    await expect(wbsModal).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // 6. Navigate to Pillar 3: Schedule
    const schedSection = planModal.locator('#section-schedule');
    const schedNav = planModal.locator('div').filter({ hasText: /^3\. Schedule & Gantt/ }).first();
    await schedNav.click();
    await page.waitForTimeout(300);

    const plusBtn = schedSection.locator('.ant-table-row-expand-icon-collapsed').first();
    if (await plusBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await plusBtn.click();
    }

    const taskRow = schedSection.locator('.ant-table-row').first();
    await expect(taskRow).toBeVisible({ timeout: 15000 });

    // Inspect Start Date and End Date inputs
    const startInput = taskRow.locator('input[placeholder*="Mulai"]').first();
    const endInput = taskRow.locator('input[placeholder*="Selesai"]').first();

    await expect(startInput).toBeVisible({ timeout: 10000 });
    await expect(endInput).toBeVisible({ timeout: 10000 });

    // --- TEST START DATE ---
    console.log('[HARNESS CHECK] Opening Start Date picker...');
    await startInput.click();
    
    // Stable dropdown wait (Phase B/C)
    const startDropdown = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
    await expect(startDropdown).toHaveCount(1, { timeout: 10000 });
    await expect(startDropdown).toBeVisible({ timeout: 10000 });
    await expect(startDropdown).not.toHaveClass(/ant-slide-up-(appear|enter)/, { timeout: 10000 });
    
    const stableStartClass = await startDropdown.getAttribute('class');
    console.log('[HARNESS CHECK] Stable Start Date dropdown class:', stableStartClass);

    // Locate Day 1 in view
    const day1Cell = startDropdown.locator('.ant-picker-cell-in-view .ant-picker-cell-inner').filter({ hasText: /^1$/ }).first();
    await expect(day1Cell).toBeVisible({ timeout: 5000 });
    await expect(day1Cell).toBeEnabled({ timeout: 5000 });
    await expect(day1Cell).toHaveCount(1);
    await day1Cell.click();

    // Check if startDropdown closed
    await expect(page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')).toHaveCount(0, { timeout: 5000 });
    console.log('[HARNESS CHECK] Start Date dropdown closed.');

    const startVal = await startInput.inputValue();
    console.log('[HARNESS CHECK] startInput committed value:', startVal);
    expect(startVal).not.toBe('');
    expect(startVal).toMatch(/^\d{2}\s[A-Za-z]{3}\s\d{4}$/);

    // --- TEST END DATE ---
    console.log('[HARNESS CHECK] Opening End Date picker...');
    await endInput.click();
    
    // Stable dropdown wait (Phase B/D)
    const endDropdown = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
    await expect(endDropdown).toHaveCount(1, { timeout: 10000 });
    await expect(endDropdown).toBeVisible({ timeout: 10000 });
    await expect(endDropdown).not.toHaveClass(/ant-slide-up-(appear|enter)/, { timeout: 10000 });

    const stableEndClass = await endDropdown.getAttribute('class');
    console.log('[HARNESS CHECK] Stable End Date dropdown class:', stableEndClass);

    // Select Day 15 in view
    const day15Cell = endDropdown.locator('.ant-picker-cell-in-view .ant-picker-cell-inner').filter({ hasText: /^15$/ }).first();
    await expect(day15Cell).toBeVisible({ timeout: 5000 });
    await expect(day15Cell).toBeEnabled({ timeout: 5000 });
    await expect(day15Cell).toHaveCount(1);
    await day15Cell.click();

    // Check if endDropdown closed
    await expect(page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')).toHaveCount(0, { timeout: 5000 });
    console.log('[HARNESS CHECK] End Date dropdown closed.');

    const endVal = await endInput.inputValue();
    console.log('[HARNESS CHECK] endInput committed value:', endVal);
    expect(endVal).not.toBe('');
    expect(endVal).toMatch(/^\d{2}\s[A-Za-z]{3}\s\d{4}$/);
    expect(dayjs(endVal, 'DD MMM YYYY').isAfter(dayjs(startVal, 'DD MMM YYYY'))).toBe(true);
    console.log('[HARNESS CHECK] End > Start verified successfully.');

    // Duration assertion
    const durCell = taskRow.locator('td').filter({ hasText: 'Hari' }).first();
    await expect(durCell).toBeVisible({ timeout: 10000 });
    const durText = await durCell.textContent();
    console.log('[HARNESS CHECK] Duration text:', durText);
    expect(durText).toContain('Hari');
    expect(durText).not.toBe('—');

    // Schedule status check: 1/1 Terjadwal
    const schedBadge = planModal.locator('text=1/1 Terjadwal').first();
    await expect(schedBadge).toBeVisible({ timeout: 10000 });
    console.log('[HARNESS CHECK] Schedule status 1/1 Terjadwal confirmed!');

    // Close modal via Tutup button without saving
    const tutupBtn = planModal.locator('button:has-text("Tutup")').first();
    if (await tutupBtn.isVisible()) {
      await tutupBtn.click();
    }
    console.log('[HARNESS CHECK] Verification complete without saving or mutating DB.');
  });
});
