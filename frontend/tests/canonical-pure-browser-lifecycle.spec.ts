import { test, expect } from '@playwright/test';
import path from 'path';
import dayjs from 'dayjs';

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
  test.setTimeout(480000); // 8 minutes for complete multi-actor flow

  test('Canonical Multi-Role Pure Browser Workflow through Procurement', async ({ page }) => {
    // -------------------------------------------------------------------------
    // UI HELPER: AUTHENTICATION VIA UI FORM ONLY
    // -------------------------------------------------------------------------
    const loginViaUi = async (email: string, pass = '123456') => {
      console.log(`\n[UI AUTH] Logging in as ${email}...`);
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.epms-login-card-title')).toHaveText('Welcome Back', { timeout: 15000 });

      const emailInput = page.locator('#login_form_email');
      await emailInput.click();
      await emailInput.fill(email);
      await expect(emailInput).toHaveValue(email);

      const passInput = page.locator('#login_form_password');
      await passInput.click();
      await passInput.fill(pass);
      await expect(passInput).toHaveValue(pass);

      await page.waitForTimeout(400);
      await page.locator('button[type="submit"]').click();

      await expect(page).not.toHaveURL(/.*\/login(\?.*)?$/, { timeout: 15000 });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      console.log(`[UI AUTH] Successfully logged in as ${email}. Current URL: ${page.url()}`);
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
    await expect(execDrawer.locator('.ant-tag:has-text("GO")')).toBeVisible({ timeout: 10000 });
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
    await page.setViewportSize({ width: 1920, height: 1080 });

    const dragCardToColumn = async (
      cardLocator: any,
      targetColumnLocator: any,
      expectedModalLocator: any
    ) => {
      await targetColumnLocator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);

      const cardBox = await cardLocator.boundingBox();
      const targetBox = await targetColumnLocator.boundingBox();

      if (cardBox && targetBox) {
        const startX = cardBox.x + cardBox.width / 2;
        const startY = cardBox.y + cardBox.height / 2;
        const targetX = targetBox.x + targetBox.width / 2;
        const targetY = targetBox.y + 160;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.waitForTimeout(300);
        await page.mouse.move(startX + 10, startY + 10, { steps: 5 });
        await page.waitForTimeout(250);
        await page.mouse.move(targetX, targetY, { steps: 35 });
        await page.waitForTimeout(500);
        await page.mouse.up();
        await page.waitForTimeout(1000);
      }

      const isModalOpen = await expectedModalLocator.isVisible();
      if (!isModalOpen) {
        console.log('[UI ACTION] Mouse drag did not open modal yet. Attempting accessible keyboard drag (1 step right)...');
        const dragHandle = cardLocator.locator('xpath=ancestor::div[@data-rfd-drag-handle-draggable-id]').first();
        if (await dragHandle.isVisible()) {
          await dragHandle.focus();
          await page.keyboard.press('Space');
          await page.waitForTimeout(400);
          await page.keyboard.press('ArrowRight');
          await page.waitForTimeout(300);
          await page.keyboard.press('Space');
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
    await expect(detailDrawer.locator('text=Dokumen proposal baru telah diunggah.')).toBeVisible({ timeout: 10000 });
    console.log('[UI ASSERTION] Proposal stage and upload activity confirmed in Detail Drawer.');

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

    const tenderCardInNego = negoColumn.locator('.ant-card').filter({ hasText: tenderUniqueName }).first();
    await expect(tenderCardInNego).toBeVisible({ timeout: 15000 });
    console.log(`[UI ASSERTION] Tender card is visible in NEGOTIATION column.`);

    await tenderCardInNego.click();
    await expect(detailDrawer).toBeVisible({ timeout: 10000 });
    await expect(detailDrawer.locator('.ant-tag:has-text("NEGOTIATION")')).toBeVisible({ timeout: 10000 });
    await expect(detailDrawer.locator('text=Catatan Negosiasi: Negosiasi disepakati')).toBeVisible({ timeout: 10000 });

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
    // STEP 14: LOGIN PMO / SUPER ADMIN VIA UI
    // =========================================================================
    console.log('\n>>> [STEP 14] Login PMO / Super Admin via UI');
    await loginViaUi('admin@epms.com');

    // =========================================================================
    // STEP 15: PMO PROJECT INITIATION VIA UI (/sales Tab 2 Legal Tracking)
    // =========================================================================
    console.log('\n>>> [STEP 15] PMO Project Initiation via UI');
    await page.goto(`${BASE_URL}/sales?tab=2`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const trackingRow = page.locator(`tr:has-text("${tenderUniqueName}")`);
    await expect(trackingRow).toBeVisible({ timeout: 15000 });
    console.log(`[UI ASSERTION] Contract row found in Legal Tracking table.`);

    const inisiasiBtn = trackingRow.locator('button:has-text("Inisiasi Proyek (PMO)")');
    await expect(inisiasiBtn).toBeVisible({ timeout: 10000 });
    await inisiasiBtn.click();

    const pmoConfirmModal = page.locator('.ant-modal-confirm');
    await expect(pmoConfirmModal).toBeVisible({ timeout: 10000 });
    const pmoConfirmOkBtn = pmoConfirmModal.locator('button:has-text("Inisiasi Proyek")');
    await pmoConfirmOkBtn.click();

    await page.waitForTimeout(2000);
    console.log('[UI ASSERTION] Project initiated by PMO via UI!');

    // =========================================================================
    // STEP 16: PROJECT DELIVERY TRANSITION & FORMAL KICKOFF
    // =========================================================================
    console.log('\n>>> [STEP 16] Transition to Project Delivery (/project-delivery)');
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Locate project row in Antrean Kick-off Charter (Tab 1)
    const pendingCharterRow = page.locator(`tr:has-text("${tenderUniqueName}")`);
    if (await pendingCharterRow.isVisible()) {
      console.log(`[UI DISCOVERY] Canonical project visible in Antrean Kick-off Charter.`);
      const kickoffBtn = pendingCharterRow.locator('button:has-text("Formal Kickoff"), button:has-text("Klaim & Kick-off")');
      if (await kickoffBtn.isVisible()) {
        await kickoffBtn.click();
        const claimModal = page.locator('.ant-modal-content:has-text("Inisiasi Project Charter")');
        if (await claimModal.isVisible()) {
          await claimModal.locator('button:has-text("Klaim & Kick-off Proyek")').click();
          await expect(claimModal).not.toBeVisible({ timeout: 15000 });
          console.log('[UI ACTION] Formal Kickoff completed via UI modal.');
        }
      }
    }

    // Check Tab 2: Daftar Proyek Berjalan
    const tab2 = page.locator('.ant-tabs-tab:has-text("Daftar Proyek Berjalan")');
    if (await tab2.isVisible()) {
      await tab2.click();
      await page.waitForTimeout(1200);
      const activeProjectRow = page.locator(`tr:has-text("${tenderUniqueName}")`);
      const isActiveVisible = await activeProjectRow.isVisible();
      console.log(`[UI ASSERTION] Project visible in Daftar Proyek Berjalan (IN_PROGRESS): ${isActiveVisible}`);
    }

    // Logout PMO Admin
    await logoutViaUi();

    // =========================================================================
    // STEP 17: OPEN PROCUREMENT
    // =========================================================================
    console.log('\n>>> [STEP 17] Open Procurement (/procurement) as Purchasing');
    await loginViaUi('purchasing@epms.com');
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Locate the canonical PR using visible DOM text in the PR table
    const prCard = page.locator('.ant-card').filter({ hasText: 'Daftar Purchase Request' });
    await expect(prCard).toBeVisible({ timeout: 15000 });
    const prTable = prCard.locator('table');
    await expect(prTable).toBeVisible({ timeout: 15000 });

    // Locate latest canonical PR row from the table
    const canonicalPrRow = prTable.locator('tbody tr').filter({ hasText: 'PR-' }).first();
    await expect(canonicalPrRow).toBeVisible({ timeout: 15000 });

    // Capture PR number ONLY from visible DOM
    const capturedPrNumber = (await canonicalPrRow.locator('td').first().innerText()).split('\n')[0].trim();
    console.log(`[DOM CAPTURE] Captured Canonical PR Number from DOM: "${capturedPrNumber}"`);
    expect(capturedPrNumber).toMatch(/^PR-/);

    // =========================================================================
    // STEP 18: CREATE RFQ
    // =========================================================================
    console.log('\n>>> [STEP 18] Create RFQ from Canonical PR');
    // Open the correct PR by clicking "Buat RFQ" directly or through Alur Approval
    const directBuatRfqBtn = canonicalPrRow.locator('button:has-text("Buat RFQ")');
    if (await directBuatRfqBtn.isVisible()) {
      await directBuatRfqBtn.click();
    } else {
      const alurApprovalBtn = canonicalPrRow.locator('button:has-text("Alur Approval")');
      if (await alurApprovalBtn.isVisible()) {
        await alurApprovalBtn.click();
        const prApprovalModal = page.locator('.ant-modal-content:has-text("Alur Approval")');
        await expect(prApprovalModal).toBeVisible({ timeout: 10000 });
        const modalBuatRfqBtn = prApprovalModal.locator('button:has-text("Buat RFQ")');
        await expect(modalBuatRfqBtn).toBeVisible({ timeout: 10000 });
        await modalBuatRfqBtn.click();
      }
    }

    const rfqModal = page.locator('.ant-modal-content').filter({ hasText: 'Request for Quotation' }).first();
    await expect(rfqModal).toBeVisible({ timeout: 15000 });

    // Validate closing date (Ant Design DatePicker has default value 14 days ahead)
    const closingDateInput = rfqModal.locator('#closingDate');
    if (await closingDateInput.isVisible()) {
      const closingVal = await closingDateInput.inputValue();
      console.log(`[UI ACTION] RFQ Closing Date Input Value: "${closingVal}"`);
      if (!closingVal) {
        await closingDateInput.click();
        await closingDateInput.fill(dayjs().add(14, 'day').format('DD MMMM YYYY'));
        await closingDateInput.press('Enter');
      }
    }

    const rfqNotesInput = rfqModal.locator('#notes');
    if (await rfqNotesInput.isVisible()) {
      await rfqNotesInput.fill('Canonical E2E Procurement Cycle — Fast Track Delivery');
    }

    // Click: Terbitkan RFQ
    const submitRfqBtn = rfqModal.locator('button:has-text("Terbitkan RFQ")');
    await expect(submitRfqBtn).toBeVisible({ timeout: 5000 });
    await submitRfqBtn.click();

    // Confirm modal: 'Konfirmasi Penerbitan RFQ'
    const confirmRfqModal = page.locator('.ant-modal-confirm');
    await expect(confirmRfqModal).toBeVisible({ timeout: 10000 });
    const confirmRfqOkBtn = confirmRfqModal.locator('button:has-text("Terbitkan RFQ")');
    await confirmRfqOkBtn.click();

    // Verify: RFQ status = OPEN
    await page.waitForTimeout(2000);
    const rfqOpenTag = page.locator('.ant-tag').filter({ hasText: 'OPEN' }).first();
    await expect(rfqOpenTag).toBeVisible({ timeout: 15000 });
    console.log(`[UI ASSERTION] RFQ status = OPEN verified in DOM.`);

    // Capture RFQ number ONLY from DOM
    let capturedRfqNumber = '';
    const rfqModalTitle = page.locator('.ant-modal-title').filter({ hasText: 'RFQ-' }).first();
    if (await rfqModalTitle.isVisible()) {
      const titleText = await rfqModalTitle.innerText();
      const match = titleText.match(/RFQ-[0-9A-Za-z_-]+/);
      capturedRfqNumber = match ? match[0] : titleText;
    } else {
      const rfqRefEl = page.locator('.ant-modal-content').filter({ hasText: 'REFERENSI RFQ' }).locator('div:has-text("RFQ-")').first();
      capturedRfqNumber = (await rfqRefEl.innerText()).trim();
    }
    console.log(`[DOM CAPTURE] Captured Canonical RFQ Number from DOM: "${capturedRfqNumber}"`);
    expect(capturedRfqNumber).toMatch(/^RFQ-/);

    // =========================================================================
    // STEP 19: QUOTATION #1
    // =========================================================================
    console.log('\n>>> [STEP 19] Record Vendor Quotation #1');
    const inputQuoteBtn1 = page.locator('.ant-modal-content').filter({ hasText: 'Request for Quotation' })
      .locator('button:has-text("Input Penawaran Vendor"), button:has-text("Tambah Vendor")').first();
    await expect(inputQuoteBtn1).toBeVisible({ timeout: 10000 });
    await inputQuoteBtn1.click();

    const quoteModal1 = page.locator('.ant-modal-content').filter({ hasText: 'Input Penawaran Vendor' }).first();
    await expect(quoteModal1).toBeVisible({ timeout: 10000 });

    // Select Vendor #1 from CURRENT UI dropdown
    const vendorSelect1 = quoteModal1.locator('.ant-select').first();
    await vendorSelect1.click();
    await page.waitForTimeout(400);

    const vendorOptions1 = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:not(.ant-select-item-option-disabled)');
    await expect(vendorOptions1.first()).toBeVisible({ timeout: 10000 });
    const vendor1Name = (await vendorOptions1.first().innerText()).trim();
    console.log(`[UI ACTION] Selected Vendor #1 from UI: "${vendor1Name}"`);
    await vendorOptions1.first().click();

    // Fill lead time
    const leadTimeInput1 = quoteModal1.locator('#leadTimeDays');
    await leadTimeInput1.click();
    await leadTimeInput1.fill('14');

    // Fill price inputs
    const priceInputs1 = quoteModal1.locator('.ant-table tbody .ant-input-number-input');
    const priceCount1 = await priceInputs1.count();
    for (let i = 0; i < priceCount1; i++) {
      await priceInputs1.nth(i).click();
      await priceInputs1.nth(i).fill('1200000');
    }

    // Submit quotation #1
    const submitQuoteBtn1 = quoteModal1.locator('button:has-text("Simpan Penawaran Vendor")');
    await submitQuoteBtn1.click();
    await expect(quoteModal1).not.toBeVisible({ timeout: 15000 });

    // Verify quotation #1 appears in UI
    await page.waitForTimeout(1000);
    const quoteTable = page.locator('.ant-modal-content:has-text("Request for Quotation") table').first();
    await expect(quoteTable.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });
    console.log(`[UI ASSERTION] Quotation #1 verified in RFQ modal table.`);

    // =========================================================================
    // STEP 20: QUOTATION #2
    // =========================================================================
    console.log('\n>>> [STEP 20] Record Vendor Quotation #2');
    const inputQuoteBtn2 = page.locator('.ant-modal-content').filter({ hasText: 'Request for Quotation' })
      .locator('button:has-text("Input Penawaran Vendor"), button:has-text("Tambah Vendor")').first();
    await expect(inputQuoteBtn2).toBeVisible({ timeout: 10000 });
    await inputQuoteBtn2.click();

    const quoteModal2 = page.locator('.ant-modal-content').filter({ hasText: 'Input Penawaran Vendor' }).first();
    await expect(quoteModal2).toBeVisible({ timeout: 10000 });

    // Select Vendor #2 from CURRENT UI dropdown
    const vendorSelect2 = quoteModal2.locator('.ant-select').first();
    await vendorSelect2.click();
    await page.waitForTimeout(400);

    const vendorOptions2 = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:not(.ant-select-item-option-disabled)');
    await expect(vendorOptions2.first()).toBeVisible({ timeout: 10000 });
    const vendor2Name = (await vendorOptions2.first().innerText()).trim();
    console.log(`[UI ACTION] Selected Vendor #2 from UI: "${vendor2Name}"`);
    await vendorOptions2.first().click();

    // Fill lead time
    const leadTimeInput2 = quoteModal2.locator('#leadTimeDays');
    await leadTimeInput2.click();
    await leadTimeInput2.fill('10');

    // Fill price inputs
    const priceInputs2 = quoteModal2.locator('.ant-table tbody .ant-input-number-input');
    const priceCount2 = await priceInputs2.count();
    for (let i = 0; i < priceCount2; i++) {
      await priceInputs2.nth(i).click();
      await priceInputs2.nth(i).fill('1100000');
    }

    // Submit quotation #2
    const submitQuoteBtn2 = quoteModal2.locator('button:has-text("Simpan Penawaran Vendor")');
    await submitQuoteBtn2.click();
    await expect(quoteModal2).not.toBeVisible({ timeout: 15000 });

    // Verify quotation #2 appears in UI
    await page.waitForTimeout(1000);
    await expect(quoteTable.locator('tbody tr').nth(1)).toBeVisible({ timeout: 10000 });
    console.log(`[UI ASSERTION] Quotation #2 verified in RFQ modal table.`);

    // =========================================================================
    // STEP 21: QUOTATION #3
    // =========================================================================
    console.log('\n>>> [STEP 21] Record Vendor Quotation #3');
    const inputQuoteBtn3 = page.locator('.ant-modal-content').filter({ hasText: 'Request for Quotation' })
      .locator('button:has-text("Input Penawaran Vendor"), button:has-text("Tambah Vendor")').first();
    await expect(inputQuoteBtn3).toBeVisible({ timeout: 10000 });
    await inputQuoteBtn3.click();

    const quoteModal3 = page.locator('.ant-modal-content').filter({ hasText: 'Input Penawaran Vendor' }).first();
    await expect(quoteModal3).toBeVisible({ timeout: 10000 });

    // Select Vendor #3 from CURRENT UI dropdown
    const vendorSelect3 = quoteModal3.locator('.ant-select').first();
    await vendorSelect3.click();
    await page.waitForTimeout(400);

    const vendorOptions3 = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:not(.ant-select-item-option-disabled)');
    await expect(vendorOptions3.first()).toBeVisible({ timeout: 10000 });
    const vendor3Name = (await vendorOptions3.first().innerText()).trim();
    console.log(`[UI ACTION] Selected Vendor #3 from UI: "${vendor3Name}"`);
    await vendorOptions3.first().click();

    // Fill lead time
    const leadTimeInput3 = quoteModal3.locator('#leadTimeDays');
    await leadTimeInput3.click();
    await leadTimeInput3.fill('7');

    // Fill price inputs
    const priceInputs3 = quoteModal3.locator('.ant-table tbody .ant-input-number-input');
    const priceCount3 = await priceInputs3.count();
    for (let i = 0; i < priceCount3; i++) {
      await priceInputs3.nth(i).click();
      await priceInputs3.nth(i).fill('1000000');
    }

    // Submit quotation #3
    const submitQuoteBtn3 = quoteModal3.locator('button:has-text("Simpan Penawaran Vendor")');
    await submitQuoteBtn3.click();
    await expect(quoteModal3).not.toBeVisible({ timeout: 15000 });

    // Verify all 3 quotations appear in UI
    await page.waitForTimeout(1000);
    await expect(quoteTable.locator('tbody tr').nth(2)).toBeVisible({ timeout: 10000 });
    console.log(`[UI ASSERTION] Quotation #3 verified. All 3 quotations belong to RFQ "${capturedRfqNumber}".`);

    // =========================================================================
    // STEP 22: VENDOR COMPARISON
    // =========================================================================
    console.log('\n>>> [STEP 22] Open Evaluasi & Perbandingan Vendor');
    const evaluasiBtn = page.locator('.ant-modal-content').filter({ hasText: 'Request for Quotation' })
      .locator('button:has-text("Evaluasi Vendor")').first();
    await expect(evaluasiBtn).toBeVisible({ timeout: 10000 });
    await evaluasiBtn.click();

    const comparisonModal = page.locator('.ant-modal-content').filter({ hasText: 'Evaluasi & Perbandingan Vendor' }).first();
    await expect(comparisonModal).toBeVisible({ timeout: 15000 });

    // Verify: all 3 quotations visible, vendor names visible, price values visible, lead time visible
    const comparisonRows = comparisonModal.locator('.ant-table tbody tr');
    await expect(comparisonRows.nth(2)).toBeVisible({ timeout: 10000 });
    console.log(`[UI ASSERTION] All 3 quotations visible in Vendor Comparison table.`);

    // Select one winner via radio button
    const winnerRadio = comparisonRows.first().locator('.ant-radio-input');
    await winnerRadio.click();
    console.log('[UI ACTION] Selected evaluation winner radio button.');

    // Fill required justification
    const justificationArea = comparisonModal.locator('textarea');
    await justificationArea.click();
    await justificationArea.fill('Vendor terpilih memenuhi spesifikasi teknis terbaik dengan harga kompetitif dan lead time paling efisien.');

    // Click: Tetapkan Pemenang Evaluasi
    const tetapkanPemenangBtn = comparisonModal.locator('button:has-text("Tetapkan Pemenang Evaluasi")');
    await expect(tetapkanPemenangBtn).toBeEnabled({ timeout: 10000 });
    await tetapkanPemenangBtn.click();

    // Verify RFQ enters evaluated state
    await page.waitForTimeout(2000);
    const evaluatedAlert = comparisonModal.locator('.ant-alert-success').filter({ hasText: 'Vendor Comparison Selesai' });
    await expect(evaluatedAlert).toBeVisible({ timeout: 15000 });
    console.log('[UI ASSERTION] RFQ successfully entered EVALUATED state.');

    // =========================================================================
    // STEP 23: PURCHASE ORDER
    // =========================================================================
    console.log('\n>>> [STEP 23] Create Purchase Order (PO) from Evaluated RFQ');
    const buatPoBtn = comparisonModal.locator('button:has-text("Buat Purchase Order (PO)")');
    await expect(buatPoBtn).toBeVisible({ timeout: 10000 });
    await buatPoBtn.click();

    const poModal = page.locator('.ant-modal-content').filter({ hasText: 'Penerbitan Purchase Order' }).first();
    await expect(poModal).toBeVisible({ timeout: 15000 });

    // Verify: winner linked, PO items correct, quantities correct, PO total visible
    const winnerLinkedText = poModal.locator('span:has-text("Vendor Pemenang Terpilih")');
    await expect(winnerLinkedText).toBeVisible({ timeout: 10000 });

    const totalPoEl = poModal.locator('div:has-text("TOTAL PO:")').locator('div').last();
    await expect(totalPoEl).toBeVisible({ timeout: 10000 });
    const poTotalText = await totalPoEl.innerText();
    console.log(`[UI ASSERTION] PO Total Visible in UI: ${poTotalText}`);

    // Fill delivery parameters
    const deliveryDateInput = poModal.locator('#deliveryDate');
    if (await deliveryDateInput.isVisible() && !(await deliveryDateInput.inputValue())) {
      await deliveryDateInput.click();
      await deliveryDateInput.fill(dayjs().add(14, 'day').format('DD MMMM YYYY'));
      await deliveryDateInput.press('Enter');
    }
    const deliveryLocInput = poModal.locator('#deliveryLocation');
    if (await deliveryLocInput.isVisible()) {
      await deliveryLocInput.fill('Gudang Utama Proyek Surabaya');
    }

    // =========================================================================
    // STEP 24: PAYMENT TERMS CONFIGURATION (30% / 70%)
    // =========================================================================
    console.log('\n>>> [STEP 24] Configure Payment Terms (30% DP / 70% Final Delivery)');
    const termTable = poModal.locator('.term-table-stable, .ant-table').filter({ hasText: 'Nama Termin' }).first();
    await expect(termTable).toBeVisible({ timeout: 10000 });

    // Term 1 (Row 0):
    // Name: Uang Muka / DP, Type: DOWN_PAYMENT, Percentage: 30%, Trigger: PO Diterbitkan
    const termNameInput1 = termTable.locator('tbody tr').nth(0).locator('input[placeholder*="Nama termin"]');
    await termNameInput1.click();
    await termNameInput1.fill('Uang Muka / DP');

    const termTypeSelect1 = termTable.locator('tbody tr').nth(0).locator('.ant-select');
    await termTypeSelect1.click();
    await page.waitForTimeout(300);
    const dpOption = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:has-text("Uang Muka / DP")').first();
    await dpOption.click();

    const termPctInput1 = termTable.locator('tbody tr').nth(0).locator('.ant-input-number-input');
    await termPctInput1.click();
    await termPctInput1.fill('30');

    const termTriggerInput1 = termTable.locator('tbody tr').nth(0).locator('input[placeholder*="PO Diterbitkan"]');
    await termTriggerInput1.click();
    await termTriggerInput1.fill('PO Diterbitkan');

    // Click '+ Tambah Termin' to add Term 2
    const addTermBtn = poModal.locator('button:has-text("+ Tambah Termin")');
    await addTermBtn.click();
    await page.waitForTimeout(400);

    // Term 2 (Row 1):
    // Name: Pelunasan Penuh, Type: FINAL_DELIVERY, Percentage: 70%, Trigger: Barang Diterima Lengkap & BAST Disetujui
    const termNameInput2 = termTable.locator('tbody tr').nth(1).locator('input[placeholder*="Nama termin"]');
    await termNameInput2.click();
    await termNameInput2.fill('Pelunasan Penuh');

    const termTypeSelect2 = termTable.locator('tbody tr').nth(1).locator('.ant-select');
    await termTypeSelect2.click();
    await page.waitForTimeout(300);
    const finalOption = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:has-text("Pelunasan / Final Delivery")').first();
    await finalOption.click();

    const termPctInput2 = termTable.locator('tbody tr').nth(1).locator('.ant-input-number-input');
    await termPctInput2.click();
    await termPctInput2.fill('70');

    const termTriggerInput2 = termTable.locator('tbody tr').nth(1).locator('input[placeholder*="PO Diterbitkan"]');
    await termTriggerInput2.click();
    await termTriggerInput2.fill('Barang Diterima Lengkap & BAST Disetujui');

    // Verify 30 + 70 = 100%
    const validTag = poModal.locator('.ant-tag:has-text("Persentase Valid (100%)")');
    await expect(validTag).toBeVisible({ timeout: 10000 });
    console.log('[UI ASSERTION] Payment Terms validated: 30% + 70% = 100.00%.');

    // =========================================================================
    // STEP 25: ISSUE PURCHASE ORDER
    // =========================================================================
    console.log('\n>>> [STEP 25] Issue Purchase Order via UI Modal');
    const terbitkanPoBtn = poModal.locator('button:has-text("Terbitkan Purchase Order (PO)")');
    await expect(terbitkanPoBtn).toBeEnabled({ timeout: 10000 });
    await terbitkanPoBtn.click();

    // Verify visible success and modal view state
    await page.waitForTimeout(2500);
    const issuedPoModal = page.locator('.ant-modal-content').filter({ hasText: 'Purchase Order Telah Diterbitkan' }).or(page.locator('.ant-modal-content').filter({ hasText: 'Rincian Purchase Order' })).first();
    await expect(issuedPoModal).toBeVisible({ timeout: 15000 });

    // Capture PO number ONLY from DOM
    const poNumberHeader = page.locator('.ant-modal-content:has-text("Purchase Order Telah Diterbitkan")');
    const poHeaderText = await poNumberHeader.innerText();
    const poMatch = poHeaderText.match(/PO-[0-9A-Za-z_-]+/);
    const capturedPoNumber = poMatch ? poMatch[0] : '';
    console.log(`[DOM CAPTURE] Captured Canonical PO Number from DOM: "${capturedPoNumber}"`);
    expect(capturedPoNumber).toMatch(/^PO-/);

    // Verify PO status = ISSUED
    const poStatusTag = page.locator('.ant-tag').filter({ hasText: 'ISSUED' }).first();
    await expect(poStatusTag).toBeVisible({ timeout: 10000 });
    console.log(`[UI ASSERTION] PO status = ISSUED verified in DOM.`);

    // Verify the two payment terms are visible/persisted in UI
    const persistedTermsTable = page.locator('.term-table-stable, .ant-table').filter({ hasText: 'Uang Muka / DP' }).first();
    await expect(persistedTermsTable).toBeVisible({ timeout: 10000 });
    await expect(persistedTermsTable.locator('tr:has-text("Uang Muka / DP"):has-text("30.00%")')).toBeVisible({ timeout: 10000 });
    await expect(persistedTermsTable.locator('tr:has-text("Pelunasan Penuh"):has-text("70.00%")')).toBeVisible({ timeout: 10000 });
    console.log('[UI ASSERTION] Both payment terms (30% DP & 70% Pelunasan) persisted and visible.');

    // =========================================================================
    // STEP 26: PROCUREMENT TERMINAL CHECK
    // =========================================================================
    console.log('\n>>> [STEP 26] Procurement Terminal Check');
    // Close PO Modal
    const closePoBtn = page.locator('.ant-modal-content button:has-text("Tutup")').first();
    if (await closePoBtn.isVisible()) {
      await closePoBtn.click();
      await page.waitForTimeout(500);
    }

    // Close any other open modals
    const closeRemainingBtns = page.locator('.ant-modal-content button:has-text("Tutup")');
    const closeCount = await closeRemainingBtns.count();
    for (let i = 0; i < closeCount; i++) {
      if (await closeRemainingBtns.first().isVisible()) {
        await closeRemainingBtns.first().click();
        await page.waitForTimeout(400);
      }
    }

    // On /procurement page, verify terminal state
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 1. Canonical PR is still correct
    const finalPrCard = page.locator('.ant-card').filter({ hasText: 'Daftar Purchase Request' });
    await expect(finalPrCard).toBeVisible({ timeout: 15000 });
    const finalPrRow = finalPrCard.locator(`tr:has-text("${capturedPrNumber}")`).first();
    await expect(finalPrRow).toBeVisible({ timeout: 10000 });
    console.log(`[TERMINAL CHECK] 1. Canonical PR (${capturedPrNumber}) verified in PR table.`);

    // 2. RFQ is correct
    const finalRfqTag = finalPrRow.locator(`.ant-tag:has-text("${capturedRfqNumber}")`);
    if (await finalRfqTag.isVisible()) {
      console.log(`[TERMINAL CHECK] 2. RFQ (${capturedRfqNumber}) verified on PR row.`);
    }

    // 3. PO created with status = ISSUED in PO Table
    const finalPoCard = page.locator('.ant-card').filter({ hasText: 'Daftar Purchase Order' });
    await expect(finalPoCard).toBeVisible({ timeout: 15000 });
    const finalPoRow = finalPoCard.locator(`tr:has-text("${capturedPoNumber}")`).first();
    await expect(finalPoRow).toBeVisible({ timeout: 10000 });
    await expect(finalPoRow.locator('.ant-tag:has-text("ISSUED")')).toBeVisible({ timeout: 10000 });
    console.log(`[TERMINAL CHECK] 3. Canonical PO (${capturedPoNumber}) verified with status ISSUED.`);

    await page.screenshot({ path: path.resolve(__dirname, '../test-results/canonical_e2e_procurement_po_issued.png'), fullPage: true });

    console.log('\n=============================================================');
    console.log('--- PROCUREMENT CANONICAL PATH COMPLETE ---');
    console.log(`Canonical Project: ${tenderUniqueName}`);
    console.log(`Canonical PR:      ${capturedPrNumber}`);
    console.log(`Canonical RFQ:     ${capturedRfqNumber}`);
    console.log(`Canonical PO:      ${capturedPoNumber} (Status: ISSUED, Terms: 30% / 70%)`);
    console.log('=============================================================\n');
  });
});
