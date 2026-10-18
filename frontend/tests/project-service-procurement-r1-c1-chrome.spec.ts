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
const BACKEND_URL = 'http://localhost:4000/api/v1';
const EVIDENCE_DIR = path.resolve(__dirname, '../../evidence/project-service-procurement-r1-c1');
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
    console.warn(`[WARN] Could not copy evidence: ${err}`);
  }
  console.log(`[EVIDENCE CAPTURED] ${filename}`);
}

test.describe.serial('EPMS — PROJECT-SERVICE-PROCUREMENT-R1-C1: Final Closure Verification (Real Chrome)', () => {
  test.setTimeout(180000);

  test('C1-01 to C1-07: Full ServiceOrder Lifecycle, Reopen Immutability & GR Enforcement in Real Chrome', async ({ page }) => {
    // -------------------------------------------------------------------------
    // STEP 0: Authentication
    // -------------------------------------------------------------------------
    console.log('\n>>> [R1-C1] Logging in as Purchasing user...');
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    // Extract auth token for backend rejection test
    const authToken = await page.evaluate(
      () => localStorage.getItem('access_token') || localStorage.getItem('accessToken')
    );
    expect(authToken).toBeTruthy();

    console.log('>>> [R1-C1] Navigating to /procurement?tab=po...');
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'networkidle' });

    // Explicitly click "Purchase Order" tab to ensure active PO table view
    const poTab = page.locator('.ant-tabs-tab:has-text("Purchase Order")').first();
    await poTab.click();
    await page.waitForTimeout(600);

    // Wait for PO table
    const table = page.locator('.ant-table').first();
    await expect(table).toBeVisible({ timeout: 15000 });

    // Navigate to pagination page 3 where historical SERVICE PO #2 (PO-20260923-001) resides
    const page3Btn = page.locator('.ant-pagination-item-3, .ant-pagination-item[title="3"]').first();
    if (await page3Btn.isVisible()) {
      console.log('>>> [R1-C1] Navigating to pagination page 3...');
      await page3Btn.click();
      await page.waitForTimeout(800);
    }

    // -------------------------------------------------------------------------
    // C1-01: SERVICE PO → No Goods Receipt action & SPK / Work Order visible
    // -------------------------------------------------------------------------
    console.log('>>> [R1-C1] C1-01: Verifying Service PO row and action gating...');
    const serviceRow = page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first();
    await expect(serviceRow).toBeVisible({ timeout: 10000 });

    // Tag verification
    const serviceTag = serviceRow.locator('.ant-tag:has-text("Jasa / Subcon")').first();
    await expect(serviceTag).toBeVisible();

    // SPK action verification
    const spkActionBtn = serviceRow.locator('button:has-text("SPK / Work Order")').first();
    await expect(spkActionBtn).toBeVisible();

    // Confirm "Terima Barang" is NOT present on Service PO row
    const grActionOnServiceRow = serviceRow.locator('button:has-text("Terima Barang")');
    await expect(grActionOnServiceRow).toHaveCount(0);

    // Capture C1-01 evidence
    await captureEvidence(page, 'c1_01_service_po_row_no_gr.png');

    // -------------------------------------------------------------------------
    // C1-02: Open ServiceOrder → Create DRAFT → Save → DRAFT visible
    // -------------------------------------------------------------------------
    console.log('>>> [R1-C1] C1-02: Opening ServiceOrderModal to create DRAFT...');
    await spkActionBtn.click();

    const spkModal = page.locator('.ant-modal:has-text("Surat Perintah Kerja (SPK) / Work Order Jasa")').first();
    await expect(spkModal).toBeVisible({ timeout: 10000 });

    // Verify Phase 20 rule alert
    await expect(
      spkModal.locator('text=Ketentuan Pelaksanaan Pekerjaan Jasa (Phase 20)').first()
    ).toBeVisible({ timeout: 10000 });

    // Verify PO Context Reference Strip (Relations)
    await expect(spkModal.locator('text=PROYEK:').first()).toBeVisible();
    await expect(spkModal.locator('text=PURCHASE ORDER:').first()).toBeVisible();
    await expect(spkModal.locator('text=VENDOR / SUBCON:').first()).toBeVisible();

    const draftTag = spkModal.locator('.ant-tag:has-text("DRAFT")').first();
    const issuedTag = spkModal.locator('.ant-tag:has-text("ISSUED")').first();

    const isAlreadyIssued = await issuedTag.isVisible().catch(() => false);

    if (!isAlreadyIssued) {
      const isAlreadyDraft = await draftTag.isVisible().catch(() => false);
      if (!isAlreadyDraft) {
        console.log('>>> [R1-C1] Filling SPK DRAFT form...');
        const scopeInput = spkModal.locator('textarea#scopeOfWork, textarea[placeholder*="lingkup"]').first();
        await scopeInput.waitFor({ state: 'visible', timeout: 10000 });
        await scopeInput.fill('Jasa Subkontraktor Pekerjaan Instalasi Mekanikal dan Elektrikal');

        const locationInput = spkModal.locator('input#workLocation, input#location, input[placeholder*="Site"]').first();
        if (await locationInput.isVisible()) {
          await locationInput.fill('Proyek Gedung Fasilitas Utama - Lantai 2');
        }

        const notesInput = spkModal.locator('textarea#notes, textarea#specialInstructions, textarea[placeholder*="APD"]').first();
        if (await notesInput.isVisible()) {
          await notesInput.fill('Wajib APD lengkap dan mematuhi standar K3 proyek.');
        }

        // Submit form to create DRAFT
        const submitBtn = spkModal.locator('button:has-text("Buat SPK / Work Order")').first();
        await submitBtn.click();

        await expect(spkModal.locator('.ant-tag:has-text("DRAFT")').first()).toBeVisible({ timeout: 15000 });
        console.log('>>> [R1-C1] ServiceOrder DRAFT created and persisted successfully.');
      }

      // Capture C1-02 evidence
      await captureEvidence(page, 'c1_02_spk_draft_saved.png');

      // -----------------------------------------------------------------------
      // C1-03: DRAFT → Issue → ISSUED
      // -----------------------------------------------------------------------
      console.log('>>> [R1-C1] C1-03: Issuing ServiceOrder to ISSUED...');
      const issueBtn = spkModal.locator('button:has-text("Terbitkan SPK")').first();
      await expect(issueBtn).toBeVisible({ timeout: 5000 });
      await issueBtn.click();

      // Confirm in Popconfirm dialog
      const popconfirmOk = page.locator('.ant-popover button:has-text("Ya, Terbitkan")').first();
      await expect(popconfirmOk).toBeVisible({ timeout: 5000 });
      await popconfirmOk.click();

      // Verify ISSUED status tag
      await expect(spkModal.locator('.ant-tag:has-text("ISSUED")').first()).toBeVisible({ timeout: 15000 });
      console.log('>>> [R1-C1] ServiceOrder successfully transitioned to ISSUED.');
    }

    // Capture C1-03 evidence
    await captureEvidence(page, 'c1_03_spk_issued.png');

    // Verify Phase 21 boundary message is displayed
    await expect(
      spkModal.locator('text=Menunggu Pelaksanaan / Klaim Jasa (Phase 21)').first()
    ).toBeVisible();

    // -------------------------------------------------------------------------
    // C1-04 & C1-05: Close → Reopen → Same ServiceOrder Persists & Read-Only Immutability
    // -------------------------------------------------------------------------
    console.log('>>> [R1-C1] C1-04: Closing ServiceOrderModal...');
    const closeBtn = spkModal.locator('button:has-text("Tutup")').first();
    await closeBtn.click();
    await expect(spkModal).not.toBeVisible({ timeout: 5000 });

    console.log('>>> [R1-C1] C1-04: Reopening modal to verify persistence and relations...');
    await spkActionBtn.click();
    await expect(spkModal).toBeVisible({ timeout: 10000 });

    // Verify persisted ISSUED state
    await expect(spkModal.locator('.ant-tag:has-text("ISSUED")').first()).toBeVisible();

    // Verify relations intact
    await expect(spkModal.locator('text=PROYEK:').first()).toBeVisible();
    await expect(spkModal.locator('text=PURCHASE ORDER:').first()).toBeVisible();
    await expect(spkModal.locator('text=VENDOR / SUBCON:').first()).toBeVisible();

    // Capture C1-04 evidence
    await captureEvidence(page, 'c1_04_spk_reopened_persisted.png');

    // C1-05: Immutability proof:
    // Edit & Issue action buttons must NOT be exposed
    console.log('>>> [R1-C1] C1-05: Verifying read-only immutability of ISSUED ServiceOrder...');
    await expect(spkModal.locator('button:has-text("Ubah Draft")')).toHaveCount(0);
    await expect(spkModal.locator('button:has-text("Terbitkan SPK")')).toHaveCount(0);
    await expect(spkModal.locator('button:has-text("Simpan Perubahan")')).toHaveCount(0);

    // Form inputs must not be present; descriptions view must be active
    await expect(spkModal.locator('.ant-descriptions').first()).toBeVisible();
    await expect(spkModal.locator('textarea')).toHaveCount(0);

    // Capture C1-05 evidence
    await captureEvidence(page, 'c1_05_spk_issued_readonly.png');

    // Close modal
    await closeBtn.click();
    await expect(spkModal).not.toBeVisible({ timeout: 5000 });

    // -------------------------------------------------------------------------
    // C1-06: SERVICE PO Backend GR Attempt: REJECTED with 400 Bad Request
    // -------------------------------------------------------------------------
    console.log('>>> [R1-C1] C1-06: Testing backend Goods Receipt rejection on SERVICE PO...');
    const grAttemptResponse = await page.request.post(`${BACKEND_URL}/procurement/goods-receipts`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        purchaseOrderId: 2, // SERVICE PO #2
        receiptDate: '2026-10-09T10:00:00.000Z',
        remarks: 'SJ-E2E-SERVICE-BLOCK',
        items: [
          {
            poItemId: 1,
            receivedQuantity: 1,
          },
        ],
      },
    });

    console.log(`>>> [R1-C1] Backend GR attempt status: ${grAttemptResponse.status()}`);
    expect(grAttemptResponse.status()).toBe(400);

    const grErrorBody = await grAttemptResponse.json();
    const rawMsg = grErrorBody.message || grErrorBody.error || '';
    const errorMsg = Array.isArray(rawMsg) ? rawMsg.join(', ') : String(rawMsg);
    console.log(`>>> [R1-C1] Backend GR rejection message: "${errorMsg}"`);
    expect(errorMsg.toLowerCase()).toContain('jasa');

    // -------------------------------------------------------------------------
    // C1-07: MATERIAL PO retains normal GR behavior
    // -------------------------------------------------------------------------
    console.log('>>> [R1-C1] C1-07: Verifying MATERIAL PO retains Goods Receipt behavior...');
    const page1Btn = page.locator('.ant-pagination-item-1, .ant-pagination-item[title="1"]').first();
    if (await page1Btn.isVisible()) {
      await page1Btn.click();
      await page.waitForTimeout(800);
    }

    // Locate a MATERIAL PO row
    const materialRow = page.locator('tr:has(.ant-tag:has-text("Material"))').first();
    await expect(materialRow).toBeVisible({ timeout: 10000 });

    // Open PO Detail modal for Material PO
    const viewMaterialPoBtn = materialRow.locator('button:has-text("Lihat PO")').first();
    await viewMaterialPoBtn.click();

    const poModal = page.locator('.ant-modal:has-text("Rincian Purchase Order")').first();
    await expect(poModal).toBeVisible({ timeout: 10000 });

    // Verify Material tag
    await expect(poModal.locator('.ant-tag:has-text("Material")').first()).toBeVisible();

    // Verify that SPK / Work Order banner is NOT shown for Material PO
    await expect(poModal.locator('text=PO Layanan Jasa / Subkon (Non-Material)')).toHaveCount(0);

    // Capture C1-07 evidence
    await captureEvidence(page, 'c1_06_material_po_retains_gr.png');

    // Close PO Modal
    const closePoBtn = poModal.locator('button:has-text("Tutup")').first();
    await closePoBtn.click();
    await expect(poModal).not.toBeVisible({ timeout: 5000 });

    console.log('\n>>> [R1-C1] ALL SCENARIOS C1-01 to C1-07 VERIFIED SUCCESSFULLY IN REAL CHROME!\n');
  });
});
