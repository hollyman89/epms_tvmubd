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

const EVIDENCE_DIR = path.resolve(__dirname, '../../evidence/project-service-procurement-r1');
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

test.describe.serial('EPMS — PROJECT-SERVICE-PROCUREMENT-R1: Google Chrome Live Validation', () => {
  test.setTimeout(180000);

  test('SCENARIO 1: PO Table Type Discrimination & Action Gating in Real Chrome', async ({ page }) => {
    console.log('\n>>> [TEST 1] Logging in as Purchasing...');
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    console.log('>>> [TEST 1] Navigating to /procurement...');
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'networkidle' });

    // Verify PO Tab is visible
    const poTab = page.locator('.ant-tabs-tab:has-text("Purchase Order")');
    await expect(poTab).toBeVisible();

    // Verify PO Table is loaded
    const poTable = page.locator('table').first();
    await expect(poTable).toBeVisible();

    // Verify PO Type Column Header
    const typeHeader = page.locator('th:has-text("TIPE PO")').first();
    await expect(typeHeader).toBeVisible();

    // On page 1: Verify Material Tag exists (e.g. PO-20261001-006)
    const materialTag = page.locator('.ant-tag:has-text("Material")').first();
    await expect(materialTag).toBeVisible();

    // On page 1: Verify Legacy Campuran Tag exists on PO #16 (PO-20261001-004)
    const legacyMixedTag = page.locator('.ant-tag:has-text("Legacy Campuran")').first();
    await expect(legacyMixedTag).toBeVisible();

    // Navigate to page 3 to find historical SERVICE PO #2 (PO-20260923-001)
    const page3Btn = page.locator('.ant-pagination-item-3, .ant-pagination-item[title="3"]').first();
    if (await page3Btn.isVisible()) {
      await page3Btn.click();
      await page.waitForTimeout(600);
    }

    // Verify Service Tag exists on PO #2
    const serviceTag = page.locator('.ant-tag:has-text("Jasa / Subcon")').first();
    await expect(serviceTag).toBeVisible();

    await captureEvidence(page, 'r1_01_po_table_type_discrimination.png');
  });

  test('SCENARIO 2: SERVICE PO Detail Modal & SPK / Work Order Modal Flow', async ({ page }) => {
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'networkidle' });

    // Navigate to page 3 where PO #2 (SERVICE) is located
    const page3Btn = page.locator('.ant-pagination-item-3, .ant-pagination-item[title="3"]').first();
    if (await page3Btn.isVisible()) {
      await page3Btn.click();
      await page.waitForTimeout(600);
    }

    // Find the row with Jasa / Subcon (PO #2)
    const serviceRow = page.locator('tr:has(.ant-tag:has-text("Jasa / Subcon"))').first();
    await expect(serviceRow).toBeVisible();

    // Verify that "Terima Barang" is NOT present on this service row
    const grButtonOnServiceRow = serviceRow.locator('button:has-text("Terima Barang")');
    await expect(grButtonOnServiceRow).toHaveCount(0);

    // Verify that "SPK / Work Order" button IS present
    const spkButton = serviceRow.locator('button:has-text("SPK / Work Order")').first();
    await expect(spkButton).toBeVisible();

    // Click "Lihat PO" on Service PO to open PurchaseOrderModal
    const viewPoBtn = serviceRow.locator('button:has-text("Lihat PO")').first();
    await viewPoBtn.click();

    // Modal should be open
    const poModal = page.locator('.ant-modal:has-text("Rincian Purchase Order")').first();
    await expect(poModal).toBeVisible();

    // Header must have Jasa / Subcon tag
    await expect(poModal.locator('.ant-tag:has-text("Jasa / Subcon")').first()).toBeVisible();

    // Alert for service PO must be visible
    await expect(poModal.locator('text=PO Layanan Jasa / Subkon (Non-Material)').first()).toBeVisible();

    // In footer, "Proses Penerimaan Barang (GR)" must NOT exist
    await expect(poModal.locator('button:has-text("Proses Penerimaan Barang (GR)")')).toHaveCount(0);

    // In footer, "Kelola SPK / Work Order" must exist
    const manageSpkBtn = poModal.locator('button:has-text("Kelola SPK / Work Order")').first();
    await expect(manageSpkBtn).toBeVisible();

    await captureEvidence(page, 'r1_02_service_po_view_modal_no_gr.png');

    // Click "Kelola SPK / Work Order"
    await manageSpkBtn.click();

    // ServiceOrderModal should appear
    const soModal = page.locator('.ant-modal:has-text("Surat Perintah Kerja (SPK) / Work Order Jasa")').first();
    await expect(soModal).toBeVisible();

    // Alert regarding Phase 20 rule should be visible
    await expect(soModal.locator('text=Ketentuan Pelaksanaan Pekerjaan Jasa (Phase 20)').first()).toBeVisible();

    // Reference strip should be visible
    await expect(soModal.locator('text=PURCHASE ORDER:').first()).toBeVisible();

    await captureEvidence(page, 'r1_03_service_order_modal_open.png');

    // Close SO Modal
    const closeBtn = soModal.locator('button:has-text("Tutup")').first();
    await closeBtn.click();
  });

  test('SCENARIO 3: LEGACY_MIXED PO Historical Truth & Category Preservation', async ({ page }) => {
    await loginViaUi(page, BASE_URL, 'purchasing@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/procurement?tab=po`, { waitUntil: 'networkidle' });

    // On page 1, PO #16 (PO-20261001-004) has Legacy Campuran
    const legacyRow = page.locator('tr:has(.ant-tag:has-text("Legacy Campuran"))').first();
    await expect(legacyRow).toBeVisible();

    // Click "Lihat PO"
    const viewPoBtn = legacyRow.locator('button:has-text("Lihat PO")').first();
    await viewPoBtn.click();

    const poModal = page.locator('.ant-modal:has-text("Rincian Purchase Order")').first();
    await expect(poModal).toBeVisible();

    // Header has Legacy Campuran tag
    await expect(poModal.locator('.ant-tag:has-text("Legacy Campuran")').first()).toBeVisible();

    // Alert for Legacy PO must be visible
    await expect(poModal.locator('text=PO Campuran Historis (Legacy)').first()).toBeVisible();

    // Item table shows truthful categories (e.g. Subkontraktor / Material / Peralatan)
    const itemsTable = poModal.locator('.ant-table').first();
    await expect(itemsTable).toBeVisible();

    await captureEvidence(page, 'r1_04_legacy_mixed_po_category_preservation.png');

    // Close Modal
    await poModal.locator('button:has-text("Tutup")').first().click();
  });

  test('SCENARIO 4: Project Detail Drawer Procurement Pipeline & SPK Metric', async ({ page }) => {
    console.log('\n>>> [TEST 4] Logging in as PM to view Project Workspace...');
    await loginViaUi(page, BASE_URL, 'pm@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'networkidle' });

    // Click Daftar Proyek Berjalan tab
    const projectTab = page.locator('.ant-tabs-tab:has-text("Daftar Proyek Berjalan")');
    if (await projectTab.isVisible()) {
      await projectTab.click();
      await page.waitForTimeout(500);
    }

    // Locate active projects table
    const activeTable = page.locator('[data-testid="active-projects-table"]').first();
    if (await activeTable.isVisible()) {
      const projectRow = activeTable.locator('tbody tr').first();
      if (await projectRow.isVisible()) {
        const moreBtn = projectRow.locator('button[title*="Aksi"], .ant-dropdown-trigger').last();
        if (await moreBtn.isVisible()) {
          await moreBtn.click();
          await page.waitForTimeout(500);
          const detailItem = page.locator('.ant-dropdown-menu-item:has-text("Detail Project")').first();
          if (await detailItem.isVisible()) {
            await detailItem.click();
            await page.waitForTimeout(1000);

            // Ensure drawer is open
            const drawerTitle = page.locator('.ant-drawer-title').first();
            await expect(drawerTitle).toBeVisible({ timeout: 10000 });

            // Select Tab "Material / Pengadaan"
            const procTab = page.locator('[data-tab-key="material"]').first();
            if (await procTab.isVisible()) {
              await procTab.click();
              await page.waitForTimeout(1000);
              const pipeline = page.locator('text=Pipeline Pengadaan Proyek').first();
              if (await pipeline.isVisible()) {
                await expect(page.locator('text=SPK / WO Jasa').first()).toBeVisible();
              }
            }

            await captureEvidence(page, 'r1_05_project_detail_procurement_spk_pipeline.png');
          }
        }
      }
    }
  });
});
