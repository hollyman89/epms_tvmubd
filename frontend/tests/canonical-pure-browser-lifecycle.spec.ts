import { test, expect } from '@playwright/test';
import path from 'path';
import dayjs from 'dayjs';
import {
  loginViaUi as loginViaUiHelper,
  pmoAssignProjectManager,
  pmSetupOperationalPlan,
  submitManagementReview,
  completeGovernanceReviewChain,
  pmExecuteFormalKickoff,
  pmCreateAndSubmitProcurementPackage,
  purchasingCreatePrFromPackage,
  completePrApprovalWorkflow,
  createAndEvaluateRfq,
  createPurchaseOrder,
} from './canonical-lifecycle-helpers';

/**
 * P1 CANONICAL PURE BROWSER E2E LIFECYCLE
 *
 * Requirements:
 * - Pure UI interactions only (Click, Fill, Select, File Upload, Navigation)
 * - Zero direct database operations
 * - Real multi-role UI handovers (Marketing -> Director -> Legal -> PMO -> PM -> Purchasing)
 * - Canonical single transaction chain from Tender to Purchase Order
 */

const BASE_URL = 'http://localhost:3000';
const SAMPLE_PDF_PATH = path.resolve(__dirname, '../test-assets/test-sample.pdf');

test.describe('P1 — CANONICAL PURE BROWSER E2E LIFECYCLE', () => {
  test.setTimeout(600000); // 10 minutes for complete multi-actor flow

  test('Canonical Multi-Role Pure Browser Workflow through Procurement', async ({ page }) => {
    // -------------------------------------------------------------------------
    // UI HELPER: AUTHENTICATION VIA UI FORM ONLY
    // -------------------------------------------------------------------------
    const loginViaUi = async (email: string, pass = '123456') => {
      await loginViaUiHelper(page, BASE_URL, email, pass);
    };

    const logoutViaUi = async () => {
      console.log(`\n[UI AUTH] Logging out via header user dropdown...`);
      const userDropdownTrigger = page.locator('header .ant-dropdown-trigger').first();
      await expect(userDropdownTrigger).toBeVisible({ timeout: 10000 });
      await userDropdownTrigger.click();

      const logoutItem = page.locator('.ant-dropdown-menu-item').filter({ hasText: 'Logout' });
      await expect(logoutItem).toBeVisible({ timeout: 10000 });
      await logoutItem.click();

      await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });
      await expect(page.locator('.epms-login-card-title')).toHaveText('Welcome Back', { timeout: 15000 });
      console.log(`[UI AUTH] Successfully logged out via UI.`);
      await page.waitForTimeout(800);
    };

    const tenderUniqueName = `CANONICAL-E2E-${Date.now()}`;

    // =========================================================================
    // STEP 01: LOGIN MARKETING VIA UI
    // =========================================================================
    console.log('\n>>> [STEP 01] Login Marketing via UI');
    await loginViaUi('ragil@epms.com');

    // =========================================================================
    // STEP 02: CREATE TENDER VIA UI (+ Input Tender Modal)
    // =========================================================================
    console.log('\n>>> [STEP 02] Create Tender via UI Modal');
    await page.goto(`${BASE_URL}/sales`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const inputTenderBtn = page.locator('button:has-text("Input Tender")');
    await expect(inputTenderBtn).toBeVisible({ timeout: 15000 });
    await inputTenderBtn.click();

    const createModal = page.locator('.ant-modal-content:has-text("Project Basic Info")');
    await expect(createModal).toBeVisible({ timeout: 10000 });

    // Step 0: Basic Info
    await page.locator('#projectName').fill(tenderUniqueName);
    await page.locator('#estimatedBudget').fill('1500000000');

    // Select Customer via UI Select Dropdown
    const customerSelect = page.locator('.ant-modal-content .ant-select').first();
    await customerSelect.click();
    await page.waitForTimeout(400);
    const customerOption = page.locator('.ant-select-item-option').first();
    await expect(customerOption).toBeVisible({ timeout: 10000 });
    const selectedCustomerName = await customerOption.innerText();
    console.log(`[UI ACTION] Selected Customer: ${selectedCustomerName.trim()}`);
    await customerOption.click();

    // Fill Dates using direct fill + Enter
    const expectedClosingInput = page.locator('#expectedClosingDate');
    await expectedClosingInput.click();
    await expectedClosingInput.fill('2026-12-31');
    await expectedClosingInput.press('Enter');

    const bidDeadlineInput = page.locator('#bidSubmissionDeadline');
    await bidDeadlineInput.click();
    await bidDeadlineInput.fill('2026-12-31');
    await bidDeadlineInput.press('Enter');

    // Click Next
    await page.locator('.ant-modal-content button:has-text("Next")').click();
    await page.waitForTimeout(600);

    // Step 1: Technical Details
    const locationInput = page.locator('#projectLocation');
    if (await locationInput.isVisible()) {
      await locationInput.fill('Surabaya Metro Region');
    }
    const notesInput = page.locator('#notes');
    if (await notesInput.isVisible()) {
      await notesInput.fill('Pure Browser Canonical E2E Demonstration');
    }

    // Submit
    const submitOpportunityBtn = page.locator('.ant-modal-content button:has-text("Create Opportunity")');
    await expect(submitOpportunityBtn).toBeVisible({ timeout: 5000 });
    await submitOpportunityBtn.click();

    // Verify modal closed
    await expect(createModal).not.toBeVisible({ timeout: 15000 });
    console.log(`[UI ASSERTION] Tender created successfully: "${tenderUniqueName}"`);

    // Verify card is rendered on Kanban Board
    await page.waitForTimeout(2000);
    const createdCard = page.locator('.ant-card').filter({ hasText: tenderUniqueName }).first();
    await expect(createdCard).toBeVisible({ timeout: 15000 });
    console.log(`[UI ASSERTION] Tender card is visible in Kanban board.`);

    // =========================================================================
    // STEP 03: PROPOSE GO / NO-GO REVIEW VIA UI DRAWER
    // =========================================================================
    console.log('\n>>> [STEP 03] Propose Go/No-GO Review via UI Drawer');
    await createdCard.click();

    const drawer = page.locator('.ant-drawer-content:has-text("Detail Proyek")');
    await expect(drawer).toBeVisible({ timeout: 10000 });

    const ajukanReviewBtn = drawer.locator('button:has-text("Ajukan Review")');
    await expect(ajukanReviewBtn).toBeVisible({ timeout: 10000 });
    await ajukanReviewBtn.click();

    const goNoGoModal = page.locator('.ant-modal-content').filter({ hasText: 'Pengajuan GO / NO-GO Review' });
    if (await goNoGoModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.locator('#executiveSummary').fill('Opportunity bernilai strategis dengan repeat customer margin 20%');
      const noConcernCheckbox = goNoGoModal.locator('text="Tidak ada concern material"');
      if (await noConcernCheckbox.isVisible()) {
        await noConcernCheckbox.click();
      }
      await page.locator('#marketingRecommendationReason').fill('Customer kredibel dan budget proyek telah teralokasi');
      const submitToDirectorBtn = goNoGoModal.locator('button:has-text("Ajukan ke Direksi")');
      await submitToDirectorBtn.click();
      await expect(goNoGoModal).not.toBeVisible({ timeout: 15000 });
    }

    await page.waitForTimeout(1500);
    const closeDrawerBtn = drawer.locator('.ant-drawer-close');
    await closeDrawerBtn.click();
    await expect(drawer).not.toBeVisible({ timeout: 10000 });
    console.log(`[UI ASSERTION] Tender successfully submitted for Executive Go/No-Go Review.`);

    // =========================================================================
    // STEP 04: LOGOUT MARKETING VIA UI
    // =========================================================================
    console.log('\n>>> [STEP 04] Logout Marketing via UI');
    await logoutViaUi();

    // =========================================================================
    // STEP 05: LOGIN EXECUTIVE / DIRECTOR VIA UI
    // =========================================================================
    console.log('\n>>> [STEP 05] Login Executive Director via UI');
    await loginViaUi('director@epms.com');

    // =========================================================================
    // STEP 06: EXECUTIVE DECISION (APPROVE GO) VIA UI
    // =========================================================================
    console.log('\n>>> [STEP 06] Executive Decision (APPROVE GO) via UI');
    await page.goto(`${BASE_URL}/sales`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const execCard = page.locator('.ant-card').filter({ hasText: tenderUniqueName }).first();
    await expect(execCard).toBeVisible({ timeout: 15000 });
    await execCard.click();

    const execDrawer = page.locator('.ant-drawer-content:has-text("Detail Proyek")');
    await expect(execDrawer).toBeVisible({ timeout: 10000 });

    const approveGoBtn = execDrawer.locator('button:has-text("APPROVE GO")');
    await expect(approveGoBtn).toBeVisible({ timeout: 10000 });
    await approveGoBtn.click();

    await page.waitForTimeout(1500);
    const goDecisionTag = execDrawer
      .locator('.ant-tag')
      .filter({ hasText: /^GO — LANJUTKAN$|^GO$/ });
    await expect(goDecisionTag).toHaveCount(1);
    await expect(goDecisionTag).toBeVisible({ timeout: 10000 });
    console.log(`[UI ASSERTION] Executive Director approved GO.`);

    const closeExecDrawerBtn = execDrawer.locator('.ant-drawer-close');
    await closeExecDrawerBtn.click();
    await expect(execDrawer).not.toBeVisible({ timeout: 10000 });

    // =========================================================================
    // STEP 07: LOGOUT DIRECTOR VIA UI
    // =========================================================================
    console.log('\n>>> [STEP 07] Logout Director via UI');
    await logoutViaUi();

    // =========================================================================
    // STEP 08: LOGIN MARKETING VIA UI
    // =========================================================================
    console.log('\n>>> [STEP 08] Login Marketing via UI');
    await loginViaUi('ragil@epms.com');

    // =========================================================================
    // STEP 09: CANONICAL MARKETING LIFECYCLE (QUALIFICATION -> PROPOSAL -> NEGOTIATION -> WON)
    // =========================================================================
    console.log('\n>>> [STEP 09] Canonical Marketing Lifecycle: Qualification -> Proposal -> Negotiation -> Won');
    await page.goto(`${BASE_URL}/sales`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const dragCardToColumn = async (
      cardLocator: any,
      targetColumnLocator: any,
      expectedModalLocator: any
    ) => {
      const strayLostModal = page.locator('.ant-modal-content:has-text("Validasi Kartu LOST")');
      if (await strayLostModal.isVisible({ timeout: 1000 }).catch(() => false)) {
        await strayLostModal.locator('button:has-text("Batal")').click();
        await expect(strayLostModal).not.toBeVisible({ timeout: 5000 });
      }

      await targetColumnLocator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);

      const dragHandle = cardLocator.locator('xpath=ancestor::div[@data-rfd-drag-handle-draggable-id]').first();
      if (await dragHandle.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('[UI ACTION] Using accessible keyboard drag (1 step right)...');
        await dragHandle.focus();
        await page.keyboard.press('Space');
        await page.waitForTimeout(400);
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(300);
        await page.keyboard.press('Space');
        await page.waitForTimeout(1000);
      } else {
        const cardBox = await cardLocator.boundingBox();
        const targetBox = await targetColumnLocator.boundingBox();

        if (cardBox && targetBox) {
          const startX = cardBox.x + cardBox.width / 2;
          const startY = cardBox.y + cardBox.height / 2;
          const targetX = targetBox.x + targetBox.width / 2;
          const targetY = targetBox.y + Math.min(targetBox.height / 2, 80);

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(300);
          await page.mouse.move(startX + 10, startY + 10, { steps: 5 });
          await page.waitForTimeout(250);
          await page.mouse.move(targetX, targetY, { steps: 25 });
          await page.waitForTimeout(500);
          await page.mouse.up();
          await page.waitForTimeout(1000);
        }
      }

      await expect(expectedModalLocator).toBeVisible({ timeout: 15000 });
    };

    const detailDrawer = page.locator('.ant-drawer-content:has-text("Detail Proyek")');

    // -------------------------------------------------------------------------
    // STEP 09A: ASSERT QUALIFICATION STATE
    // -------------------------------------------------------------------------
    console.log('\n>>> [STEP 09A] Assert QUALIFICATION Stage');
    const qualColumn = page.locator('[data-rfd-droppable-id="QUALIFICATION"]');
    await expect(qualColumn).toBeVisible({ timeout: 15000 });

    const tenderCardInQual = qualColumn.locator('.ant-card').filter({ hasText: tenderUniqueName }).first();
    await expect(tenderCardInQual).toBeVisible({ timeout: 15000 });
    console.log(`[UI ASSERTION] Tender "${tenderUniqueName}" is visible in QUALIFICATION column.`);

    await tenderCardInQual.click();
    await expect(detailDrawer).toBeVisible({ timeout: 10000 });
    await expect(detailDrawer.locator('.ant-tag:has-text("QUALIFICATION")')).toBeVisible({ timeout: 10000 });
    await detailDrawer.locator('.ant-drawer-close').click();
    await expect(detailDrawer).not.toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // STEP 09B: QUALIFICATION -> PROPOSAL (UPLOAD PROPOSAL PDF)
    // -------------------------------------------------------------------------
    console.log('\n>>> [STEP 09B] Transition QUALIFICATION -> PROPOSAL & Upload Proposal PDF');
    const proposalColumn = page.locator('[data-rfd-droppable-id="PROPOSAL"]');
    await expect(proposalColumn).toBeVisible({ timeout: 10000 });

    const proposalModal = page.locator('.ant-modal-content:has-text("Peringatan Wajib Dokumen")');
    await dragCardToColumn(tenderCardInQual, proposalColumn, proposalModal);

    await expect(proposalModal.locator('text=Unggah Dokumen Penawaran (Proposal)')).toBeVisible({ timeout: 10000 });
    console.log('[UI ASSERTION] Proposal upload modal is visible.');

    const proposalFileInput = proposalModal.locator('input[type="file"]');
    await proposalFileInput.setInputFiles(SAMPLE_PDF_PATH);
    await page.waitForTimeout(600);

    await expect(proposalModal.locator('.ant-upload-list-item-name')).toBeVisible({ timeout: 10000 });
    console.log('[UI ASSERTION] Proposal PDF file selected in upload modal.');

    const confirmProposalBtn = proposalModal.locator('button:has-text("Konfirmasi & Pindahkan")');
    await expect(confirmProposalBtn).toBeVisible({ timeout: 5000 });
    await confirmProposalBtn.click();

    await expect(proposalModal).not.toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    const tenderCardInProposal = proposalColumn.locator('.ant-card').filter({ hasText: tenderUniqueName }).first();
    await expect(tenderCardInProposal).toBeVisible({ timeout: 15000 });
    console.log(`[UI ASSERTION] Tender card is visible in PROPOSAL column.`);

    await tenderCardInProposal.click();
    await expect(detailDrawer).toBeVisible({ timeout: 10000 });
    await expect(detailDrawer.locator('.ant-tag:has-text("PROPOSAL")')).toBeVisible({ timeout: 10000 });
    const activityTab = detailDrawer.locator('.ant-tabs-tab').filter({ hasText: 'Activity' });
    if (await activityTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await activityTab.click();
      await expect(detailDrawer.locator('text=Dokumen proposal baru telah diunggah.')).toBeVisible({ timeout: 10000 });
      console.log('[UI ASSERTION] Proposal stage and upload activity confirmed in Detail Drawer.');
      const overviewTab = detailDrawer.locator('.ant-tabs-tab').filter({ hasText: 'Overview' });
      await overviewTab.click();
    } else {
      console.log('[UI ASSERTION] Proposal stage confirmed in Detail Drawer.');
    }

    // -------------------------------------------------------------------------
    // STEP 09C: PROPOSAL -> NEGOTIATION (PRICE-CHANGE DECISION & NOTE)
    // -------------------------------------------------------------------------
    console.log('\n>>> [STEP 09C] Transition PROPOSAL -> NEGOTIATION & Price-Change Decision');
    const proposalPriceLocator = detailDrawer.locator('text=Budget').locator('..').locator('div:has-text("Rp")');
    await expect(proposalPriceLocator).toBeVisible({ timeout: 10000 });
    const rawProposalPrice = await proposalPriceLocator.innerText();
    const proposalPriceCaptured = rawProposalPrice.trim();
    console.log(`[UI DATA] Captured proposal price from UI: "${proposalPriceCaptured}"`);

    await detailDrawer.locator('.ant-drawer-close').click();
    await expect(detailDrawer).not.toBeVisible({ timeout: 10000 });

    const negoColumn = page.locator('[data-rfd-droppable-id="NEGOTIATION"]');
    await expect(negoColumn).toBeVisible({ timeout: 10000 });

    const negoModal = page.locator('.ant-modal-content:has-text("Selamat Bernegosiasi")');
    await dragCardToColumn(tenderCardInProposal, negoColumn, negoModal);

    await expect(negoModal.locator('text=Apakah ada penyesuaian harga hasil negosiasi?')).toBeVisible({ timeout: 10000 });
    console.log('[UI ASSERTION] Negotiation modal is visible.');

    // Decision: priceChangeDecision ('NO' / 'YES')
    const priceChangeDecision: 'NO' | 'YES' = 'NO';
    let expectedNegoPrice = proposalPriceCaptured;

    if (priceChangeDecision === 'NO') {
      console.log('[UI ACTION] Selecting price-change decision: NO (Harga Tetap)...');
      const radioTetap = negoModal.locator('.ant-radio-wrapper:has-text("Harga Tetap")');
      await radioTetap.click();
      await expect(negoModal.locator('.ant-input-number')).not.toBeVisible();

      const noteInput = negoModal.locator('textarea');
      await noteInput.fill('Negosiasi disepakati dengan harga penawaran tetap tanpa penyesuaian anggaran.');
    } else {
      console.log('[UI ACTION] Selecting price-change decision: YES (Update Harga Baru)...');
      const radioUbah = negoModal.locator('.ant-radio-wrapper:has-text("Update Harga Baru")');
      await radioUbah.click();

      const priceInput = negoModal.locator('.ant-input-number input');
      await expect(priceInput).toBeVisible({ timeout: 5000 });
      await priceInput.fill('1400000000');
      expectedNegoPrice = 'Rp 1.400.000.000';

      const noteInput = negoModal.locator('textarea');
      await noteInput.fill('Negosiasi disepakati dengan penyesuaian harga hasil negosiasi bersama klien.');
    }

    const confirmNegoBtn = negoModal.locator('button:has-text("Simpan & Pindahkan")');
    await expect(confirmNegoBtn).toBeVisible({ timeout: 5000 });
    await confirmNegoBtn.click();

    await expect(negoModal).not.toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    const strayLostAfterNego = page.locator('.ant-modal-content:has-text("Validasi Kartu LOST")');
    if (await strayLostAfterNego.isVisible({ timeout: 1500 }).catch(() => false)) {
      await strayLostAfterNego.locator('button:has-text("Batal")').click();
      await expect(strayLostAfterNego).not.toBeVisible({ timeout: 5000 });
    }

    const tenderCardInNego = negoColumn.locator('.ant-card').filter({ hasText: tenderUniqueName }).first();
    await expect(tenderCardInNego).toBeVisible({ timeout: 15000 });
    console.log(`[UI ASSERTION] Tender card is visible in NEGOTIATION column.`);

    await tenderCardInNego.click();
    await expect(detailDrawer).toBeVisible({ timeout: 10000 });
    await expect(detailDrawer.locator('.ant-tag:has-text("NEGOTIATION")')).toBeVisible({ timeout: 10000 });
    const activityTabNego = detailDrawer.locator('.ant-tabs-tab').filter({ hasText: 'Activity' });
    if (await activityTabNego.isVisible({ timeout: 3000 }).catch(() => false)) {
      await activityTabNego.click();
      await expect(detailDrawer.locator('text=Catatan Negosiasi: Negosiasi disepakati')).toBeVisible({ timeout: 10000 });
      const overviewTabNego = detailDrawer.locator('.ant-tabs-tab').filter({ hasText: 'Overview' });
      await overviewTabNego.click();
    }

    const negoPriceLocator = detailDrawer.locator('text=Budget').locator('..').locator('div:has-text("Rp")');
    const actualNegoPrice = (await negoPriceLocator.innerText()).trim();
    console.log(`[UI DATA] Actual negotiation price in UI: "${actualNegoPrice}"`);

    if (priceChangeDecision === 'NO') {
      expect(actualNegoPrice).toBe(proposalPriceCaptured);
      console.log(`[UI ASSERTION] Negotiation price (${actualNegoPrice}) matches Proposal price (${proposalPriceCaptured}) exactly.`);
    } else {
      expect(actualNegoPrice).not.toBe(proposalPriceCaptured);
      expect(actualNegoPrice).toBe(expectedNegoPrice);
      console.log(`[UI ASSERTION] Negotiation price (${actualNegoPrice}) differs appropriately from Proposal price (${proposalPriceCaptured}).`);
    }

    await detailDrawer.locator('.ant-drawer-close').click();
    await expect(detailDrawer).not.toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // STEP 09D: NEGOTIATION -> WON (UPLOAD SPK PDF)
    // -------------------------------------------------------------------------
    console.log('\n>>> [STEP 09D] Transition Only from NEGOTIATION -> WON & Upload SPK PDF');
    const wonColumn = page.locator('[data-rfd-droppable-id="WON"]');
    await expect(wonColumn).toBeVisible({ timeout: 10000 });

    const wonModal = page.locator('.ant-modal-content:has-text("Upload SPK")');
    await dragCardToColumn(tenderCardInNego, wonColumn, wonModal);

    await expect(wonModal.locator('text=Silakan unggah Surat Perintah Kerja (SPK)')).toBeVisible({ timeout: 10000 });
    console.log('[UI ASSERTION] Modal "🎉 Selamat! Buktikan Kemenangan Ini (Upload SPK)" appeared.');

    const spkFileInput = wonModal.locator('input[type="file"]');
    await spkFileInput.setInputFiles(SAMPLE_PDF_PATH);
    await page.waitForTimeout(600);

    await expect(wonModal.locator('.ant-upload-list-item-name')).toBeVisible({ timeout: 10000 });
    console.log('[UI ASSERTION] SPK PDF file selected in upload area.');

    const uploadSpkBtn = wonModal.locator('button:has-text("Upload SPK & Menang")');
    await expect(uploadSpkBtn).toBeVisible({ timeout: 5000 });
    await uploadSpkBtn.click();

    await expect(wonModal).not.toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const wonCard = wonColumn.locator('.ant-card').filter({ hasText: tenderUniqueName }).first();
    await expect(wonCard).toBeVisible({ timeout: 15000 });
    console.log('[UI ASSERTION] SPK PDF uploaded and Tender moved to WON column!');

    await wonCard.click();
    await expect(detailDrawer).toBeVisible({ timeout: 10000 });
    await expect(detailDrawer.locator('.ant-tag:has-text("WON")')).toBeVisible({ timeout: 10000 });
    await detailDrawer.locator('.ant-drawer-close').click();
    await expect(detailDrawer).not.toBeVisible({ timeout: 10000 });

    // =========================================================================
    // STEP 10: LOGOUT MARKETING VIA UI
    // =========================================================================
    console.log('\n>>> [STEP 10] Logout Marketing via UI');
    await logoutViaUi();

    // =========================================================================
    // STEP 11: LOGIN LEGAL OFFICER VIA UI
    // =========================================================================
    console.log('\n>>> [STEP 11] Login Legal Officer via UI');
    await loginViaUi('legal@epms.com');

    // =========================================================================
    // STEP 12: LEGAL COMPLIANCE REVIEW & APPROVAL VIA UI (/legal/review)
    // =========================================================================
    console.log('\n>>> [STEP 12] Legal Compliance Review & Approval via UI (/legal/review)');
    await page.goto(`${BASE_URL}/legal/review`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const searchQueueInput = page.locator('input[placeholder="Cari No. Kontrak / Klien..."]');
    if (await searchQueueInput.isVisible()) {
      await searchQueueInput.fill(tenderUniqueName);
      await page.waitForTimeout(600);
    }

    const legalQueueItem = page.locator('.ant-card').locator('div').filter({ hasText: tenderUniqueName }).first();
    await expect(legalQueueItem).toBeVisible({ timeout: 15000 });
    await legalQueueItem.click();
    console.log(`[UI ACTION] Selected contract in Legal Task Queue.`);

    await page.waitForTimeout(3000);
    const pdfIframe = page.locator('iframe').first();
    await expect(pdfIframe).toBeVisible({ timeout: 15000 });
    console.log(`[UI ASSERTION] SPK PDF preview iframe rendered.`);

    console.log('[UI ACTION] Checking compliance checklist items...');
    const checkboxes = page.locator('.ant-checkbox-input');
    const checkboxCount = await checkboxes.count();
    console.log(`[UI ACTION] Found ${checkboxCount} compliance checkboxes.`);
    for (let i = 0; i < checkboxCount; i++) {
      const cb = checkboxes.nth(i);
      const isChecked = await cb.isChecked();
      if (!isChecked) {
        await cb.check({ force: true });
        await page.waitForTimeout(100);
      }
    }

    const setujuiRilisBtn = page.locator('button:has-text("Setujui & Rilis")');
    await expect(setujuiRilisBtn).toBeEnabled({ timeout: 10000 });
    await setujuiRilisBtn.click();

    const confirmModal = page.locator('.ant-modal-confirm');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });
    const modalConfirmBtn = confirmModal.locator('button:has-text("Setujui & Rilis ke PMO")');
    await modalConfirmBtn.click();

    await page.waitForTimeout(2000);
    console.log('[UI ASSERTION] Legal Review approved and released to PMO!');

    const handoverModal = page.locator('.ant-modal-content:has-text("Handover ke PMO Berhasil")');
    if (await handoverModal.isVisible({ timeout: 5000 })) {
      await handoverModal.locator('button:has-text("Tutup")').click();
      await expect(handoverModal).not.toBeVisible({ timeout: 10000 });
    }

    // =========================================================================
    // STEP 13: LOGOUT LEGAL OFFICER VIA UI
    // =========================================================================
    console.log('\n>>> [STEP 13] Logout Legal Officer via UI');
    await logoutViaUi();

    // =========================================================================
    // STEP 14: LOGIN PMO VIA UI
    // =========================================================================
    console.log('\n>>> [STEP 14] Login PMO via UI');
    await loginViaUi('pmo@epms.com');

    // =========================================================================
    // STEP 15: PMO ASSIGNS PROJECT MANAGER (pm@epms.com) VIA UI (/project-delivery)
    // =========================================================================
    console.log('\n>>> [STEP 15] PMO assigns Project Manager via UI (/project-delivery)');
    await pmoAssignProjectManager(page, BASE_URL, tenderUniqueName);

    // =========================================================================
    // STEP 16: LOGOUT PMO & LOGIN ASSIGNED PROJECT MANAGER (pm@epms.com)
    // =========================================================================
    console.log('\n>>> [STEP 16] Switch actor: Logout PMO and login as assigned PM');
    await logoutViaUi();
    await loginViaUi('pm@epms.com');

    // =========================================================================
    // STEP 18: PM BUILDS 4/4 OPERATIONAL PLAN (Cost/RAB, WBS 100%, Schedule, Initial Condition)
    // =========================================================================
    console.log('\n>>> [STEP 18] PM builds 4/4 Operational Plan');
    await pmSetupOperationalPlan(page, BASE_URL, tenderUniqueName);

    // =========================================================================
    // STEP 19: PM SUBMITS OPERATIONAL PLAN FOR MANAGEMENT REVIEW
    // =========================================================================
    console.log('\n>>> [STEP 19] PM submits Management Review');
    await submitManagementReview(page);
    await logoutViaUi();

    // =========================================================================
    // STEP 20: GOVERNANCE REVIEW APPROVAL CHAIN (HOPS -> Procurement -> Finance -> Director)
    // =========================================================================
    console.log('\n>>> [STEP 20] Governance review chain approval');
    await completeGovernanceReviewChain(
      page,
      BASE_URL,
      tenderUniqueName,
      async (email) => { await loginViaUi(email); },
      async () => { await logoutViaUi(); }
    );

    // =========================================================================
    // STEP 21: PM EXECUTES FORMAL KICKOFF (PLANNING -> IN_PROGRESS, RAB -> APPROVED)
    // =========================================================================
    console.log('\n>>> [STEP 21] PM executes Formal Kickoff');
    await loginViaUi('pm@epms.com');
    await pmExecuteFormalKickoff(page, BASE_URL, tenderUniqueName);

    // =========================================================================
    // STEP 22: PM CREATES & SUBMITS FRESH PROCUREMENT PACKAGE
    // =========================================================================
    console.log('\n>>> [STEP 22] PM creates and submits Procurement Package from approved RAB');
    const capturedPackageNumber = await pmCreateAndSubmitProcurementPackage(page, BASE_URL, tenderUniqueName);
    await logoutViaUi();

    // =========================================================================
    // STEP 23: PURCHASING CREATES FRESH PR FROM PACKAGE
    // =========================================================================
    console.log('\n>>> [STEP 23] Purchasing creates PR from Package');
    await loginViaUi('purchasing@epms.com');
    const capturedPrNumber = await purchasingCreatePrFromPackage(page, BASE_URL, capturedPackageNumber);
    await logoutViaUi();

    // =========================================================================
    // STEP 24: PR APPROVAL WORKFLOW (Finance -> Director) -> PR APPROVED
    // =========================================================================
    console.log('\n>>> [STEP 24] Complete PR Approval Workflow');
    await completePrApprovalWorkflow(
      page,
      BASE_URL,
      capturedPrNumber,
      async (email) => { await loginViaUi(email); },
      async () => { await logoutViaUi(); }
    );

    // Note: completePrApprovalWorkflow ends with purchasing@epms.com logged in on /procurement

    // =========================================================================
    // STEP 25: FRESH RFQ (strictly OPEN), 3 QUOTATIONS, VENDOR COMPARISON & EVALUATION
    // =========================================================================
    console.log('\n>>> [STEP 25] Fresh RFQ with 3 Quotations & Winner Finalization');
    const capturedRfqNumber = await createAndEvaluateRfq(page, capturedPrNumber);

    // =========================================================================
    // STEP 26: PURCHASE ORDER WITH DETERMINISTIC PAYMENT TERMS (Step 24 Fix)
    // =========================================================================
    console.log('\n>>> [STEP 26] Create Purchase Order with 30% DP + 70% Pelunasan');
    const capturedPoNumber = await createPurchaseOrder(page);

    // =========================================================================
    // TERMINAL VERIFICATION & ARTIFACT RECORDING
    // =========================================================================
    console.log('\n>>> [TERMINAL CHECK] Verifying canonical entities in Procurement DOM...');

    // 1. Verify PR in PR table
    const finalPrCard = page.locator('.ant-card').filter({ hasText: 'Daftar Purchase Request' });
    await expect(finalPrCard).toBeVisible({ timeout: 15000 });
    const finalPrRow = finalPrCard.locator(`tr:has-text("${capturedPrNumber}")`).first();
    await expect(finalPrRow).toBeVisible({ timeout: 10000 });
    console.log(`[TERMINAL CHECK] 1. Canonical PR (${capturedPrNumber}) verified in PR table.`);

    // 2. Verify RFQ tag on PR row
    const finalRfqTag = finalPrRow.locator(`.ant-tag:has-text("${capturedRfqNumber}")`);
    if (await finalRfqTag.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log(`[TERMINAL CHECK] 2. RFQ (${capturedRfqNumber}) verified on PR row.`);
    }

    // 3. Verify PO with status = ISSUED in PO Table
    const poTabFinal = page.locator('.ant-tabs-tab').filter({ hasText: 'Purchase Order' });
    if (await poTabFinal.isVisible({ timeout: 5000 }).catch(() => false)) {
      await poTabFinal.click();
      await page.waitForTimeout(1000);
    }

    const finalPoCard = page.locator('.ant-card').filter({ hasText: 'Daftar Purchase Order' });
    await expect(finalPoCard).toBeVisible({ timeout: 15000 });
    const finalPoRow = finalPoCard.locator(`tr:has-text("${capturedPoNumber}")`).first();
    await expect(finalPoRow).toBeVisible({ timeout: 10000 });
    await expect(finalPoRow.locator('.ant-tag:has-text("ISSUED")')).toBeVisible({ timeout: 10000 });
    console.log(`[TERMINAL CHECK] 3. Canonical PO (${capturedPoNumber}) verified with status ISSUED.`);

    await page.screenshot({ path: path.resolve(__dirname, '../test-results/canonical_e2e_procurement_po_issued.png'), fullPage: true });

    console.log('\n=============================================================');
    console.log('--- DETERMINISTIC CANONICAL FULL LIFECYCLE COMPLETE ---');
    console.log(`Canonical Run ID:  ${tenderUniqueName}`);
    console.log(`Canonical Project: ${tenderUniqueName}`);
    console.log(`Canonical Package: ${capturedPackageNumber}`);
    console.log(`Canonical PR:      ${capturedPrNumber}`);
    console.log(`Canonical RFQ:     ${capturedRfqNumber}`);
    console.log(`Canonical PO:      ${capturedPoNumber} (Status: ISSUED, Terms: 30% / 70%)`);
    console.log('=============================================================\n');

    await logoutViaUi();
  });
});
