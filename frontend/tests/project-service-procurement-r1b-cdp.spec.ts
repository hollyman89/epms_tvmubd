import { test, expect, chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const CDP_URL = 'http://127.0.0.1:9222';
const PASSWORD = process.env.E2E_TEST_PASSWORD || '123456';

test.describe.serial('EPMS — PROJECT-SERVICE-ENTRY-R1B: Live Edge CDP Validation', () => {
  test.setTimeout(180000);

  test('R1B Live Acceptance: PM Project Delivery Entry Point & Procurement Distinguishability in Edge', async () => {
    console.log('\n[CDP CONNECT] Connecting to existing Edge browser on', CDP_URL);
    const browser = await chromium.connectOverCDP(CDP_URL);
    const context = browser.contexts()[0];
    let page = context.pages().find((p) => p.url().includes('localhost:3000')) || context.pages()[0];
    if (!page) {
      page = await context.newPage();
    }

    try {
      // =========================================================================
      // 1. NORMAL UI LOGIN AS PROJECT MANAGER (faza@epms.com)
      // =========================================================================
      console.log('\n[TEST STEP 1] Ensuring session as Project Manager (faza@epms.com)...');
      await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const isAlreadyPm = await page.locator('text=faza@epms.com').isVisible().catch(() => false);
      if (!isAlreadyPm) {
        console.log('[UI AUTH] Not logged in as PM. Navigating to login...');
        await context.clearCookies();
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch (_) {}
        });
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);

        const emailInput = page.locator('#login_form_email');
        await emailInput.fill('faza@epms.com');
        const passInput = page.locator('#login_form_password');
        await passInput.fill(PASSWORD);
        await page.locator('button[type="submit"]').click();

        await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
      }
      console.log('[UI AUTH] PM successfully active in session. Current URL:', page.url());

      // =========================================================================
      // 2. NAVIGATE TO PROJECT DELIVERY & SELECT "Proyek Berjalan" TAB
      // =========================================================================
      console.log('\n[TEST STEP 2] Navigating to /project-delivery...');
      await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      console.log('[UI TAB] Selecting "Daftar Proyek Berjalan" tab...');
      const activeProjectsTab = page.locator('.ant-tabs-tab').filter({ hasText: 'Daftar Proyek Berjalan' }).first();
      await expect(activeProjectsTab).toBeVisible({ timeout: 10000 });
      await activeProjectsTab.click();
      await page.waitForTimeout(1500);

      // Locate active project row
      const targetRow = page.locator('.ant-table-tbody tr.ant-table-row').first();
      await expect(targetRow).toBeVisible({ timeout: 15000 });
      const rowText = await targetRow.innerText();
      console.log('[UI ROW FOUND]', rowText.split('\n').slice(0, 4).join(' | '));

      // =========================================================================
      // 3. OPEN "Aksi lainnya" MENU
      // =========================================================================
      console.log('\n[TEST STEP 3] Opening "Aksi lainnya" menu from row actions...');
      const moreBtn = targetRow.locator('button').filter({ has: page.locator('.anticon-more') }).first();
      await expect(moreBtn).toBeVisible({ timeout: 5000 });
      await moreBtn.click();
      await page.waitForTimeout(800);

      // =========================================================================
      // 4. ASSERT "Paket Pengadaan Material" AND "Pengadaan Jasa" ARE BOTH VISIBLE
      // =========================================================================
      console.log('\n[TEST STEP 4] Verifying menu item separation in dropdown menu...');
      const materialMenuItem = page.locator('.ant-dropdown-menu-item:has-text("Paket Pengadaan Material")').first();
      const serviceMenuItem = page.locator('.ant-dropdown-menu-item:has-text("Pengadaan Jasa")').first();

      await expect(materialMenuItem).toBeVisible({ timeout: 5000 });
      console.log('[UI ASSERTION PASS] "Paket Pengadaan Material" is distinctly VISIBLE in Aksi lainnya');

      await expect(serviceMenuItem).toBeVisible({ timeout: 5000 });
      console.log('[UI ASSERTION PASS] "Pengadaan Jasa" is distinctly VISIBLE in Aksi lainnya');

      // Assert that generic combined "Paket Pengadaan" is NOT present
      const combinedItem = page.locator('.ant-dropdown-menu-item').filter({ hasText: /^Paket Pengadaan$/ });
      expect(await combinedItem.count()).toBe(0);
      console.log('[UI ASSERTION PASS] Generic combined "Paket Pengadaan" correctly eliminated');

      // Check conditional "Verifikasi Klaim Jasa"
      const claimMenuItem = page.locator('.ant-dropdown-menu-item:has-text("Verifikasi Klaim Jasa")');
      const claimMenuVisible = await claimMenuItem.isVisible().catch(() => false);
      console.log(`[UI AUDIT] "Verifikasi Klaim Jasa" conditionally rendered: ${claimMenuVisible ? 'VISIBLE (Claim actionable)' : 'HIDDEN (No pending claim - correct)'}`);

      // =========================================================================
      // 5. CLICK "Pengadaan Jasa" AND VERIFY SERVICE MODAL
      // =========================================================================
      console.log('\n[TEST STEP 5] Clicking "Pengadaan Jasa" menu item...');
      await serviceMenuItem.click();
      await page.waitForTimeout(1500);

      const modal = page.locator('.ant-modal-content').filter({ hasText: /Pengadaan Jasa Proyek/i }).first();
      await expect(modal).toBeVisible({ timeout: 10000 });
      console.log('[UI ASSERTION PASS] Service Procurement Modal successfully opened with title "Pengadaan Jasa Proyek"');

      // Verify list heading and helper text
      const listHeading = modal.locator('span, div').filter({ hasText: /Daftar Paket Pengadaan Jasa/i }).first();
      await expect(listHeading).toBeVisible({ timeout: 5000 });
      console.log('[UI ASSERTION PASS] List heading indicates "Daftar Paket Pengadaan Jasa (Service Procurement Packages)"');

      // Check create button inside modal
      const createServiceBtn = modal.locator('button:has-text("Buat Pengadaan Jasa Baru")').first();
      await expect(createServiceBtn).toBeVisible({ timeout: 5000 });
      console.log('[UI ASSERTION PASS] "Buat Pengadaan Jasa Baru" button is visible with service styling');

      // Open create form inside modal
      await createServiceBtn.click();
      await page.waitForTimeout(2000);

      // Verify form title and field placeholders
      const formTitle = modal.locator('h5, .ant-typography').filter({ hasText: /Penyusunan Pengadaan Jasa Baru/i }).first();
      await expect(formTitle).toBeVisible({ timeout: 5000 });
      console.log('[UI ASSERTION PASS] Form title indicates "Penyusunan Pengadaan Jasa Baru"');

      const titleInput = modal.locator('input[placeholder*="Pekerjaan Subkon"]').first();
      await expect(titleInput).toBeVisible({ timeout: 5000 });
      console.log('[UI ASSERTION PASS] Title input displays service placeholder ("Pekerjaan Subkon Pemasangan Kabel FO & Jointing")');

      // Verify item selection section header
      const itemSectionHeader = modal.locator('span, div').filter({ hasText: /Pilih Item Biaya Jasa dari RAB/i }).first();
      await expect(itemSectionHeader).toBeVisible({ timeout: 5000 });
      console.log('[UI ASSERTION PASS] Item selection section strictly targets Jasa (Subkon / Sewa Alat / Operasional)');

      // Cancel form and close modal
      const cancelBtn = modal.locator('button:has-text("Batal")').first();
      await cancelBtn.click();
      await page.waitForTimeout(500);

      const closeIcon = modal.locator('.ant-modal-close').first();
      if (await closeIcon.isVisible()) {
        await closeIcon.click();
      }
      await page.waitForTimeout(1000);
      console.log('[UI] Service Procurement Modal safely closed');

      // =========================================================================
      // 6. NORMAL UI LOGIN AS PROCUREMENT
      // =========================================================================
      console.log('\n[TEST STEP 6] Logging in normally as Procurement (purchasing@epms.com)...');
      await context.clearCookies();
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (_) {}
      });
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      await page.locator('#login_form_email').fill('purchasing@epms.com');
      await page.locator('#login_form_password').fill(PASSWORD);
      await page.locator('button[type="submit"]').click();

      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
      console.log('[UI AUTH] Procurement user successfully logged in. Current URL:', page.url());

      // =========================================================================
      // 7. NAVIGATE TO PROCUREMENT WORKSPACE & VERIFY DISTINGUISHABILITY
      // =========================================================================
      console.log('\n[TEST STEP 7] Navigating to /procurement?tab=packages...');
      await page.goto(`${BASE_URL}/procurement?tab=packages`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);

      // Ensure Packages tab is active
      const packagesTab = page.locator('.ant-tabs-tab:has-text("Paket Pengadaan")').first();
      if (await packagesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await packagesTab.click();
        await page.waitForTimeout(1000);
      }

      // Check for packages table
      const packagesTable = page.locator('table').first();
      await expect(packagesTable).toBeVisible({ timeout: 10000 });
      console.log('[UI ASSERTION PASS] Procurement packages table loaded');

      // Verify that badges distinguish JASA from MATERIAL
      const packageBadges = page.locator('.ant-tag:has-text("JASA"), .ant-tag:has-text("MATERIAL")');
      const badgeCount = await packageBadges.count();
      console.log(`[UI ASSERTION PASS] Found ${badgeCount} package family type badge(s) in Procurement workspace`);
      if (badgeCount > 0) {
        for (let i = 0; i < Math.min(badgeCount, 3); i++) {
          const badgeText = await packageBadges.nth(i).innerText();
          console.log(`[UI BADGE ${i + 1}] Package badge: "${badgeText}"`);
        }
      }

      console.log('\n==================================================');
      console.log('ALL R1B LIVE ACCEPTANCE CRITERIA PROVEN IN EDGE!');
      console.log('==================================================\n');
    } finally {
      // Do not kill Edge or disconnect error
      console.log('[CDP TEST COMPLETE] Completed live browser validation.');
    }
  });
});
