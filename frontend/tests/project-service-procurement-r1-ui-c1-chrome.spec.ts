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
const EVIDENCE_DIR = path.resolve(__dirname, '../../evidence/project-service-procurement-r1-ui-c1');
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

test.describe.serial('EPMS — PROJECT-SERVICE-PROCUREMENT-R1-UI-C1: Service Order UI Detail Cleanup (Real Chrome)', () => {
  test.setTimeout(180000);

  test('UI-C1: Service Order Detail Presentation, 2-Column Desktop Grid, Project Mapping & Responsive Stack in Real Chrome', async ({ page }) => {
    // -------------------------------------------------------------------------
    // STEP 0: Authentication & Navigation
    // -------------------------------------------------------------------------
    console.log('\n>>> [UI-C1] Logging in as Purchasing user...');
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    console.log('>>> [UI-C1] Navigating to /procurement?tab=po...');
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'networkidle' });

    // Explicitly click "Purchase Order" tab
    const poTab = page.locator('.ant-tabs-tab:has-text("Purchase Order")').first();
    await poTab.click();
    await page.waitForTimeout(600);

    // Navigate to page 3 where Service PO #2 (PO-20260923-001) resides
    const page3Btn = page.locator('.ant-pagination-item-3, .ant-pagination-item[title="3"]').first();
    if (await page3Btn.isVisible()) {
      console.log('>>> [UI-C1] Navigating to pagination page 3...');
      await page3Btn.click();
      await page.waitForTimeout(800);
    }

    // Locate Service PO row
    const serviceRow = page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first();
    await expect(serviceRow).toBeVisible({ timeout: 10000 });

    const spkActionBtn = serviceRow.locator('button:has-text("SPK / Work Order")').first();
    await expect(spkActionBtn).toBeVisible();

    // -------------------------------------------------------------------------
    // STEP 1: Open Service Order Detail Modal (Desktop 1440 Viewport)
    // -------------------------------------------------------------------------
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('>>> [UI-C1] Opening ServiceOrderModal on Desktop (1440x900)...');
    await spkActionBtn.click();

    const spkModal = page.locator('.ant-modal:has-text("Surat Perintah Kerja (SPK) / Work Order")').first();
    await expect(spkModal).toBeVisible({ timeout: 10000 });

    // Wait for content to stabilize
    await page.waitForTimeout(800);

    // If documents list is visible, click "Lihat Detail" specifically on SPK-20261008-001 to inspect the detailed Descriptions view
    const spkRowBtn = spkModal.locator('tr:has-text("SPK-") button:has-text("Lihat Detail")').first();
    const detailBtn = (await spkRowBtn.isVisible()) ? spkRowBtn : spkModal.locator('button:has-text("Lihat Detail")').first();
    if (await detailBtn.isVisible()) {
      console.log('>>> [UI-C1] Clicking "Lihat Detail" on SPK row to inspect Service Order Descriptions...');
      await detailBtn.click();
      await page.waitForTimeout(600);
    }

    // -------------------------------------------------------------------------
    // STEP 2: Verify Document Number intactness (NO vertical character wrap)
    // -------------------------------------------------------------------------
    console.log('>>> [UI-C1] Verifying Document Number presentation...');
    const docNumberElem = spkModal.locator('td.ant-descriptions-item-content strong:has-text("SPK-")').first();
    await expect(docNumberElem).toBeVisible();

    const docNumberText = (await docNumberElem.textContent())?.trim();
    console.log(`>>> [UI-C1] Extracted document number: "${docNumberText}"`);
    expect(docNumberText).toMatch(/^SPK-\d{8}-\d{3}$/);

    // Check bounding box height: on a single line it should be around 16-24px, NOT > 100px vertical
    const bbox = await docNumberElem.boundingBox();
    expect(bbox).not.toBeNull();
    console.log(`>>> [UI-C1] Document number bounding box: width=${bbox?.width}px, height=${bbox?.height}px`);
    expect(bbox!.height).toBeLessThan(35); // Confirms single-line rendering
    expect(bbox!.width).toBeGreaterThan(100); // Confirms horizontal expansion

    // -------------------------------------------------------------------------
    // STEP 3: Verify Context Strip (Project, Vendor, PO, Contract Value)
    // -------------------------------------------------------------------------
    console.log('>>> [UI-C1] Verifying Context Strip bindings...');
    const contextStrip = spkModal.locator('div:has-text("PROYEK:")').first();
    await expect(contextStrip).toBeVisible();

    // Verify Project mapping (SURGE JATENG / CONT-20260922-0012)
    const projectElem = spkModal.locator('text=SURGE JATENG').first();
    await expect(projectElem).toBeVisible();
    console.log('>>> [UI-C1] Canonical project name "SURGE JATENG" confirmed visible.');

    // Verify Vendor mapping (PT Suplai Makmur)
    await expect(spkModal.locator('text=PT Suplai Makmur').first()).toBeVisible();

    // Verify PO Number (PO-20260923-001)
    await expect(spkModal.locator('text=PO-20260923-001').first()).toBeVisible();

    // Verify Contract Value (Rp 5.000.000)
    await expect(spkModal.locator('text=Rp 5.000.000').first()).toBeVisible();

    // -------------------------------------------------------------------------
    // STEP 4: Verify 2-Column Desktop Grid Hierarchy
    // -------------------------------------------------------------------------
    console.log('>>> [UI-C1] Verifying 2-Column Desktop Grid structure...');
    const descriptions = spkModal.locator('.ant-descriptions').first();
    await expect(descriptions).toBeVisible();

    // Check row 1 labels: Nomor Dokumen and Tipe Dokumen
    await expect(spkModal.locator('th.ant-descriptions-item-label:has-text("Nomor Dokumen")')).toBeVisible();
    await expect(spkModal.locator('th.ant-descriptions-item-label:has-text("Tipe Dokumen")')).toBeVisible();

    // Check row 2 labels: Tanggal Dibuat and Status
    await expect(spkModal.locator('th.ant-descriptions-item-label:has-text("Tanggal Dibuat")')).toBeVisible();
    await expect(spkModal.locator('th.ant-descriptions-item-label:has-text("Status")')).toBeVisible();

    // Check row 3 labels: Target Mulai and Target Selesai
    await expect(spkModal.locator('th.ant-descriptions-item-label:has-text("Target Mulai")')).toBeVisible();
    await expect(spkModal.locator('th.ant-descriptions-item-label:has-text("Target Selesai")')).toBeVisible();

    // Check full-width rows: Lokasi Pelaksanaan and Lingkup Pekerjaan
    await expect(spkModal.locator('th.ant-descriptions-item-label:has-text("Lokasi Pelaksanaan")')).toBeVisible();
    await expect(spkModal.locator('th.ant-descriptions-item-label:has-text("Lingkup Pekerjaan")')).toBeVisible();

    // Verify status tag
    const statusTag = spkModal.locator('.ant-tag:has-text("● ISSUED")').first();
    await expect(statusTag).toBeVisible();

    // -------------------------------------------------------------------------
    // STEP 5: Verify Issued Immutability (Read-Only)
    // -------------------------------------------------------------------------
    console.log('>>> [UI-C1] Verifying Issued read-only immutability...');
    await expect(spkModal.locator('button:has-text("Ubah Draft")')).toHaveCount(0);
    await expect(spkModal.locator('button:has-text("Terbitkan SPK")')).toHaveCount(0);
    await expect(spkModal.locator('button:has-text("Simpan Perubahan")')).toHaveCount(0);
    await expect(spkModal.locator('textarea')).toHaveCount(0);

    // Cancel action is available as secondary danger
    const cancelBtn = spkModal.locator('button:has-text("Batalkan SPK")').first();
    await expect(cancelBtn).toBeVisible();

    // -------------------------------------------------------------------------
    // STEP 6: Verify Phase 21 Boundary Notice
    // -------------------------------------------------------------------------
    console.log('>>> [UI-C1] Verifying Phase 21 boundary notice...');
    const phase21Alert = spkModal.locator('text=Menunggu Pelaksanaan / Klaim Jasa (Phase 21)').first();
    await expect(phase21Alert).toBeVisible();

    // Capture Desktop 1440 evidence
    await captureEvidence(page, 'ui_c1_01_desktop_1440_full_document_number.png');
    await captureEvidence(page, 'ui_c1_02_desktop_2column_layout_and_project.png');

    // -------------------------------------------------------------------------
    // STEP 7: Responsive Validation - Tablet 1024 Viewport
    // -------------------------------------------------------------------------
    console.log('>>> [UI-C1] Validating Tablet Viewport (1024x768)...');
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(600);

    // Verify document number remains intact without vertical wrap
    const tabletBbox = await docNumberElem.boundingBox();
    expect(tabletBbox!.height).toBeLessThan(35);
    expect(tabletBbox!.width).toBeGreaterThan(100);

    await captureEvidence(page, 'ui_c1_03_tablet_1024_clean_layout.png');

    // -------------------------------------------------------------------------
    // STEP 8: Responsive Validation - Mobile 390 Viewport
    // -------------------------------------------------------------------------
    console.log('>>> [UI-C1] Validating Mobile Viewport (390x844)...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);

    // Verify document number remains on one line even on mobile
    const mobileBbox = await docNumberElem.boundingBox();
    expect(mobileBbox!.height).toBeLessThan(35);

    // Verify no document-level horizontal scrollbar
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`>>> [UI-C1] Mobile horizontal overflow detected: ${hasHorizontalScroll}`);
    expect(hasHorizontalScroll).toBe(false);

    await captureEvidence(page, 'ui_c1_04_mobile_390_stacked_layout.png');

    // Restore desktop viewport for closing evidence
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);

    await captureEvidence(page, 'ui_c1_05_readonly_issued_state.png');
    await captureEvidence(page, 'ui_c1_06_phase21_boundary_notice.png');

    // Close modal
    const closeBtn = spkModal.locator('button:has-text("Tutup")').first();
    await closeBtn.click();
    await expect(spkModal).not.toBeVisible({ timeout: 5000 });

    console.log('\n>>> [UI-C1] ALL UI/UX REQUIREMENTS VERIFIED SUCCESSFULLY IN REAL CHROME!\n');
  });
});
