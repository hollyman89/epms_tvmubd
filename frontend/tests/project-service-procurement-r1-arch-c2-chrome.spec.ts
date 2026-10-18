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
const EVIDENCE_DIR = path.resolve(__dirname, '../../evidence/project-service-procurement-r1-arch-c2');
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

test.describe.serial('EPMS — PROJECT-SERVICE-PROCUREMENT-R1-ARCH-C2: Service PO Commercial SSOT & 0..N SPK/WO (Real Chrome)', () => {
  test.setTimeout(180000);

  test('ARCH-C2: Service PO as Commercial SSOT, 0..N Service Orders, Multiple ISSUED Coexistence & Responsive Stack in Real Chrome', async ({ page }) => {
    // -------------------------------------------------------------------------
    // STEP 0: Authentication & Navigation
    // -------------------------------------------------------------------------
    console.log('\n>>> [ARCH-C2] Logging in as Purchasing user...');
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    console.log('>>> [ARCH-C2] Navigating to /procurement?tab=po...');
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'networkidle' });

    // Explicitly click "Purchase Order" tab
    const poTab = page.locator('.ant-tabs-tab:has-text("Purchase Order")').first();
    await poTab.click();
    await page.waitForTimeout(600);

    // Navigate to page 3 where Service PO #2 (PO-20260923-001) resides
    const page3Btn = page.locator('.ant-pagination-item-3, .ant-pagination-item[title="3"]').first();
    if (await page3Btn.isVisible()) {
      console.log('>>> [ARCH-C2] Navigating to pagination page 3...');
      await page3Btn.click();
      await page.waitForTimeout(800);
    }

    // Locate Service PO row
    const serviceRow = page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first();
    await expect(serviceRow).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // ARCH-C2-06 (Pre-check): Confirm NO Goods Receipt action on SERVICE PO
    // -------------------------------------------------------------------------
    console.log('>>> [ARCH-C2-06] Checking that SERVICE PO has NO Goods Receipt action...');
    const serviceGrBtn = serviceRow.locator('button:has-text("Terima Barang")');
    await expect(serviceGrBtn).toHaveCount(0);
    console.log('>>> [ARCH-C2-06] Verified: SERVICE PO cannot perform Goods Receipt.');

    const spkActionBtn = serviceRow.locator('button:has-text("SPK / Work Order")').first();
    await expect(spkActionBtn).toBeVisible();

    // -------------------------------------------------------------------------
    // ARCH-C2-01: Open SERVICE PO modal, verify PO remains authoritative
    // -------------------------------------------------------------------------
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('>>> [ARCH-C2-01] Opening ServiceOrderModal...');
    await spkActionBtn.click();

    const spkModal = page.locator('.ant-modal:has-text("Surat Perintah Kerja (SPK) / Work Order")').first();
    await expect(spkModal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(800);

    // Verify PO Context Strip (Authoritative Commercial SSOT)
    console.log('>>> [ARCH-C2-01] Verifying PO Context Strip as Commercial SSOT...');
    const projectElem = spkModal.getByText('SURGE JATENG').first();
    await expect(projectElem).toBeVisible();

    const vendorElem = spkModal.getByText('PT Suplai Makmur').first();
    await expect(vendorElem).toBeVisible();

    const poValueElem = spkModal.getByText(/Rp\s*5\.000\.000/i).first();
    await expect(poValueElem).toBeVisible();

    // Verify existing first SPK in documents list
    const firstDocRow = spkModal.locator('tr:has-text("SPK-20261008-001")').first();
    await expect(firstDocRow).toBeVisible();
    await expect(firstDocRow.locator('.ant-tag:has-text("ISSUED")')).toBeVisible();

    await captureEvidence(page, 'arch_c2_01_service_po_authoritative_and_first_spk.png');

    // -------------------------------------------------------------------------
    // ARCH-C2-02: Create second ServiceOrder under same PO (0..N Architecture)
    // -------------------------------------------------------------------------
    console.log('>>> [ARCH-C2-02] Clicking "+ Buat SPK / Work Order" to create second document...');
    const createBtn = spkModal.locator('button:has-text("Buat SPK / Work Order")').first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await page.waitForTimeout(600);

    // Select document type: WORK_ORDER
    console.log('>>> [ARCH-C2-02] Filling creation form...');
    const docTypeSelect = spkModal.locator('.ant-select').first();
    await docTypeSelect.click();
    const woOption = page.locator('.ant-select-item-option:has-text("Work Order (WO)")').first();
    if (await woOption.isVisible()) {
      await woOption.click();
    }

    // Fill Scope of Work
    const scopeInput = spkModal.locator('textarea[placeholder*="lingkup pekerjaan"]').first();
    await scopeInput.fill('Penarikan kabel FO dan terminasi OTB Area Tambahan (ARCH-C2)');

    // Fill Location
    const locInput = spkModal.locator('input[placeholder*="Site Proyek"]').first();
    await locInput.fill('Site Stasiun Karawang Lantai 2');

    // Fill Notes
    const notesInput = spkModal.locator('textarea[placeholder*="Wajib APD"]').first();
    await notesInput.fill('Wajib APD lengkap, briefing K3 sebelum pelaksanaan.');

    // Submit Form
    const submitBtn = spkModal.locator('button:has-text("Buat SPK / Work Order")').last();
    await submitBtn.click();
    await page.waitForTimeout(1500);

    // Verify newly created document is in DRAFT
    console.log('>>> [ARCH-C2-02] Verifying newly created document is in DRAFT status...');
    const draftStatusTag = spkModal.locator('.ant-tag:has-text("DRAFT")').first();
    await expect(draftStatusTag).toBeVisible();

    const secondDocNumberElem = spkModal.locator('td.ant-descriptions-item-content strong').first();
    const secondDocNum = (await secondDocNumberElem.textContent())?.trim();
    console.log(`>>> [ARCH-C2-02] Second document number created: "${secondDocNum}"`);
    expect(secondDocNum).toMatch(/^WO-\d{8}-\d{3}$/);

    await captureEvidence(page, 'arch_c2_02_second_service_order_draft_created.png');

    // -------------------------------------------------------------------------
    // ARCH-C2-03: Issue second ServiceOrder and verify both documents visible
    // -------------------------------------------------------------------------
    console.log('>>> [ARCH-C2-03] Issuing second ServiceOrder...');
    const issueBtn = spkModal.locator('button:has-text("Terbitkan SPK")').first();
    await expect(issueBtn).toBeVisible();
    await issueBtn.click();
    await page.waitForTimeout(400);

    const popconfirmOk = page.locator('.ant-popconfirm button:has-text("Ya, Terbitkan")').first();
    await expect(popconfirmOk).toBeVisible();
    await popconfirmOk.click();
    await page.waitForTimeout(1500);

    // Verify second document transitioned to ISSUED
    const issuedTag = spkModal.locator('.ant-tag:has-text("ISSUED")').first();
    await expect(issuedTag).toBeVisible();

    // Navigate back to documents list
    console.log('>>> [ARCH-C2-03] Returning to documents list...');
    const backToListBtn = spkModal.locator('button:has-text("Kembali ke Daftar")').first();
    await expect(backToListBtn).toBeVisible();
    await backToListBtn.click();
    await page.waitForTimeout(800);

    // Verify both documents exist concurrently in the documents table
    console.log('>>> [ARCH-C2-03] Verifying both documents visible in the table...');
    const docRows = spkModal.locator('table tbody tr');
    await expect(docRows).toHaveCount(2);

    await expect(spkModal.locator(`tr:has-text("${secondDocNum}")`)).toBeVisible();
    await expect(spkModal.locator('tr:has-text("SPK-20261008-001")')).toBeVisible();

    await captureEvidence(page, 'arch_c2_03_multiple_issued_documents_coexist.png');

    // -------------------------------------------------------------------------
    // ARCH-C2-04: Reopen first ServiceOrder, verify unchanged
    // -------------------------------------------------------------------------
    console.log('>>> [ARCH-C2-04] Reopening first ServiceOrder (SPK-20261008-001)...');
    const firstRowDetailBtn = spkModal.locator('tr:has-text("SPK-20261008-001") button:has-text("Lihat Detail")').first();
    await firstRowDetailBtn.click();
    await page.waitForTimeout(800);

    // Verify first document detail remains intact
    const doc1NumElem = spkModal.locator('td.ant-descriptions-item-content strong:has-text("SPK-20261008-001")').first();
    await expect(doc1NumElem).toBeVisible();
    await expect(spkModal.locator('.ant-tag:has-text("ISSUED")').first()).toBeVisible();
    await expect(spkModal.locator('.ant-alert:has-text("Menunggu Pelaksanaan / Klaim Jasa (Phase 21)")')).toBeVisible();

    // Verify read-only state: no input fields, no edit button, no issue button
    await expect(spkModal.locator('input.ant-input')).toHaveCount(0);
    await expect(spkModal.locator('button:has-text("Ubah Draft")')).toHaveCount(0);
    await expect(spkModal.locator('button:has-text("Terbitkan SPK")')).toHaveCount(0);

    await captureEvidence(page, 'arch_c2_04_first_document_reopened_intact.png');

    // -------------------------------------------------------------------------
    // ARCH-C2-05: Reopen second ServiceOrder, verify independent state
    // -------------------------------------------------------------------------
    console.log('>>> [ARCH-C2-05] Returning to list and opening second document...');
    const backToListBtn2 = spkModal.locator('button:has-text("Kembali ke Daftar")').first();
    await backToListBtn2.click();
    await page.waitForTimeout(600);

    const secondRowDetailBtn = spkModal.locator(`tr:has-text("${secondDocNum}") button:has-text("Lihat Detail")`).first();
    await secondRowDetailBtn.click();
    await page.waitForTimeout(800);

    // Verify second document details
    const doc2NumElem = spkModal.locator(`td.ant-descriptions-item-content strong:has-text("${secondDocNum}")`).first();
    await expect(doc2NumElem).toBeVisible();
    await expect(spkModal.locator('td.ant-descriptions-item-content:has-text("Penarikan kabel FO dan terminasi OTB Area Tambahan")').first()).toBeVisible();

    await captureEvidence(page, 'arch_c2_05_second_document_independent_state.png');

    // -------------------------------------------------------------------------
    // ARCH-C2-06: Close modal and verify SERVICE PO row has NO GR action
    // -------------------------------------------------------------------------
    console.log('>>> [ARCH-C2-06] Closing modal and verifying table row...');
    const closeBtn = spkModal.locator('button:has-text("Tutup")').first();
    await closeBtn.click();
    await page.waitForTimeout(600);

    // Material PO row should have "Terima Barang" (if eligible), while Service PO never has it
    const updatedServiceRow = page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first();
    await expect(updatedServiceRow.locator('button:has-text("Terima Barang")')).toHaveCount(0);
    await expect(updatedServiceRow.locator('button:has-text("SPK / Work Order")')).toBeVisible();

    await captureEvidence(page, 'arch_c2_06_service_po_no_gr_action.png');

    // -------------------------------------------------------------------------
    // ARCH-C2-07: Responsive Validation (1440, 1024, 390)
    // -------------------------------------------------------------------------
    console.log('>>> [ARCH-C2-07] Testing responsive viewports...');
    // Reopen modal to test responsive layout
    const reopenBtn = updatedServiceRow.locator('button:has-text("SPK / Work Order")').first();
    await reopenBtn.click();
    await page.waitForTimeout(600);

    // Desktop 1440
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);
    let overflow1440 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow1440).toBe(false);
    await captureEvidence(page, 'arch_c2_07_responsive_1440.png');

    // Tablet 1024
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    let overflow1024 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow1024).toBe(false);
    await captureEvidence(page, 'arch_c2_07_responsive_1024.png');

    // Mobile 390
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    let overflow390 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow390).toBe(false);
    await captureEvidence(page, 'arch_c2_07_responsive_390.png');

    console.log('>>> [ARCH-C2] ALL SCENARIOS COMPLETED SUCCESSFULLY!');
  });
});
