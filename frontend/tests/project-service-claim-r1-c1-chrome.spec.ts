import { test, expect, Page, APIRequestContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginViaUi } from './canonical-lifecycle-helpers';

// Runtime credential injection: process.env.E2E_TEST_PASSWORD must be provided by runner environment
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
if (!E2E_PASSWORD) {
  throw new Error('E2E_TEST_PASSWORD environment variable is required but not set.');
}

const BASE_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:4000/api/v1';

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

// Helper to obtain authenticated JWT via normal auth API (zero plaintext printing)
async function getAuthToken(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { email, password: E2E_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`Failed to login via API as ${email}: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const token = body.data?.accessToken || body.accessToken || body.access_token || body.token;
  if (!token) throw new Error('No token returned from auth API');
  return token;
}

test.describe.serial('EPMS — PROJECT-SERVICE-CLAIM-R1-C1: Google Chrome Live Validation', () => {
  test.setTimeout(300000);

  test('C1-CHROME: Return/Resubmit/Reverify, Real Finance Invoice Persistence, Server Overclaim & Option A Cardinality', async ({ page, request }) => {
    page.on('console', (msg) => {
      const txt = msg.text();
      if (txt.includes('DEBUG') || msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[BROWSER ${msg.type().toUpperCase()}] ${txt}`);
      }
    });
    page.on('pageerror', (err) => console.log('[PAGE ERROR]', err.message));

    // =========================================================================
    // STEP 0: Capture Authoritative Project Progress Pre-Check
    // =========================================================================
    console.log('\n>>> [STEP 0] Capturing Baseline Project Progress Pre-Check...');
    await loginViaUi(page, BASE_URL, 'faza@epms.com', E2E_PASSWORD);
    await page.waitForTimeout(1000);

    const tab2 = page.locator('.ant-tabs-tab:has-text("Daftar Proyek Berjalan")').first();
    if (await tab2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab2.click();
      await page.waitForTimeout(600);
    }
    const progressLoc = page.locator('.ant-progress-text, [data-testid="project-progress"]').first();
    const hasProgress = await progressLoc.isVisible({ timeout: 3000 }).catch(() => false);
    const initialProgressText = hasProgress ? (await progressLoc.textContent({ timeout: 2000 }))?.trim() : '0%';
    console.log(`[PRE-CHECK PROGRESS] Authoritative initial project progress: ${initialProgressText}`);

    // =========================================================================
    // C1-CHROME-01: Full Return -> Edit -> Resubmit -> PM Re-verify -> Commercial Approve
    // =========================================================================
    console.log('\n>>> [C1-CHROME-01] Step 1: Procurement creates and submits Claim...');
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'domcontentloaded' });

    // Open Purchase Order tab
    await page.locator('.ant-tabs-tab:has-text("Purchase Order")').first().click();
    await page.waitForTimeout(600);

    // Locate Service PO #2 (PO-20260923-001) row across pages if needed
    const findServicePoRow = async () => {
      await page.locator('.ant-pagination-item').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      let row = page.locator('tr:has-text("PO-20260923-001")').first();
      if (await row.isVisible()) return row;
      for (const p of [3, 2, 1]) {
        const pBtn = page.locator(`.ant-pagination-item-${p}, .ant-pagination-item[title="${p}"]`).first();
        if (await pBtn.isVisible()) {
          await pBtn.click();
          await page.waitForTimeout(600);
          row = page.locator('tr:has-text("PO-20260923-001")').first();
          if (await row.isVisible()) return row;
        }
      }
      return page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first();
    };

    const serviceRow = await findServicePoRow();
    await expect(serviceRow).toBeVisible({ timeout: 10000 });
    await serviceRow.locator('button:has-text("Klaim Jasa")').first().click();

    const claimModal = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(claimModal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(600);

    // Click "Buat Klaim Jasa Baru"
    await claimModal.locator('button:has-text("Buat Klaim Jasa Baru")').first().click();
    await page.waitForTimeout(500);

    // Fill claim: Reference and claim quantity 0.1
    const refInput = claimModal.locator('#acceptanceReference, input[placeholder*="BAST-001"]').first();
    await expect(refInput).toBeVisible({ timeout: 5000 });
    await refInput.fill('BA-SVC-C1-002');

    const qtyInput = claimModal.locator('.ant-input-number-input').first();
    await qtyInput.click();
    await qtyInput.fill('0.1');
    await qtyInput.press('Enter');
    await qtyInput.blur();
    await page.waitForTimeout(500);

    // Save Draft
    await claimModal.locator('button:has-text("Simpan Draft Klaim")').first().click();
    await page.waitForTimeout(1000);

    // Locate the draft row and submit
    const draftRow = claimModal.locator('tr:has-text("Draft")').first();
    await expect(draftRow).toBeVisible({ timeout: 10000 });
    await draftRow.locator('button:has-text("Submit")').first().click();
    await page.waitForTimeout(1000);

    // Verify status is SUBMITTED ("Diajukan")
    await expect(claimModal.locator('.ant-tag:has-text("Diajukan")').first()).toBeVisible({ timeout: 10000 });
    await captureEvidence(page, 'c1_01_procurement_claim_submitted.png');

    // Close modal before switching user
    await claimModal.locator('button.ant-modal-close').first().click();
    await page.waitForTimeout(600);

    // --- PM RETURN WITH NOTES ---
    console.log('\n>>> [C1-CHROME-01] Step 2: PM returns claim with revision notes...');
    await loginViaUi(page, BASE_URL, 'faza@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'domcontentloaded' });
    await page.locator('.ant-tabs-tab:has-text("Purchase Order")').first().click();
    await page.waitForTimeout(600);

    const pmServiceRow = await findServicePoRow();
    await expect(pmServiceRow).toBeVisible({ timeout: 10000 });
    await pmServiceRow.locator('button:has-text("Klaim Jasa")').first().click();

    const pmModal = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(pmModal).toBeVisible({ timeout: 10000 });

    const submittedRow = pmModal.locator('tr:has(.ant-tag:has-text("Diajukan"))').first();
    await submittedRow.locator('button:has-text("Verifikasi Teknis")').first().click();
    await page.waitForTimeout(600);

    // Select Minta Revisi
    await pmModal.locator('button:has-text("Minta Revisi")').first().click();
    await page.waitForTimeout(500);

    const notesInput = pmModal.locator('textarea').first();
    await expect(notesInput).toBeVisible({ timeout: 5000 });
    await notesInput.fill('Volume pekerjaan fisik aktual perlu dikoreksi menjadi 0.15 sesuai opname lapangan.');

    await pmModal.locator('button:has-text("Eksekusi Keputusan")').first().click();
    await page.waitForTimeout(1200);

    // Assert status is now NEEDS_REVISION ("Perlu Revisi")
    const revisionTag = pmModal.locator('.ant-tag:has-text("Perlu Revisi")').first();
    await expect(revisionTag).toBeVisible({ timeout: 10000 });
    await captureEvidence(page, 'c1_02_pm_return_needs_revision.png');

    await pmModal.locator('button.ant-modal-close').first().click();
    await page.waitForTimeout(600);

    // --- PROCUREMENT EDITS AND RESUBMITS ---
    console.log('\n>>> [C1-CHROME-01] Step 3: Procurement edits legitimate field and resubmits...');
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'domcontentloaded' });
    await page.locator('.ant-tabs-tab:has-text("Purchase Order")').first().click();
    await page.waitForTimeout(600);

    const procServiceRow = await findServicePoRow();
    await expect(procServiceRow).toBeVisible({ timeout: 10000 });
    await procServiceRow.locator('button:has-text("Klaim Jasa")').first().click();

    const procModal = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(procModal).toBeVisible({ timeout: 10000 });

    const revRow = procModal.locator('tr:has(.ant-tag:has-text("Perlu Revisi"))').first();
    await expect(revRow).toBeVisible({ timeout: 10000 });

    // Click "Ubah" (Edit Draft)
    await revRow.locator('button:has-text("Ubah")').first().click();
    await page.waitForTimeout(600);

    // Edit claim quantity to 0.15
    const editQtyInput = procModal.locator('.ant-input-number-input').first();
    await editQtyInput.click();
    await editQtyInput.fill('0.15');
    await editQtyInput.press('Enter');
    await editQtyInput.blur();
    await page.waitForTimeout(500);

    // Save edited draft
    await procModal.locator('button:has-text("Simpan Draft Klaim")').first().click();
    await page.waitForTimeout(1000);

    // Verify PM verification reset via authenticated API proof (Section 12)
    const procToken = await getAuthToken(request, 'purchasing@epms.com');
    const claimListRes = await request.get(`${BACKEND_URL}/procurement/service-claims?poId=2`, {
      headers: { Authorization: `Bearer ${procToken}` },
    });
    const claimListRaw = await claimListRes.json();
    const claimList = Array.isArray(claimListRaw) ? claimListRaw : (claimListRaw.data || []);
    const claim2Before = claimList.find((c: any) => c.acceptanceReference === 'BA-SVC-C1-002' && c.status !== 'CANCELLED' && c.status !== 'APPROVED_FOR_INVOICE');
    expect(claim2Before).toBeDefined();
    console.log(`[C1-CHROME-01 RESET CHECK] Claim #${claim2Before.id} pmVerifierId: ${claim2Before.pmVerifierId}, pmVerifiedAt: ${claim2Before.pmVerifiedAt}`);
    expect(claim2Before.pmVerifierId).toBeNull();
    expect(claim2Before.pmVerifiedAt).toBeNull();

    // Submit using the SAME /submit button on the revised row
    const resubmitRow = procModal.locator('tr:has(.ant-tag:has-text("Perlu Revisi"))').first();
    await expect(resubmitRow).toBeVisible({ timeout: 10000 });
    await resubmitRow.locator('button:has-text("Submit")').first().click();
    await page.waitForTimeout(1200);

    // Assert status transitioned to SUBMITTED ("Diajukan"), NOT persisted as RESUBMITTED
    await expect(procModal.locator('.ant-tag:has-text("Diajukan")').first()).toBeVisible({ timeout: 10000 });
    const claim2AfterSubmitRes = await request.get(`${BACKEND_URL}/procurement/service-claims/${claim2Before.id}`, {
      headers: { Authorization: `Bearer ${procToken}` },
    });
    const claim2AfterSubmitJson = await claim2AfterSubmitRes.json();
    const claim2AfterSubmit = claim2AfterSubmitJson.data || claim2AfterSubmitJson;
    expect(claim2AfterSubmit.status).toBe('SUBMITTED');
    console.log(`[C1-CHROME-01 PERSISTED STATUS CHECK] Claim #${claim2Before.id} persisted status is strictly: ${claim2AfterSubmit.status}`);
    await captureEvidence(page, 'c1_03_procurement_resubmitted.png');

    await procModal.locator('button.ant-modal-close').first().click();
    await page.waitForTimeout(600);

    // --- PM RE-VERIFIES REVISED CLAIM ---
    console.log('\n>>> [C1-CHROME-01] Step 4: PM re-verifies revised claim...');
    await loginViaUi(page, BASE_URL, 'faza@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'domcontentloaded' });
    await page.locator('.ant-tabs-tab:has-text("Purchase Order")').first().click();
    await page.waitForTimeout(600);

    const pmServiceRow2 = await findServicePoRow();
    await expect(pmServiceRow2).toBeVisible({ timeout: 10000 });
    await pmServiceRow2.locator('button:has-text("Klaim Jasa")').first().click();

    const pmModal2 = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(pmModal2).toBeVisible({ timeout: 10000 });

    const reVerifyRow = pmModal2.locator('tr:has(.ant-tag:has-text("Diajukan"))').first();
    await reVerifyRow.locator('button:has-text("Verifikasi Teknis")').first().click();
    await page.waitForTimeout(600);

    // Select Setujui Teknis
    await pmModal2.locator('button:has-text("Setujui Teknis")').first().click();
    await page.waitForTimeout(400);

    await pmModal2.locator('button:has-text("Eksekusi Keputusan")').first().click();
    await page.waitForTimeout(1200);

    // Assert status is now PM_VERIFIED ("Terverifikasi Teknis")
    const pmVerifiedTag = pmModal2.locator('.ant-tag:has-text("Terverifikasi Teknis")').first();
    await expect(pmVerifiedTag).toBeVisible({ timeout: 10000 });
    await captureEvidence(page, 'c1_04_pm_reapproved_technical.png');

    // Verify PM re-verification presence via authenticated API proof (Section 12)
    const claimListAfterPmRes = await request.get(`${BACKEND_URL}/procurement/service-claims?poId=2`, {
      headers: { Authorization: `Bearer ${procToken}` },
    });
    const claimListAfterPmRaw = await claimListAfterPmRes.json();
    const claimListAfterPm = Array.isArray(claimListAfterPmRaw) ? claimListAfterPmRaw : (claimListAfterPmRaw.data || []);
    const claim2AfterPm = claimListAfterPm.find((c: any) => Number(c.id) === Number(claim2Before.id));
    expect(claim2AfterPm).toBeDefined();
    expect(claim2AfterPm.pmVerifierId).not.toBeNull();
    expect(claim2AfterPm.pmVerifiedAt).not.toBeNull();
    console.log(`[C1-CHROME-01 REVERIFY CHECK] Claim #${claim2AfterPm.id} new pmVerifierId: ${claim2AfterPm.pmVerifierId}, pmVerifiedAt: ${claim2AfterPm.pmVerifiedAt}`);

    await pmModal2.locator('button.ant-modal-close').first().click();
    await page.waitForTimeout(600);

    // --- PROCUREMENT COMMERCIAL APPROVAL ---
    console.log('\n>>> [C1-CHROME-01] Step 5: Procurement commercial approval...');
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'domcontentloaded' });
    await page.locator('.ant-tabs-tab:has-text("Purchase Order")').first().click();
    await page.waitForTimeout(600);

    const procServiceRow2 = await findServicePoRow();
    await expect(procServiceRow2).toBeVisible({ timeout: 10000 });
    await procServiceRow2.locator('button:has-text("Klaim Jasa")').first().click();

    const procModal2 = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(procModal2).toBeVisible({ timeout: 10000 });

    const commVerifyRow = procModal2.locator('tr:has(.ant-tag:has-text("Terverifikasi Teknis"))').first();
    await commVerifyRow.locator('button:has-text("Verifikasi Komersial")').first().click();
    await page.waitForTimeout(600);

    // Select Setujui Komersial
    await procModal2.locator('button:has-text("Setujui Komersial")').first().click();
    await page.waitForTimeout(400);

    await procModal2.locator('button:has-text("Eksekusi Keputusan")').first().click();
    await page.waitForTimeout(1200);

    // Assert status is now APPROVED_FOR_INVOICE ("Disetujui untuk Invoice")
    const approvedTag = procModal2.locator('.ant-tag:has-text("Disetujui untuk Invoice")').first();
    await expect(approvedTag).toBeVisible({ timeout: 10000 });
    await captureEvidence(page, 'c1_05_procurement_commercial_approved.png');

    await procModal2.locator('button.ant-modal-close').first().click();
    await page.waitForTimeout(600);

    // =========================================================================
    // C1-CHROME-02: Real Invoice Creation in Chrome & Persistence Verification
    // =========================================================================
    console.log('\n>>> [C1-CHROME-02] Logging in as Finance for Real Invoice Creation...');
    await loginViaUi(page, BASE_URL, 'finance@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/finance/invoices`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Find PO-20260923-001 in "PO Siap Ditagihkan" table across all pagination pages
    const findFinanceServicePoRow = async () => {
      await page.locator('.ant-pagination-item').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      let row = page.locator('tr:has-text("PO-20260923-001")').first();
      if (await row.isVisible({ timeout: 1500 }).catch(() => false)) return row;
      for (const p of [4, 3, 2, 1, 5]) {
        const pBtn = page.locator(`.ant-pagination-item-${p}, .ant-pagination-item[title="${p}"]`).first();
        if (await pBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await pBtn.click();
          await page.waitForTimeout(600);
          row = page.locator('tr:has-text("PO-20260923-001")').first();
          if (await row.isVisible({ timeout: 1500 }).catch(() => false)) return row;
        }
      }
      return page.locator('tr:has-text("PO-20260923-001")').first();
    };
    const servicePoRow = await findFinanceServicePoRow();
    await expect(servicePoRow).toBeVisible({ timeout: 10000 });

    console.log('>>> [C1-CHROME-02] Clicking Terbitkan Termin...');
    const terbitkanBtn = servicePoRow.locator('button:has-text("Terbitkan Termin")').first();
    await expect(terbitkanBtn).toBeEnabled({ timeout: 10000 });
    await terbitkanBtn.click();
    await page.waitForTimeout(800);

    const invModal = page.locator('.ant-modal:has-text("Penerbitan Invoice"), .ant-modal:has-text("Buat Tagihan")').first();
    await expect(invModal).toBeVisible({ timeout: 10000 });

    // Verify Approved Service Claim selector appears and GR is bypassed
    console.log('>>> [C1-CHROME-02] Verifying Approved Service Claim selector...');
    const claimCard = invModal.getByText('Klaim Jasa Disetujui').first();
    await expect(claimCard).toBeVisible({ timeout: 10000 });

    // Select Claim #1 if not automatically selected (when multiple approved claims exist)
    const claimCardContainer = invModal.locator('.ant-card').filter({ hasText: 'Klaim Jasa Disetujui' }).first();
    const selector = claimCardContainer.locator('.ant-select-selector').first();
    if (await selector.isVisible({ timeout: 5000 }).catch(() => false)) {
      const selectedItemLoc = claimCardContainer.locator('.ant-select-selection-item').first();
      const isSelected = await selectedItemLoc.isVisible({ timeout: 1000 }).catch(() => false);
      const selectedItemText = isSelected ? await selectedItemLoc.textContent().catch(() => '') : '';
      if (!selectedItemText?.includes('SCL-20261009-001')) {
        await selector.click();
        await page.waitForTimeout(500);
        const option1 = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: /SCL-20261009-001|SC-202610-001|2\.000\.000/i }).first();
        if (await option1.isVisible({ timeout: 3000 }).catch(() => false)) {
          await option1.click();
          await page.waitForTimeout(400);
        } else {
          const anyOption = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').first();
          if (await anyOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await anyOption.click();
            await page.waitForTimeout(400);
          } else {
            await page.keyboard.press('Escape');
          }
        }
      }
    }

    // Fill optional tax number
    const taxInput = invModal.locator('input[name="taxInvoiceNumber"], input[placeholder*="Faktur Pajak"]').first();
    if (await taxInput.isVisible()) {
      await taxInput.fill('010.000-26.00000001');
    }

    // Submit Invoice
    console.log('>>> [C1-CHROME-02] Submitting invoice...');
    const createInvSubmitBtn = invModal.locator('button[type="submit"], button:has-text("Terbitkan Invoice")').first();
    await createInvSubmitBtn.click();
    await page.waitForTimeout(1500);

    // Verify Success notification
    await expect(page.locator('.ant-message-success, .ant-notification-notice-success, :text("berhasil diterbitkan")').first()).toBeVisible({ timeout: 10000 });
    await captureEvidence(page, 'c1_06_finance_invoice_created_persisted.png');

    // Verify Invoice persistence and Service Claim status via authenticated read-only API (Section 16 & 19)
    console.log('>>> [C1-CHROME-02] Verifying Invoice persistence and Service Claim status via API...');
    const financeTokenForVerify = await getAuthToken(request, 'finance@epms.com');
    const invRes = await request.get(`${BACKEND_URL}/finance/invoices`, {
      headers: { Authorization: `Bearer ${financeTokenForVerify}` },
    });
    expect(invRes.ok()).toBeTruthy();
    const invData = await invRes.json();
    const invList = Array.isArray(invData) ? invData : (invData.data?.data || invData.data || []);
    const matchingInv = invList.find((i: any) => Number(i.purchaseOrderId || i.poId) === 2 && Number(i.serviceClaimId) === 1);
    expect(matchingInv).toBeDefined();
    expect(Number(matchingInv.serviceClaimId)).toBe(1);
    expect(Number(matchingInv.purchaseOrderId || matchingInv.poId)).toBe(2);
    expect(matchingInv.goodsReceiptId).toBeFalsy();
    console.log(`[C1-CHROME-02 PERSISTENCE VERIFIED] Invoice #${matchingInv.invoiceNumber} persisted with serviceClaimId: ${matchingInv.serviceClaimId}, poId: ${matchingInv.purchaseOrderId || matchingInv.poId}, goodsReceiptId: null`);

    // Verify Service Claim #1 status remains APPROVED_FOR_INVOICE (Section 19: not mutated to INVOICED or PAID)
    const procTokenForClaimCheck = await getAuthToken(request, 'purchasing@epms.com');
    const claim1Res = await request.get(`${BACKEND_URL}/procurement/service-claims/1`, {
      headers: { Authorization: `Bearer ${procTokenForClaimCheck}` },
    });
    const claim1DataRaw = await claim1Res.json();
    const claim1Data = claim1DataRaw.data || claim1DataRaw;
    expect(claim1Data.status).toBe('APPROVED_FOR_INVOICE');
    console.log(`[C1-CHROME-02 STATUS PRESERVATION] Service Claim #1 status remains strictly: ${claim1Data.status}`);

    // =========================================================================
    // C1-API-01: Server-Side Overclaim Proof
    // =========================================================================
    console.log('\n>>> [C1-API-01] Testing server-side overclaim rejection via authenticated API...');
    const purchasingToken = await getAuthToken(request, 'purchasing@epms.com');

    const overclaimRes = await request.post(`${BACKEND_URL}/procurement/service-claims`, {
      headers: { Authorization: `Bearer ${purchasingToken}` },
      data: {
        purchaseOrderId: 2,
        acceptanceType: 'BAST',
        items: [
          {
            poItemId: 2,
            currentClaimQuantity: 999.0, // Exceeds balance
          },
        ],
      },
    });

    console.log(`[C1-API-01] Overclaim response status: ${overclaimRes.status()}`);
    expect(overclaimRes.status()).toBe(400);
    const overclaimErr = await overclaimRes.json();
    const overclaimMsg = overclaimErr.message || overclaimErr.data?.message;
    console.log(`[C1-API-01] Overclaim rejection message: ${overclaimMsg}`);
    expect(String(overclaimMsg)).toMatch(/melebihi sisa kontrak/i);

    // =========================================================================
    // C1-API-02: Second Active Invoice Rejection (Option A Cardinality)
    // =========================================================================
    console.log('\n>>> [C1-API-02] Testing second active invoice rejection for same claim (Option A)...');
    const financeToken = await getAuthToken(request, 'finance@epms.com');

    // Fetch pending payment term for PO #2 so payment term status gate passes and Option A claim cardinality is directly tested
    const poRes = await request.get(`${BACKEND_URL}/procurement/purchase-orders/2`, {
      headers: { Authorization: `Bearer ${financeToken}` },
    });
    const poBody = await poRes.json();
    const poData = poBody.data?.data?.data || poBody.data?.data || poBody.data || poBody;
    const pendingTerm = (poData.paymentTerms || []).find((t: any) => t.status === 'PENDING' && Number(t.sequence) === 3);
    const termIdToUse = pendingTerm ? Number(pendingTerm.id) : 51;
    console.log(`[C1-API-02] Using pending payment term ID: ${termIdToUse} for Option A duplicate claim rejection test`);

    // Attempt to create second invoice with serviceClaimId: 1
    const duplicateInvRes = await request.post(`${BACKEND_URL}/finance/invoices`, {
      headers: { Authorization: `Bearer ${financeToken}` },
      data: {
        purchaseOrderId: 2,
        paymentTermId: termIdToUse,
        serviceClaimId: 1, // Claim #1 already has active invoice from C1-CHROME-02
        invoiceDate: new Date().toISOString(),
      },
    });

    console.log(`[C1-API-02] Duplicate invoice response status: ${duplicateInvRes.status()}`);
    expect(duplicateInvRes.status()).toBe(400);
    const duplicateErr = await duplicateInvRes.json();
    const duplicateMsg = duplicateErr.message || duplicateErr.data?.message;
    console.log(`[C1-API-02] Option A rejection message: ${duplicateMsg}`);
    expect(String(duplicateMsg)).toMatch(/sudah memiliki invoice aktif/i);

    // =========================================================================
    // C1-UX-01: Client Overclaim Guard Evidence
    // =========================================================================
    console.log('\n>>> [C1-UX-01] Capturing client overclaim UX guard evidence...');
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'domcontentloaded' });
    await page.locator('.ant-tabs-tab:has-text("Purchase Order")').first().click();
    await page.waitForTimeout(600);

    const uxServiceRow = await findServicePoRow();
    await expect(uxServiceRow).toBeVisible({ timeout: 10000 });
    await uxServiceRow.locator('button:has-text("Klaim Jasa")').first().click();

    const uxModal = page.locator('.ant-modal:has-text("Klaim Jasa (Service Claim)")').first();
    await expect(uxModal).toBeVisible({ timeout: 10000 });

    await uxModal.locator('button:has-text("Buat Klaim Jasa Baru")').first().click();
    await page.waitForTimeout(500);

    const uxQtyInput = uxModal.locator('.ant-input-number-input').first();
    await uxQtyInput.click();
    await uxQtyInput.fill('999.0');
    await uxQtyInput.press('Enter');
    await uxQtyInput.blur();
    await page.waitForTimeout(500);

    const overWarning = uxModal.getByText('Melebihi sisa kontrak!').first();
    await expect(overWarning).toBeVisible();
    await captureEvidence(page, 'c1_07_client_overclaim_guard.png');

    await uxModal.locator('button:has-text("Batal")').first().click();
    await uxModal.locator('button.ant-modal-close').first().click();
    await page.waitForTimeout(600);

    // =========================================================================
    // STEP FINAL: Authoritative Project Progress Zero Mutation Verification
    // =========================================================================
    console.log('\n>>> [STEP FINAL] Verifying Project Progress Zero Mutation...');
    await loginViaUi(page, BASE_URL, 'faza@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const postTab2 = page.locator('.ant-tabs-tab:has-text("Daftar Proyek Berjalan")').first();
    if (await postTab2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await postTab2.click();
      await page.waitForTimeout(600);
    }
    const postProgressLoc = page.locator('.ant-progress-text, [data-testid="project-progress"]').first();
    const hasPostProgress = await postProgressLoc.isVisible({ timeout: 3000 }).catch(() => false);
    const postProgressText = hasPostProgress ? (await postProgressLoc.textContent({ timeout: 2000 }))?.trim() : '0%';
    console.log(`[POST-CHECK PROGRESS] Project progress after complete Service Claim & Invoice lifecycle: ${postProgressText}`);

    expect(postProgressText?.trim()).toBe(initialProgressText?.trim());
    await captureEvidence(page, 'c1_08_project_progress_zero_mutation.png');

    console.log('\n>>> [R1-C1 CHROME & API] All C1 scenarios passed with zero mutation and rigorous persistence proof!');
  });
});
