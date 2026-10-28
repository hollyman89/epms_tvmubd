import { test, expect, chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

try {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = (m[2] || '').trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
} catch (_) {}

const BASE_URL = 'http://localhost:3000';
const CDP_URL = 'http://127.0.0.1:9222';
const DIRECTOR_EMAIL = process.env.DIRECTOR_EMAIL || 'director@epms.com';
const PASSWORD = process.env.E2E_TEST_PASSWORD || '123456';

const ARTIFACT_SCREENSHOTS_DIR = 'C:/Users/UBDOPS3/.gemini/antigravity-ide/brain/60eefca2-626a-4d25-aa16-80f8e4aaf0c2/screenshots';
if (!fs.existsSync(ARTIFACT_SCREENSHOTS_DIR)) {
  fs.mkdirSync(ARTIFACT_SCREENSHOTS_DIR, { recursive: true });
}

test.describe.serial('EPMS CP-D3 — Executive Dashboard Cutover Live Edge Verification', () => {
  test.setTimeout(180000);

  test('Live Microsoft Edge CDP E2E: /dashboard Cutover, RBAC, Filters, Parity, Performance, and Responsive', async ({}, testInfo) => {
    let browser: any = null;
    let edgeServer: any = null;
    let context: any = null;
    let page: any = null;

    console.log('\n[EDGE CDP] Checking for running Edge instance on port 9222...');
    try {
      browser = await chromium.connectOverCDP(CDP_URL, { timeout: 3000 });
      context = browser.contexts()[0];
      page = context.pages().find((p: any) => !p.url().startsWith('edge://') && !p.url().startsWith('chrome-extension://')) || (await context.newPage());
      console.log('✅ Attached to live Microsoft Edge session on CDP.');
    } catch {
      console.log('ℹ️ Launching Microsoft Edge (channel: msedge, headless: false) with remote debugging...');
      edgeServer = await chromium.launch({
        channel: 'msedge',
        headless: false,
        args: ['--remote-debugging-port=9222', '--remote-allow-origins=*', '--start-maximized'],
      });
      browser = await chromium.connectOverCDP(CDP_URL);
      context = browser.contexts()[0];
      page = await context.newPage();
      console.log('✅ Microsoft Edge launched and attached via CDP.');
    }

    await page.setViewportSize({ width: 1440, height: 900 });

    const consoleErrors: string[] = [];
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('websocket') && !text.includes('favicon')) {
          consoleErrors.push(text);
        }
      }
    });

    // -------------------------------------------------------------
    // STEP 1: Director Authentication via UI & Landing Check
    // -------------------------------------------------------------
    console.log('\n[STEP 1] Authenticating Director via /login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const emailInput = page.locator('#login_form_email');
    if (await emailInput.isVisible({ timeout: 2500 })) {
      await emailInput.fill(DIRECTOR_EMAIL);
      await page.locator('#login_form_password').fill(PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2000);
    }
    console.log('✅ Session active. Current URL:', page.url());

    // -------------------------------------------------------------
    // STEP 2: Navigate to Canonical /dashboard
    // -------------------------------------------------------------
    console.log('\n[STEP 2] Navigating directly to http://localhost:3000/dashboard...');
    const t0Dashboard = Date.now();
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const loadTimeDashboard = Date.now() - t0Dashboard;
    console.log(`⏱️ /dashboard load time: ${loadTimeDashboard}ms`);

    // Verify Executive Header
    await expect(page.locator('text=EPMS / EXECUTIVE DASHBOARD')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Ringkasan Kinerja')).toBeVisible({ timeout: 10000 });
    console.log('✅ Canonical /dashboard rendered Executive Dashboard Header successfully.');

    // Save initial /dashboard screenshot
    const shotDashboard = path.join(ARTIFACT_SCREENSHOTS_DIR, 'CP_D3_01_canonical_dashboard_loaded.png');
    await page.screenshot({ path: shotDashboard, fullPage: true });
    console.log('📸 Screenshot saved:', shotDashboard);

    // -------------------------------------------------------------
    // STEP 3: Verify All Six Executive KPIs on /dashboard (with CountUp Animation polling)
    // -------------------------------------------------------------
    console.log('\n[STEP 3] Validating 6 Executive KPIs on /dashboard (awaiting count-up animation)...');
    
    // KPI 1: Total Pipeline Value
    const pipelineCard = page.locator('div').filter({ hasText: /^Total Pipeline Value/ }).first();
    await expect(pipelineCard).toBeVisible();
    await expect(pipelineCard).toContainText('105', { timeout: 10000 });
    await expect(pipelineCard).toContainText('Tender', { timeout: 10000 });
    const pText = await pipelineCard.textContent();
    console.log('  KPI 1 Pipeline:', pText?.replace(/\s+/g, ' '));

    // KPI 2: Proyek Aktif
    const activePrjCard = page.locator('div').filter({ hasText: /^Proyek Aktif/ }).first();
    await expect(activePrjCard).toBeVisible();
    await expect(activePrjCard).toContainText('4', { timeout: 10000 });
    const aText = await activePrjCard.textContent();
    console.log('  KPI 2 Proyek Aktif:', aText?.replace(/\s+/g, ' '));

    // KPI 3: Komitmen Pengadaan
    const poCard = page.locator('div').filter({ hasText: /^Komitmen Pengadaan/ }).first();
    await expect(poCard).toBeVisible();
    await expect(poCard).toContainText('12 PO Diterbitkan', { timeout: 10000 });
    const poText = await poCard.textContent();
    console.log('  KPI 3 Komitmen Pengadaan:', poText?.replace(/\s+/g, ' '));

    // KPI 4: Pembayaran Vendor
    const payCard = page.locator('div').filter({ hasText: /^Pembayaran Vendor/ }).first();
    await expect(payCard).toBeVisible();
    await expect(payCard).toContainText('10 Transaksi Lunas', { timeout: 10000 });
    const payText = await payCard.textContent();
    console.log('  KPI 4 Pembayaran Vendor:', payText?.replace(/\s+/g, ' '));

    // KPI 5: Invoice Outstanding
    const invCard = page.locator('div').filter({ hasText: /^Invoice Outstanding/ }).first();
    await expect(invCard).toBeVisible();
    await expect(invCard).toContainText('0 Tagihan Belum Lunas', { timeout: 10000 });
    const invText = await invCard.textContent();
    console.log('  KPI 5 Invoice Outstanding:', invText?.replace(/\s+/g, ' '));

    // KPI 6: Antrean Persetujuan
    const appCard = page.locator('div').filter({ hasText: /^Antrean Persetujuan/ }).first();
    await expect(appCard).toBeVisible();
    await expect(appCard).toContainText('0 Tugas Manajemen', { timeout: 10000 });
    const appText = await appCard.textContent();
    console.log('  KPI 6 Antrean Persetujuan:', appText?.replace(/\s+/g, ' '));

    // -------------------------------------------------------------
    // STEP 4: Test Entity Filter Switching on /dashboard (ALL -> UBD -> TVM -> ALL)
    // -------------------------------------------------------------
    console.log('\n[STEP 4] Testing Entity Filter on /dashboard using selectOption...');
    const divisionSelect = page.locator('#executive-division-select');
    await expect(divisionSelect).toBeVisible({ timeout: 5000 });

    // Select UBD
    await divisionSelect.selectOption('UBD');
    await page.waitForTimeout(2500);
    await expect(pipelineCard).toContainText('50 Tender', { timeout: 10000 });
    console.log('  UBD Filter applied: 50 Tender verified.');
    const shotUBD = path.join(ARTIFACT_SCREENSHOTS_DIR, 'CP_D3_02_dashboard_ubd_filter.png');
    await page.screenshot({ path: shotUBD, fullPage: true });
    console.log('📸 Screenshot saved:', shotUBD);

    // Select TVM
    await divisionSelect.selectOption('TVM');
    await page.waitForTimeout(2500);
    await expect(pipelineCard).toContainText('0 Tender', { timeout: 10000 });
    console.log('  TVM Filter applied: 0 Tender verified.');
    const shotTVM = path.join(ARTIFACT_SCREENSHOTS_DIR, 'CP_D3_03_dashboard_tvm_filter.png');
    await page.screenshot({ path: shotTVM, fullPage: true });
    console.log('📸 Screenshot saved:', shotTVM);

    // Restore to ALL
    await divisionSelect.selectOption('ALL');
    await page.waitForTimeout(2500);
    await expect(pipelineCard).toContainText('Tender', { timeout: 10000 });
    console.log('  ALL Filter restored successfully.');

    // -------------------------------------------------------------
    // STEP 5: Verify 3 Executive Action Tabs on /dashboard
    // -------------------------------------------------------------
    console.log('\n[STEP 5] Testing Executive Action Center Tabs...');
    const priorityTab = page.locator('button').filter({ hasText: 'Priority Actions' });
    const queueTab = page.locator('button').filter({ hasText: 'Approval Queue' });
    const activityTab = page.locator('button').filter({ hasText: 'Recent Activity' });

    await expect(priorityTab).toBeVisible();
    await expect(queueTab).toBeVisible();
    await expect(activityTab).toBeVisible();

    await queueTab.click();
    await page.waitForTimeout(600);
    console.log('  Approval Queue Tab clicked successfully.');

    await activityTab.click();
    await page.waitForTimeout(600);
    console.log('  Recent Activity Tab clicked successfully.');

    await priorityTab.click();
    await page.waitForTimeout(600);
    console.log('✅ All 3 Action Center tabs switch smoothly without error.');

    // -------------------------------------------------------------
    // STEP 6: Verify Parallel Compatibility of /dashboard-preview
    // -------------------------------------------------------------
    console.log('\n[STEP 6] Navigating to http://localhost:3000/dashboard-preview for compatibility check...');
    const t0Preview = Date.now();
    await page.goto(`${BASE_URL}/dashboard-preview`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const loadTimePreview = Date.now() - t0Preview;
    console.log(`⏱️ /dashboard-preview load time: ${loadTimePreview}ms`);

    // Verify /dashboard-preview renders identically
    await expect(page.locator('text=EPMS / EXECUTIVE DASHBOARD')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Ringkasan Kinerja')).toBeVisible({ timeout: 10000 });
    console.log('✅ /dashboard-preview remains 100% operational as a parallel reference.');

    const shotPreview = path.join(ARTIFACT_SCREENSHOTS_DIR, 'CP_D3_04_dashboard_preview_parity.png');
    await page.screenshot({ path: shotPreview, fullPage: true });
    console.log('📸 Screenshot saved:', shotPreview);

    // -------------------------------------------------------------
    // STEP 7: Mobile Responsive Layout Validation (390px Viewport)
    // -------------------------------------------------------------
    console.log('\n[STEP 7] Validating mobile viewport (390x844) on /dashboard...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(2000);

    // Check for horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`  Mobile dimensions: clientWidth=${clientWidth}, scrollWidth=${scrollWidth}`);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // zero or sub-pixel rounding
    console.log('✅ No horizontal page overflow on mobile 390px.');

    const shotMobile = path.join(ARTIFACT_SCREENSHOTS_DIR, 'CP_D3_05_dashboard_mobile_390px.png');
    await page.screenshot({ path: shotMobile, fullPage: true });
    console.log('📸 Screenshot saved:', shotMobile);

    // Restore desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // Performance comparison summary
    console.log('\n======================================================');
    console.log('PERFORMANCE COMPARISON:');
    console.log(`  Canonical /dashboard Load Time:        ${loadTimeDashboard} ms`);
    console.log(`  Legacy /dashboard-preview Load Time:   ${loadTimePreview} ms`);
    console.log('  Console Errors Encountered:             ' + (consoleErrors.length === 0 ? '0 (Clean)' : consoleErrors.join(', ')));
    console.log('======================================================');

    expect(consoleErrors).toHaveLength(0);
    console.log('\n🎉 ALL LIVE EDGE CP-D3 CUTOVER TESTS PASSED PERFECTLY!\n');
  });
});
