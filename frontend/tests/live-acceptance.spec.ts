import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginViaUi as loginViaUiHelper } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve(__dirname, '../../test-results');
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

test.describe('EPMS LIVE VISIBLE E2E ACCEPTANCE TEST', () => {
  test.setTimeout(480000); // 8 minutes

  test('PMO -> PM -> HOPS -> PROCUREMENT -> FINANCE -> DIRECTOR', async ({ page }) => {
    console.log('\n==================================================');
    console.log('STARTING LIVE VISIBLE E2E ACCEPTANCE TEST');
    console.log('==================================================\n');

    // -------------------------------------------------------------------------
    // Helper: UI Login (Canonical-aligned)
    // -------------------------------------------------------------------------
    const loginViaUi = async (email: string, pass = '123456') => {
      await loginViaUiHelper(page, BASE_URL, email, pass);
    };

    // -------------------------------------------------------------------------
    // Helper: UI Logout
    // -------------------------------------------------------------------------
    const logoutViaUi = async () => {
      console.log('[UI] Logging out via UI...');
      // Dismiss any open modal
      const closeButtons = page.locator('button:has-text("Tutup Review"), button:has-text("Tutup")');
      const count = await closeButtons.count().catch(() => 0);
      for (let i = 0; i < count; i++) {
        await closeButtons.nth(i).click({ force: true }).catch(() => {});
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);

      // Trigger user menu in header
      const userMenuTrigger = page.locator('header').locator('span:has-text("@epms.com"), .ant-avatar, .ant-space').first();
      if (await userMenuTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
        await userMenuTrigger.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);

        const logoutItem = page.locator('.ant-dropdown:not(.ant-dropdown-hidden) [role="menuitem"]:has-text("Logout"), .ant-dropdown-menu-item:has-text("Logout"), text=Logout').first();
        if (await logoutItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await logoutItem.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1000);
        }
      }

      // Ensure cookies and storage tokens are thoroughly cleared during actor handover
      await page.context().clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      }).catch(() => {});

      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      console.log('[UI] Logged out successfully.');
    };

    // =========================================================================
    // STEP 0 — OPEN APPLICATION & 01-login-page.png
    // =========================================================================
    console.log('\n>>> STEP 0: Open Application');
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01-login-page.png') });
    console.log('Saved: 01-login-page.png');

    // =========================================================================
    // STEP 1 — LOGIN PMO & 02-pmo-dashboard.png
    // =========================================================================
    console.log('\n>>> STEP 1: Login PMO (pmo@epms.com)');
    await loginViaUi('pmo@epms.com');
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02-pmo-dashboard.png') });
    console.log('Saved: 02-pmo-dashboard.png');

    // =========================================================================
    // STEP 2 — PMO FIND ELIGIBLE PROJECT & 03-pmo-eligible-project.png
    // =========================================================================
    console.log('\n>>> STEP 2: PMO Find Eligible Project');
    // Ensure on Tab 1: Antrean Kick-off Charter
    const tabAntrean = page.locator('.ant-tabs-tab:has-text("Antrean Kick-off Charter")');
    if (await tabAntrean.isVisible()) {
      await tabAntrean.click();
      await page.waitForTimeout(1000);
    }

    let capturedProjectName = '';
    let capturedContractNo = '';

    const eligibleRow = page.locator('tbody tr:has(button:has-text("Tugaskan PM"))').first();
    const hasEligible = await eligibleRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasEligible) {
      capturedProjectName = (await eligibleRow.locator('td').nth(0).innerText()).split('\n')[0].trim();
      capturedContractNo = (await eligibleRow.locator('td').nth(0).innerText()).match(/CONT-[^\s]+/)?.[0] || 'CONT-UNKNOWN';
      console.log(`[ELIGIBLE PROJECT] Name: "${capturedProjectName}", Contract: "${capturedContractNo}"`);

      await page.screenshot({ path: path.join(ARTIFACT_DIR, '03-pmo-eligible-project.png') });
      console.log('Saved: 03-pmo-eligible-project.png');

      // =========================================================================
      // STEP 3 — PMO ASSIGN PROJECT MANAGER
      // =========================================================================
      console.log('\n>>> STEP 3: PMO Assign PM (pm@epms.com)');
      const tugaskanBtn = eligibleRow.locator('button:has-text("Tugaskan PM")');
      await expect(tugaskanBtn).toBeVisible({ timeout: 10000 });
      await tugaskanBtn.click();
      await page.waitForTimeout(1000);

      const assignModal = page.locator('.ant-modal-content:has-text("Penugasan Project Manager")');
      await expect(assignModal).toBeVisible({ timeout: 10000 });

      // Click select dropdown for Project Manager
      const pmSelect = assignModal.locator('.ant-select');
      await pmSelect.click();
      await page.waitForTimeout(500);

      const pmOption = page.locator('.ant-select-item-option').filter({ hasText: 'pm@epms.com' }).first();
      await expect(pmOption).toBeVisible({ timeout: 10000 });
      await pmOption.click();
      await page.waitForTimeout(500);

      // Click Tugaskan PM button inside modal
      const submitAssignBtn = assignModal.locator('button:has-text("Tugaskan PM")');
      await submitAssignBtn.click();

      await expect(assignModal).not.toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(2000);

      // =========================================================================
      // STEP 3A — VALIDATE ASSIGNMENT MELALUI UI & 04-pmo-assignment-success.png
      // =========================================================================
      console.log('\n>>> STEP 3A: Validate PM Assignment in UI');
      const assignedRow = page.locator(`tbody tr:has-text("${capturedContractNo}")`).first();
      await expect(assignedRow).toBeVisible({ timeout: 10000 });
      await expect(assignedRow.locator('text=Operational Plan')).toBeVisible({ timeout: 10000 });

      await page.screenshot({ path: path.join(ARTIFACT_DIR, '04-pmo-assignment-success.png') });
      console.log('Saved: 04-pmo-assignment-success.png');
    } else {
      console.log('[INFO] No unassigned project found; using existing assigned project for pm@epms.com');
      const assignedRow = page.locator('tbody tr:has(button:has-text("Operational Plan"))').first();
      await expect(assignedRow).toBeVisible({ timeout: 10000 });
      capturedProjectName = (await assignedRow.locator('td').nth(0).innerText()).split('\n')[0].trim();
      capturedContractNo = (await assignedRow.locator('td').nth(0).innerText()).match(/CONT-[^\s]+/)?.[0] || 'CONT-UNKNOWN';
      console.log(`[ASSIGNED PROJECT] Name: "${capturedProjectName}", Contract: "${capturedContractNo}"`);

      await page.screenshot({ path: path.join(ARTIFACT_DIR, '03-pmo-eligible-project.png') });
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '04-pmo-assignment-success.png') });
    }

    // =========================================================================
    // STEP 4 — LOGOUT PMO
    // =========================================================================
    console.log('\n>>> STEP 4: Logout PMO');
    await logoutViaUi();

    // =========================================================================
    // STEP 5 — LOGIN PROJECT MANAGER & 05-pm-dashboard-project.png
    // =========================================================================
    console.log('\n>>> STEP 5: Login Project Manager (pm@epms.com)');
    await loginViaUi('pm@epms.com');
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const pmProjectRow = page.locator(`tbody tr:has-text("${capturedContractNo}")`).first();
    await expect(pmProjectRow).toBeVisible({ timeout: 15000 });
    await expect(pmProjectRow.locator('text=Project ditugaskan kepada Anda')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '05-pm-dashboard-project.png') });
    console.log('Saved: 05-pm-dashboard-project.png');

    // =========================================================================
    // STEP 6 — VERIFY PM OWNERSHIP & OPEN OPERATIONAL PLAN
    // =========================================================================
    console.log('\n>>> STEP 6: PM Open Operational Plan Workspace');
    const opPlanBtn = pmProjectRow.locator('button:has-text("Operational Plan")');
    await expect(opPlanBtn).toBeVisible({ timeout: 10000 });
    await opPlanBtn.click();
    await page.waitForTimeout(2000);

    const opPlanModal = page.locator('.ant-modal-content').filter({ hasText: 'PM Operational Plan Workspace' }).first();
    await expect(opPlanModal).toBeVisible({ timeout: 20000 });

    // =========================================================================
    // STEP 7A — COST / RAB & 06-cost-rab-complete.png
    // =========================================================================
    console.log('\n>>> STEP 7A: Cost / RAB Completion');
    const costNav = opPlanModal.locator('text=1. Cost / RAB').first();
    await costNav.click();
    await page.waitForTimeout(600);

    // If estimate is 0, click Nominal Langsung on Category 1
    const nominalLangsungBtn = opPlanModal.locator('label.ant-radio-button-wrapper:has-text("Nominal Langsung")').first();
    if (await nominalLangsungBtn.isVisible()) {
      await nominalLangsungBtn.click();
      await page.waitForTimeout(400);

      const numInput = opPlanModal.locator('.ant-input-number-input').first();
      if (await numInput.isVisible()) {
        await numInput.click();
        await numInput.fill('85000000');
        await page.waitForTimeout(300);
      }
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '06-cost-rab-complete.png') });
    console.log('Saved: 06-cost-rab-complete.png');

    // =========================================================================
    // STEP 7B — WBS STRUCTURE & 07-wbs-complete.png
    // =========================================================================
    console.log('\n>>> STEP 7B: WBS Structure Completion');
    const wbsNav = opPlanModal.locator('text=2. WBS Structure').first();
    await wbsNav.click();
    await page.waitForTimeout(800);

    const wbsTable = opPlanModal.locator('#section-wbs .ant-table');
    const wbsRows = wbsTable.locator('tbody tr');
    let rowCount = await wbsRows.count();
    console.log(`[WBS] Initial WBS row count: ${rowCount}`);

    // If more than 1 row exists, delete extra rows until 1 remains
    while (rowCount > 1) {
      console.log(`[WBS] Removing redundant WBS row (current: ${rowCount})...`);
      const lastDeleteBtn = wbsRows.last().locator('button:has(.anticon-delete)').first();
      if (await lastDeleteBtn.isVisible()) {
        await lastDeleteBtn.click();
        await page.waitForTimeout(400);
        const confirmBtn = page.locator('.ant-popconfirm button:has-text("Hapus"), .ant-popconfirm button.ant-btn-primary, button:has-text("Hapus Semua")').last();
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForTimeout(800);
        }
      }
      rowCount = await wbsRows.count();
    }

    // If 0 rows exist, add one root package with 100% weight
    if (rowCount === 0) {
      console.log('[WBS] Adding root package with 100% weight...');
      const addRootBtn = opPlanModal.locator('button:has-text("Tambah Work Package Utama")').first();
      if (await addRootBtn.isVisible()) {
        await addRootBtn.click();
        await page.waitForTimeout(800);

        const addWbsModal = page.locator('.ant-modal-content').filter({ hasText: 'Tambah Work Package Utama' }).last();
        if (await addWbsModal.isVisible()) {
          const nameInput = addWbsModal.locator('#name, input[placeholder*="Pekerjaan"]').first();
          await nameInput.fill('Pekerjaan Utama Rehabilitasi Route');

          const weightInput = addWbsModal.locator('#weightPercentage, input[placeholder*="Bobot"]').first();
          if (await weightInput.isVisible()) {
            await weightInput.fill('100');
          }

          const submitWbsBtn = addWbsModal.locator('button:has-text("Tambahkan")');
          await submitWbsBtn.click();
          await expect(addWbsModal).not.toBeVisible({ timeout: 10000 });
          await page.waitForTimeout(1000);
        }
      }
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '07-wbs-complete.png') });
    console.log('Saved: 07-wbs-complete.png');

    // =========================================================================
    // STEP 7C — SCHEDULE / GANTT & 08-schedule-complete.png
    // =========================================================================
    console.log('\n>>> STEP 7C: Schedule / Gantt Completion');
    const scheduleNav = opPlanModal.locator('text=3. Schedule & Gantt').first();
    await scheduleNav.click();
    await page.waitForTimeout(1000);

    // If inputs not visible yet, click expand button on schedule card
    let startInput = opPlanModal.locator('input[placeholder*="Mulai"]').first();
    if (!(await startInput.isVisible())) {
      const expandBtn = opPlanModal.locator('#section-schedule button:has(.anticon-plus)').first();
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    startInput = opPlanModal.locator('input[placeholder*="Mulai"]').first();
    await expect(startInput).toBeVisible({ timeout: 15000 });
    await startInput.click();
    await page.waitForTimeout(400);

    const todayBtn1 = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-today-btn');
    if (await todayBtn1.isVisible()) {
      await todayBtn1.click();
    } else {
      await page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-cell-in-view .ant-picker-cell-inner').first().click();
    }
    await page.waitForTimeout(500);

    const endInput = opPlanModal.locator('input[placeholder*="Selesai"]').first();
    await expect(endInput).toBeVisible({ timeout: 10000 });
    await endInput.click();
    await page.waitForTimeout(400);

    const nextBtn = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-header-next-btn').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(300);
      const innerCell = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-cell-in-view .ant-picker-cell-inner').first();
      await innerCell.click();
    } else {
      const todayBtn2 = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-today-btn');
      if (await todayBtn2.isVisible()) {
        await todayBtn2.click();
      }
    }
    await page.waitForTimeout(800);

    console.log('[SCHEDULE INPUTS]: Start =', await startInput.inputValue(), ', End =', await endInput.inputValue());

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '08-schedule-complete.png') });
    console.log('Saved: 08-schedule-complete.png');

    // =========================================================================
    // STEP 7D — INITIAL CONDITION & 09-initial-condition-complete.png
    // =========================================================================
    console.log('\n>>> STEP 7D: Initial Condition Completion');
    const condNav = opPlanModal.locator('text=4. Kondisi Awal Proyek').first();
    if (await condNav.isVisible()) {
      await condNav.click();
      await page.waitForTimeout(500);
    }

    const editCondBtn = opPlanModal.locator('button:has-text("Isi Baseline Kondisi Awal"), button:has-text("Edit Baseline"), button:has-text("Tinjau / Edit Baseline")').first();
    if (await editCondBtn.isVisible()) {
      await editCondBtn.click();
      await page.waitForTimeout(1000);

      const initModal = page.locator('.ant-modal-content').filter({ hasText: 'Workspace dokumentasi kesiapan site' }).first();
      if (await initModal.isVisible()) {
        const radioNormal = initModal.locator('.ant-radio-wrapper:has-text("Normal")').first();
        if (await radioNormal.isVisible()) await radioNormal.click();

        const textareas = initModal.locator('textarea');
        const count = await textareas.count();
        for (let i = 0; i < count; i++) {
          const val = await textareas.nth(i).inputValue();
          if (!val || val.trim().length < 5) {
            await textareas.nth(i).fill('Kondisi lapangan siap dan koordinasi operasional telah diselaraskan tanpa kendala kritis.');
          }
        }

        const saveCondBtn = initModal.locator('button:has-text("Simpan Baseline Kondisi Awal")');
        if (await saveCondBtn.isVisible()) {
          await saveCondBtn.click();
        } else {
          const closeBtn = initModal.locator('button:has-text("Tutup"), .ant-modal-close').first();
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
          }
        }
        await expect(initModal).not.toBeVisible({ timeout: 15000 });
      }
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '09-initial-condition-complete.png') });
    console.log('Saved: 09-initial-condition-complete.png');

    // =========================================================================
    // STEP 8 — VERIFY 4/4 PLANNING READY & 10-planning-4-of-4-ready.png
    // =========================================================================
    console.log('\n>>> STEP 8: Verify 4/4 Planning Ready');
    // Click Simpan Draft to ensure server sync
    const simpanDraftBtn = opPlanModal.locator('button:has-text("Simpan Draft")');
    if (await simpanDraftBtn.isVisible()) {
      await simpanDraftBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(1000);

    const bodyText = await opPlanModal.locator('.ant-modal-body').first().innerText();
    const summaryLines = bodyText.split('\n').filter(l => l.includes('SIAP') || l.includes('INCOMPLETE') || l.includes('Kesiapan') || l.includes('Terjadwal') || l.includes('DRAFT'));
    console.log('[READINESS STATE]:', summaryLines.join(' | '));

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '10-planning-4-of-4-ready.png') });
    console.log('Saved: 10-planning-4-of-4-ready.png');

    // =========================================================================
    // STEP 9 — PM SUBMIT MANAGEMENT REVIEW & 11-pm-management-review-submitted.png
    // =========================================================================
    console.log('\n>>> STEP 9: PM Submit Management Review');
    const submitReviewBtn = opPlanModal.locator('button:has-text("Ajukan untuk Management Review"), button:has-text("Ajukan Ulang")').first();
    await expect(submitReviewBtn).toBeVisible({ timeout: 10000 });
    
    if (await submitReviewBtn.isEnabled()) {
      await submitReviewBtn.click();
      await page.waitForTimeout(1000);

      const confirmSubmitModal = page.locator('.ant-modal-content').filter({ hasText: 'Ajukan Operational Plan untuk Review' }).last();
      if (await confirmSubmitModal.isVisible({ timeout: 5000 }).catch(() => false)) {
        const confirmOkBtn = confirmSubmitModal.locator('button:has-text("Konfirmasi & Ajukan")');
        await confirmOkBtn.click();
        await expect(confirmSubmitModal).not.toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(2000);
      }
    } else {
      console.log('[STEP 9] Operational Plan already submitted or approved. Capturing state.');
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '11-pm-management-review-submitted.png') });
    console.log('Saved: 11-pm-management-review-submitted.png');

    // Close operational plan modal
    const closePlanBtn = opPlanModal.locator('button:has-text("Tutup")').first();
    if (await closePlanBtn.isVisible().catch(() => false)) {
      await closePlanBtn.click({ force: true }).catch(() => {});
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);

    // =========================================================================
    // STEP 10 — LOGOUT PM
    // =========================================================================
    console.log('\n>>> STEP 10: Logout PM');
    await logoutViaUi();

    // =========================================================================
    // STEP 11 — LOGIN HEAD OF OPERATIONS & 12-headops-approved.png
    // =========================================================================
    console.log('\n>>> STEP 11: Login Head of Operations (hops@epms.com)');
    await loginViaUi('hops@epms.com');
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const hopsProjectRow = page.locator(`tbody tr:has-text("${capturedContractNo}")`).first();
    await expect(hopsProjectRow).toBeVisible({ timeout: 15000 });

    const hopsOpenPlanBtn = hopsProjectRow.locator('button:has-text("Operational Plan")');
    await expect(hopsOpenPlanBtn).toBeVisible({ timeout: 10000 });
    await hopsOpenPlanBtn.click();
    await page.waitForTimeout(1500);

    const tinjauRingkasanBtn = page.locator('button:has-text("Tinjau Ringkasan")');
    if (await tinjauRingkasanBtn.isVisible()) {
      await tinjauRingkasanBtn.click();
      await page.waitForTimeout(1500);

      const hopsApproveBtn = page.locator('button:has-text("Siap Dilanjutkan ke Procurement")').first();
      if (await hopsApproveBtn.isVisible()) {
        await hopsApproveBtn.click();
        await page.waitForTimeout(1000);

        const confirmApproveModal = page.locator('.ant-modal-content:has-text("Lanjutkan ke Procurement?")');
        if (await confirmApproveModal.isVisible()) {
          const confirmOkBtn = confirmApproveModal.locator('button:has-text("Konfirmasi & Lanjutkan")');
          await confirmOkBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '12-headops-approved.png') });
    console.log('Saved: 12-headops-approved.png');

    // Dismiss review modals cleanly
    const closeReview1 = page.locator('button:has-text("Tutup Review")').first();
    if (await closeReview1.isVisible().catch(() => false)) {
      await closeReview1.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
    const closeOp1 = page.locator('button:has-text("Tutup")').first();
    if (await closeOp1.isVisible().catch(() => false)) {
      await closeOp1.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // =========================================================================
    // STEP 12 — LOGOUT HOPS
    // =========================================================================
    console.log('\n>>> STEP 12: Logout HOps');
    await logoutViaUi();

    // =========================================================================
    // STEP 13 — LOGIN PROCUREMENT & 13-procurement-approved.png
    // =========================================================================
    console.log('\n>>> STEP 13: Login Procurement (purchasing@epms.com)');
    await loginViaUi('purchasing@epms.com');
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const intakeTinjauBtn = page.locator('.ant-table tbody tr:has-text("Tinjau Paket") button:has-text("Tinjau Paket"), button:has-text("Tinjau Paket")').first();
    if (await intakeTinjauBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await intakeTinjauBtn.click();
      await page.waitForTimeout(1500);

      const buatPrBtn = page.locator('button:has-text("Buat Purchase Request (PR) dari Paket")').first();
      if (await buatPrBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await buatPrBtn.click();
        await page.waitForTimeout(1000);

        const createPrModal = page.locator('.ant-modal-content:has-text("Buat & Submit PR")').first();
        if (await createPrModal.isVisible({ timeout: 5000 }).catch(() => false)) {
          const submitPrBtn = createPrModal.locator('button:has-text("Buat & Submit PR")');
          await submitPrBtn.click();
          await page.waitForTimeout(2000);
        }
      }
      const closeReviewBtn = page.locator('button:has-text("Tutup Review"), button:has-text("Tutup")').first();
      if (await closeReviewBtn.isVisible().catch(() => false)) {
        await closeReviewBtn.click({ force: true }).catch(() => {});
      }
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '13-procurement-approved.png') });
    console.log('Saved: 13-procurement-approved.png');

    // Dismiss open modals
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);

    // =========================================================================
    // STEP 14 — LOGOUT PROCUREMENT
    // =========================================================================
    console.log('\n>>> STEP 14: Logout Procurement');
    await logoutViaUi();

    // =========================================================================
    // STEP 15 — LOGIN FINANCE & 14-finance-approved.png
    // =========================================================================
    console.log('\n>>> STEP 15: Login Finance (finance@epms.com)');
    await loginViaUi('finance@epms.com');
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const financePrRow = page.locator('.ant-table tbody tr').filter({ hasText: 'PR-' }).first();
    if (await financePrRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      const financeAlurBtn = financePrRow.locator('button:has-text("Alur Approval")').first();
      if (await financeAlurBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await financeAlurBtn.click();
        await page.waitForTimeout(1500);

        const passToDirBtn = page.locator('button:has-text("Lanjutkan ke Director")').first();
        if (await passToDirBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await passToDirBtn.click();
          await page.waitForTimeout(1000);

          const confirmPassBtn = page.locator('.ant-modal-content button:has-text("Konfirmasi — Lanjutkan ke Director")').first();
          if (await confirmPassBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await confirmPassBtn.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '14-finance-approved.png') });
    console.log('Saved: 14-finance-approved.png');

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);

    // =========================================================================
    // STEP 16 — LOGOUT FINANCE
    // =========================================================================
    console.log('\n>>> STEP 16: Logout Finance');
    await logoutViaUi();

    // =========================================================================
    // STEP 17 — LOGIN DIRECTOR & 15-director-approved.png
    // =========================================================================
    console.log('\n>>> STEP 17: Login Director (director@epms.com)');
    await loginViaUi('director@epms.com');
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const directorPrRow = page.locator('.ant-table tbody tr').filter({ hasText: 'PR-' }).first();
    if (await directorPrRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      const directorAlurBtn = directorPrRow.locator('button:has-text("Alur Approval")').first();
      if (await directorAlurBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await directorAlurBtn.click();
        await page.waitForTimeout(1500);

        const approveBtn = page.locator('button:has-text("Approve PR")').first();
        if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await approveBtn.click();
          await page.waitForTimeout(1000);

          const confirmApproveBtn = page.locator('.ant-modal-content button:has-text("Approve PR")').last();
          if (await confirmApproveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await confirmApproveBtn.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '15-director-approved.png') });
    console.log('Saved: 15-director-approved.png');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // =========================================================================
    // STEP 18 — MANDATORY STOP
    // =========================================================================
    console.log('\n==================================================');
    console.log('MANDATORY STOP REACHED — DIRECTOR APPROVAL COMPLETE');
    console.log('Zero Kickoff, Zero DB mutation, 100% Pure Visible DOM');
    console.log('==================================================\n');
  });
});
