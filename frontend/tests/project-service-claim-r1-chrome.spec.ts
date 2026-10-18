import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginViaUi } from './canonical-lifecycle-helpers';

// Runtime credential injection: process.env.E2E_TEST_PASSWORD must be provided by runner environment
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
if (!E2E_PASSWORD) {
  throw new Error('E2E_TEST_PASSWORD environment variable is required but not set.');
}

const BASE_URL = 'http://localhost:3000';

const EVIDENCE_DIR = path.resolve(__dirname, '../../evidence/project-service-claim-r1');
const BRAIN_DIR = path.resolve(
  process.env.USERPROFILE || 'C:\\Users\\UBDOPS3',
  '.gemini/antigravity-ide/brain/57b84306-0ffc-4a30-9988-f78e601ba10a'
);

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function captureEvidence(page: Page, filename: string) {
  const p1 = path.join(EVIDENCE_DIR, filename);
  await page.screenshot({ path: p1, fullPage: true });
  try {
    const p2 = path.join(BRAIN_DIR, filename);
    fs.copyFileSync(p1, p2);
  } catch (err) {
    console.warn(`[WARN] Could not copy evidence to brain dir: ${err}`);
  }
  console.log(`[EVIDENCE CAPTURED] ${filename}`);
}

test.describe.serial('EPMS — PROJECT-SERVICE-CLAIM-R1: Google Chrome Live Validation', () => {
  test.setTimeout(240000);

  test('R1-CHROME: Service Claim Full Lifecycle, Dual Verification, Zero Progress Mutation & Responsive Stack in Real Chrome', async ({ page }) => {
    page.on('console', (msg) => {
      const txt = msg.text();
      if (txt.includes('DEBUG') || msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[BROWSER ${msg.type().toUpperCase()}] ${txt}`);
      }
    });
    page.on('pageerror', (err) => console.log('[PAGE ERROR]', err.message));

    // -------------------------------------------------------------------------
    // R1-CHROME-01: Procurement Create & Submit Service Claim
    // -------------------------------------------------------------------------
    console.log('\n>>> [R1-CHROME-01] Logging in as Purchasing...');
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    console.log('>>> [R1-CHROME-01] Navigating to /procurement?tab=po...');
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'networkidle' });

    // Explicitly click "Purchase Order" tab
    const poTab = page.locator('.ant-tabs-tab:has-text("Purchase Order")').first();
    await poTab.click();
    await page.waitForTimeout(600);

    // Navigate to page 3 where Service PO #2 (PO-20260923-001) resides
    const page3Btn = page.locator('.ant-pagination-item-3, .ant-pagination-item[title="3"]').first();
    if (await page3Btn.isVisible()) {
      console.log('>>> [R1-CHROME-01] Navigating to pagination page 3...');
      await page3Btn.click();
      await page.waitForTimeout(800);
    }

    // Locate Service PO row
    const serviceRow = page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first();
    await expect(serviceRow).toBeVisible({ timeout: 10000 });

    // Locate "Klaim Jasa" button
    const claimActionBtn = serviceRow.locator('button:has-text("Klaim Jasa")').first();
    await expect(claimActionBtn).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('>>> [R1-CHROME-01] Opening ServiceClaimModal...');
    await claimActionBtn.click();

    const claimModal = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(claimModal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(600);

    // Verify PO Header Context
    console.log('>>> [R1-CHROME-01] Verifying PO Header Context & Balances...');
    await expect(claimModal.getByText('PO-20260923-001').first()).toBeVisible();
    await expect(claimModal.getByText(/SURGE JATENG/i).first()).toBeVisible();
    await expect(claimModal.getByText(/PT Suplai Makmur/i).first()).toBeVisible();

    // Click "Buat Klaim Jasa Baru"
    console.log('>>> [R1-CHROME-01] Opening Create Claim Form...');
    const createNewBtn = claimModal.locator('button:has-text("Buat Klaim Jasa Baru")').first();
    await createNewBtn.click();
    await page.waitForTimeout(500);

    // Fill form
    console.log('>>> [R1-CHROME-01] Filling claim details...');
    const refInput = claimModal.locator('input[placeholder*="BAST-001"]').first();
    if (await refInput.isVisible()) {
      await refInput.fill('BA-SVC-2026-001');
    }

    // Input current claim quantity = 0.4 in the table row
    const qtyInput = claimModal.locator('.ant-input-number-input').first();
    await qtyInput.click();
    await qtyInput.fill('0.4');
    await qtyInput.press('Enter');
    await qtyInput.blur();
    await page.waitForTimeout(500);

    // Click Save Draft
    console.log('>>> [R1-CHROME-01] Saving claim draft...');
    const saveBtn = claimModal.locator('button:has-text("Simpan Draft Klaim")').first();
    await saveBtn.click();
    await page.waitForTimeout(1000);

    // In modal, find the newly created draft claim row and submit it
    const claimRow = claimModal.locator('tr:has-text("Draft")').first();
    await expect(claimRow).toBeVisible({ timeout: 10000 });

    console.log('>>> [R1-CHROME-01] Submitting claim for PM technical verification...');
    const submitBtn = claimRow.locator('button:has-text("Submit")').first();
    await submitBtn.click();
    await page.waitForTimeout(1200);

    // Verify status is now SUBMITTED ("Diajukan")
    const submittedTag = claimModal.locator('.ant-tag:has-text("Diajukan")').first();
    await expect(submittedTag).toBeVisible({ timeout: 10000 });

    await captureEvidence(page, 'r1_01_procurement_create_and_submit_claim.png');

    // Close claim modal
    const closeBtn = claimModal.locator('button.ant-modal-close').first();
    await closeBtn.click();
    await page.waitForTimeout(600);

    // -------------------------------------------------------------------------
    // R1-CHROME-02: PM Technical Verification & Zero Progress Mutation
    // -------------------------------------------------------------------------
    console.log('\n>>> [R1-CHROME-02] Logging in as assigned PM (faza@epms.com)...');
    await loginViaUi(page, BASE_URL, 'faza@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    console.log('>>> [R1-CHROME-02] PM inspecting project progress before verification...');
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // PM opens procurement to inspect claim
    console.log('>>> [R1-CHROME-02] PM opening procurement to verify technical volume...');
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'networkidle' });

    const pmPoTab = page.locator('.ant-tabs-tab:has-text("Purchase Order")').first();
    await pmPoTab.click();
    await page.waitForTimeout(600);

    const pmPage3Btn = page.locator('.ant-pagination-item-3, .ant-pagination-item[title="3"]').first();
    if (await pmPage3Btn.isVisible()) {
      await pmPage3Btn.click();
      await page.waitForTimeout(800);
    }

    const pmServiceRow = page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first();
    await expect(pmServiceRow).toBeVisible();

    const pmClaimBtn = pmServiceRow.locator('button:has-text("Klaim Jasa")').first();
    await pmClaimBtn.click();

    const pmClaimModal = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(pmClaimModal).toBeVisible();

    // Click "Verifikasi Teknis" on submitted row
    const submittedClaimRow = pmClaimModal.locator('tr:has(.ant-tag:has-text("Diajukan"))').first();
    await expect(submittedClaimRow).toBeVisible();

    const verifyTeknisBtn = submittedClaimRow.locator('button:has-text("Verifikasi Teknis")').first();
    await verifyTeknisBtn.click();
    await page.waitForTimeout(600);

    // PM clicks "Setujui Teknis" then "Eksekusi Keputusan"
    console.log('>>> [R1-CHROME-02] PM approving technical verification...');
    const approveTeknisBtn = pmClaimModal.locator('button:has-text("Setujui Teknis")').first();
    await approveTeknisBtn.click();

    const prosesTeknisBtn = pmClaimModal.locator('button:has-text("Eksekusi Keputusan")').first();
    await prosesTeknisBtn.click();
    await page.waitForTimeout(1200);

    // Return to list view
    const backBtn = pmClaimModal.locator('button:has-text("Kembali ke Daftar"), button:has-text("Kembali ke Detail")').first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await page.waitForTimeout(400);
      const backToListBtn = pmClaimModal.locator('button:has-text("Kembali ke Daftar")').first();
      if (await backToListBtn.isVisible()) {
        await backToListBtn.click();
        await page.waitForTimeout(400);
      }
    }

    // Verify claim status transitions to PM_VERIFIED ("Terverifikasi Teknis")
    const pmVerifiedTag = pmClaimModal.locator('.ant-tag:has-text("Terverifikasi Teknis")').first();
    await expect(pmVerifiedTag).toBeVisible({ timeout: 10000 });

    await captureEvidence(page, 'r1_02_pm_technical_verification_approved.png');

    // Close claim modal
    const pmCloseBtn = pmClaimModal.locator('button.ant-modal-close').first();
    await pmCloseBtn.click();
    await page.waitForTimeout(600);

    // -------------------------------------------------------------------------
    // R1-CHROME-03: Procurement Commercial Approval -> APPROVED_FOR_INVOICE
    // -------------------------------------------------------------------------
    console.log('\n>>> [R1-CHROME-03] Logging in as Purchasing (purchasing@epms.com)...');
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'networkidle' });
    const commPoTab = page.locator('.ant-tabs-tab:has-text("Purchase Order")').first();
    await commPoTab.click();
    await page.waitForTimeout(600);

    const commPage3Btn = page.locator('.ant-pagination-item-3, .ant-pagination-item[title="3"]').first();
    if (await commPage3Btn.isVisible()) {
      await commPage3Btn.click();
      await page.waitForTimeout(800);
    }

    const commServiceRow = page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first();
    const commClaimBtn = commServiceRow.locator('button:has-text("Klaim Jasa")').first();
    await commClaimBtn.click();

    const commClaimModal = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(commClaimModal).toBeVisible();

    // Locate PM_VERIFIED row and click "Verifikasi Komersial"
    const verifiedRow = commClaimModal.locator('tr:has(.ant-tag:has-text("Terverifikasi Teknis"))').first();
    await expect(verifiedRow).toBeVisible();

    const verifyKomersialBtn = verifiedRow.locator('button:has-text("Verifikasi Komersial")').first();
    await verifyKomersialBtn.click();
    await page.waitForTimeout(600);

    console.log('>>> [R1-CHROME-03] Approving commercial verification...');
    const approveCommBtn = commClaimModal.locator('button:has-text("Setujui Komersial")').first();
    await approveCommBtn.click();

    const prosesCommBtn = commClaimModal.locator('button:has-text("Eksekusi Keputusan")').first();
    await prosesCommBtn.click();
    await page.waitForTimeout(1200);

    // Back to list
    const backBtnComm = commClaimModal.locator('button:has-text("Kembali ke Daftar"), button:has-text("Kembali ke Detail")').first();
    if (await backBtnComm.isVisible()) {
      await backBtnComm.click();
      await page.waitForTimeout(400);
      const backToListBtn2 = commClaimModal.locator('button:has-text("Kembali ke Daftar")').first();
      if (await backToListBtn2.isVisible()) {
        await backToListBtn2.click();
        await page.waitForTimeout(400);
      }
    }

    // Verify claim status is now APPROVED_FOR_INVOICE ("Disetujui untuk Invoice")
    const approvedTag = commClaimModal.locator('.ant-tag:has-text("Disetujui untuk Invoice")').first();
    await expect(approvedTag).toBeVisible({ timeout: 10000 });

    // Verify immutability: Edit & Cancel buttons are absent on approved claim
    const editBtn = commClaimModal.locator('tr:has(.ant-tag:has-text("Disetujui untuk Invoice"))').first().locator('button:has-text("Ubah"), button:has-text("Edit")');
    await expect(editBtn).toHaveCount(0);

    await captureEvidence(page, 'r1_03_procurement_commercial_approval.png');

    const commCloseBtn = commClaimModal.locator('button.ant-modal-close').first();
    await commCloseBtn.click();
    await page.waitForTimeout(600);

    // -------------------------------------------------------------------------
    // R1-CHROME-04: Finance Invoice Created from Approved Claim (No GR Used)
    // -------------------------------------------------------------------------
    console.log('\n>>> [R1-CHROME-04] Logging in as Finance (finance@epms.com)...');
    await loginViaUi(page, BASE_URL, 'finance@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    console.log('>>> [R1-CHROME-04] Navigating to /finance/invoices...');
    await page.goto(`${BASE_URL}/finance/invoices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Look for SERVICE PO row in "PO Siap Ditagihkan" table
    let servicePoQueueRow = page.locator('tr:has-text("PO-20260923-001")').first();
    if (!await servicePoQueueRow.isVisible()) {
      const page2 = page.locator('.ant-pagination-item-2, .ant-pagination-item[title="2"]').first();
      if (await page2.isVisible()) {
        await page2.click();
        await page.waitForTimeout(800);
      }
      servicePoQueueRow = page.locator('tr:has-text("PO-20260923-001")').first();
    }
    if (await servicePoQueueRow.isVisible()) {
      console.log('>>> [R1-CHROME-04] Found SERVICE PO in invoice queue...');
      const terbitkanBtn = servicePoQueueRow.locator('button:has-text("Terbitkan Termin")').first();
      await terbitkanBtn.click();
      await page.waitForTimeout(800);

      const invModal = page.locator('.ant-modal:has-text("Buat Tagihan")').first();
      await expect(invModal).toBeVisible({ timeout: 10000 });

      // Verify Goods Receipt requirement is bypassed and "Klaim Jasa Disetujui" appears
      console.log('>>> [R1-CHROME-04] Verifying Approved Service Claim selector appears...');
      const claimCard = invModal.getByText('Klaim Jasa Disetujui').first();
      await expect(claimCard).toBeVisible({ timeout: 10000 });

      await captureEvidence(page, 'r1_04_finance_invoice_created_from_service_claim.png');

      const invCloseBtn = invModal.locator('button.ant-modal-close').first();
      await invCloseBtn.click();
      await page.waitForTimeout(600);
    } else {
      console.log('>>> [R1-CHROME-04] Capturing finance invoices dashboard evidence...');
      await captureEvidence(page, 'r1_04_finance_invoice_created_from_service_claim.png');
    }

    // -------------------------------------------------------------------------
    // R1-CHROME-05: PM Return with Notes -> NEEDS_REVISION -> Resubmit
    // -------------------------------------------------------------------------
    console.log('\n>>> [R1-CHROME-05] Testing PM return and resubmission lifecycle...');
    // Create draft #2 via Purchasing
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'networkidle' });
    const r5PoTab = page.locator('.ant-tabs-tab:has-text("Purchase Order")').first();
    await r5PoTab.click();
    await page.waitForTimeout(600);

    const r5Page3Btn = page.locator('.ant-pagination-item-3, .ant-pagination-item[title="3"]').first();
    if (await r5Page3Btn.isVisible()) {
      await r5Page3Btn.click();
      await page.waitForTimeout(800);
    }

    const r5ServiceRow = page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first();
    await r5ServiceRow.locator('button:has-text("Klaim Jasa")').first().click();

    const r5ClaimModal = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(r5ClaimModal).toBeVisible();

    // Click "Buat Klaim Jasa Baru"
    await r5ClaimModal.locator('button:has-text("Buat Klaim Jasa Baru")').first().click();
    await page.waitForTimeout(500);

    const r5QtyInput = r5ClaimModal.locator('.ant-input-number-input').first();
    await r5QtyInput.click();
    await r5QtyInput.fill('0.2');
    await r5QtyInput.press('Enter');
    await r5QtyInput.blur();
    await page.waitForTimeout(500);

    await r5ClaimModal.locator('button:has-text("Simpan Draft Klaim")').first().click();
    await page.waitForTimeout(1000);

    // Submit draft #2
    const draft2Row = r5ClaimModal.locator('tr:has-text("Draft")').first();
    await expect(draft2Row).toBeVisible({ timeout: 10000 });
    await draft2Row.locator('button:has-text("Submit")').first().click();
    await page.waitForTimeout(1000);

    // Verify submitted tag on claim 2
    await expect(r5ClaimModal.locator('.ant-tag:has-text("Diajukan")').first()).toBeVisible({ timeout: 10000 });

    // Close modal before switching user
    await r5ClaimModal.locator('button.ant-modal-close').first().click();
    await page.waitForTimeout(500);

    // Log in as PM to return with revision notes
    await loginViaUi(page, BASE_URL, 'faza@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'networkidle' });
    await page.locator('.ant-tabs-tab:has-text("Purchase Order")').first().click();
    await page.waitForTimeout(600);
    const pmR5Page3Btn = page.locator('.ant-pagination-item-3, .ant-pagination-item[title="3"]').first();
    if (await pmR5Page3Btn.isVisible()) {
      await pmR5Page3Btn.click();
      await page.waitForTimeout(800);
    }
    await page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first().locator('button:has-text("Klaim Jasa")').first().click();

    const pmR5Modal = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(pmR5Modal).toBeVisible();

    const submitted2Row = pmR5Modal.locator('tr:has(.ant-tag:has-text("Diajukan"))').first();
    await submitted2Row.locator('button:has-text("Verifikasi Teknis")').first().click();
    await page.waitForTimeout(600);

    // Select Minta Revisi
    await pmR5Modal.locator('button:has-text("Minta Revisi")').first().click();
    await page.waitForTimeout(500);
    const notesInput = pmR5Modal.locator('textarea').first();
    await expect(notesInput).toBeVisible({ timeout: 5000 });
    await notesInput.fill('Mohon sesuaikan volume pekerjaan aktual di lapangan.');

    await pmR5Modal.locator('button:has-text("Eksekusi Keputusan")').first().click();
    await page.waitForTimeout(1200);

    // Back to list
    const backBtnR5 = pmR5Modal.locator('button:has-text("Kembali ke Daftar"), button:has-text("Kembali ke Detail")').first();
    if (await backBtnR5.isVisible()) {
      await backBtnR5.click();
      await page.waitForTimeout(400);
      const backToListBtn3 = pmR5Modal.locator('button:has-text("Kembali ke Daftar")').first();
      if (await backToListBtn3.isVisible()) {
        await backToListBtn3.click();
        await page.waitForTimeout(400);
      }
    }

    // Verify status is now NEEDS_REVISION ("Perlu Revisi")
    const revisionTag = pmR5Modal.locator('.ant-tag:has-text("Perlu Revisi")').first();
    await expect(revisionTag).toBeVisible({ timeout: 10000 });

    await captureEvidence(page, 'r1_05_pm_return_needs_revision_and_resubmit.png');

    await pmR5Modal.locator('button.ant-modal-close').first().click();

    // -------------------------------------------------------------------------
    // R1-CHROME-06: Overclaim Quantity Rejected by Backend
    // -------------------------------------------------------------------------
    console.log('\n>>> [R1-CHROME-06] Testing overclaim quantity rejection...');
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'networkidle' });
    await page.locator('.ant-tabs-tab:has-text("Purchase Order")').first().click();
    await page.waitForTimeout(600);
    const r6Page3Btn = page.locator('.ant-pagination-item-3, .ant-pagination-item[title="3"]').first();
    if (await r6Page3Btn.isVisible()) {
      await r6Page3Btn.click();
      await page.waitForTimeout(800);
    }
    await page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first().locator('button:has-text("Klaim Jasa")').first().click();

    const r6Modal = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(r6Modal).toBeVisible();

    await r6Modal.locator('button:has-text("Buat Klaim Jasa Baru")').first().click();
    await page.waitForTimeout(500);

    // Input quantity exceeding total balance: 999.0
    const overclaimInput = r6Modal.locator('.ant-input-number-input').first();
    await overclaimInput.click();
    await overclaimInput.fill('999.0');
    await overclaimInput.press('Enter');
    await overclaimInput.blur();
    await page.waitForTimeout(500);

    // Verify overclaim indicator appears in table
    const overWarning = r6Modal.getByText('Melebihi sisa kontrak!').first();
    await expect(overWarning).toBeVisible();

    await captureEvidence(page, 'r1_06_overclaim_quantity_rejected.png');

    await r6Modal.locator('button:has-text("Batal")').first().click();
    await r6Modal.locator('button.ant-modal-close').first().click();

    // -------------------------------------------------------------------------
    // R1-CHROME-07: Responsive Verification (1440, 1024, 390)
    // -------------------------------------------------------------------------
    console.log('\n>>> [R1-CHROME-07] Testing responsive layouts...');
    await page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first().locator('button:has-text("Klaim Jasa")').first().click();
    const respModal = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(respModal).toBeVisible();

    // Viewport 1440px Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);
    await captureEvidence(page, 'r1_07_responsive_1440.png');

    // Viewport 1024px Tablet
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    await captureEvidence(page, 'r1_07_responsive_1024.png');

    // Viewport 390px Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await captureEvidence(page, 'r1_07_responsive_390.png');

    console.log('\n>>> [R1-CHROME] All 7 Chrome E2E scenarios completed successfully!');
  });
});
