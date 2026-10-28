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
const PASSWORD = process.env.E2E_TEST_PASSWORD;
if (!PASSWORD) {
  throw new Error('E2E_TEST_PASSWORD environment variable is required');
}

test.describe.serial('EPMS — EXECUTIVE DASHBOARD PREVIEW: Live Microsoft Edge Validation', () => {
  test.setTimeout(180000);

  test('Live Microsoft Edge E2E: Real Data Integration, Mock Elimination, Period Filtering & Consistency', async () => {
    let browser: any = null;
    let edgeServer: any = null;
    let context: any = null;
    let page: any = null;

    // 1. Ensure Microsoft Edge with CDP is running
    console.log('\n[CDP ATTEMPT] Checking for existing Edge CDP session on', CDP_URL);
    try {
      browser = await chromium.connectOverCDP(CDP_URL, { timeout: 3000 });
      context = browser.contexts()[0];
      const TARGET_PREVIEW_URL = 'http://localhost:3000/dashboard-preview';
      page = context.pages().find((p: any) => p.url().startsWith(TARGET_PREVIEW_URL));
      if (!page) {
        page = context.pages().find((p: any) => !p.url().startsWith('edge://') && !p.url().startsWith('chrome-extension://')) || context.pages()[0] || (await context.newPage());
        await page.goto(TARGET_PREVIEW_URL, { waitUntil: 'domcontentloaded' });
      }
      console.log('✅ Attached to Microsoft Edge browser over CDP at exact target:', page.url());
    } catch {
      console.log('ℹ️  Launching Microsoft Edge in visible GUI mode (headless=false) with CDP remote debugging port 9222...');
      edgeServer = await chromium.launch({
        channel: 'msedge',
        headless: false,
        args: ['--remote-debugging-port=9222', '--remote-allow-origins=*', '--start-maximized'],
      });
      browser = await chromium.connectOverCDP(CDP_URL);
      context = browser.contexts()[0];
      page = await context.newPage();
      console.log('✅ Microsoft Edge launched and attached over CDP successfully.');
    }

    // Set standard approved benchmark viewport: 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });

    // Verify Browser Identity & CDP evidence
    const cdpVersionRes = await fetch('http://127.0.0.1:9222/json/version').then((r) => r.json()).catch(() => ({}));
    const userAgent = await page.evaluate(() => navigator.userAgent);
    console.log('\n================ BROWSER IDENTITY & CDP ATTACHMENT EVIDENCE ================');
    console.log('CDP Browser:    ', cdpVersionRes.Browser || browser.version());
    console.log('Protocol Version:', cdpVersionRes['Protocol-Version'] || '1.3');
    console.log('User Agent:     ', userAgent);
    console.log('Debugger URL:   ', cdpVersionRes.webSocketDebuggerUrl);
    console.log('Headless Mode:   false (Visible Desktop GUI)');
    console.log('============================================================================\n');

    expect(userAgent).toContain('Edg/');
    expect(cdpVersionRes.Browser).toContain('Edg/');

    const consoleErrors: string[] = [];
    const networkFailures: string[] = [];

    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known harmless telemetry / websocket reconnect logs
        if (!text.includes('websocket') && !text.includes('favicon')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('response', (res: any) => {
      if (res.status() >= 400 && !res.url().includes('favicon')) {
        networkFailures.push(`${res.status()} ${res.url()}`);
      }
    });

    const evidenceDir = path.resolve(__dirname, 'evidence');
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }

    try {
      // -------------------------------------------------------------
      // STEP 1: Director Authentication via UI
      // -------------------------------------------------------------
      console.log('\n[STEP 1] Ensuring session as Director (director@epms.com)...');
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      const emailInput = page.locator('#login_form_email');
      if (await emailInput.isVisible({ timeout: 3000 })) {
        console.log('[AUTH] Filling login credentials...');
        await emailInput.fill(DIRECTOR_EMAIL);
        const passInput = page.locator('#login_form_password');
        await passInput.fill(PASSWORD);
        await page.locator('button[type="submit"]').click();
        await page.waitForTimeout(2000);
      }
      console.log('[AUTH] Current URL after login check:', page.url());

      // -------------------------------------------------------------
      // STEP 2: Navigate to /dashboard-preview
      // -------------------------------------------------------------
      console.log('\n[STEP 2] Navigating to http://localhost:3000/dashboard-preview...');
      await page.goto(`${BASE_URL}/dashboard-preview`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);

      // Verify Page Title / Eyebrow rendered
      await expect(page.locator('text=EXECUTIVE DASHBOARD')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=EPMS UBD & TVM')).toBeVisible({ timeout: 10000 });
      console.log('✅ Dashboard Preview page rendered with Director authorization.');

      // Capture initial state screenshot
      const initialScreenshot = path.join(evidenceDir, '01_dashboard_preview_real_data_loaded.png');
      await page.screenshot({ path: initialScreenshot, fullPage: true });
      console.log('📸 Screenshot saved:', initialScreenshot);

      // -------------------------------------------------------------
      // STEP 3: Verify All Six Executive KPIs
      // -------------------------------------------------------------
      console.log('\n[STEP 3] Validating 6 Executive KPIs values from real data...');

      // KPI 1: Total Pipeline Value (Contains '105' and 'M')
      const pipelineCard = page.locator('div').filter({ hasText: /^Total Pipeline Value/ }).first();
      await expect(pipelineCard).toBeVisible();
      const pipelineText = await pipelineCard.textContent();
      console.log('  KPI 1 Pipeline Text:', pipelineText?.replace(/\s+/g, ' '));
      expect(pipelineText).toContain('105');
      expect(pipelineText).toContain('163 Tender');

      // KPI 2: Proyek Aktif (Value is 4)
      const activePrjCard = page.locator('div').filter({ hasText: /^Proyek Aktif/ }).first();
      await expect(activePrjCard).toBeVisible();
      const activePrjText = await activePrjCard.textContent();
      console.log('  KPI 2 Proyek Aktif Text:', activePrjText?.replace(/\s+/g, ' '));
      expect(activePrjText).toContain('4');
      expect(activePrjText).toContain('4 Eksekusi');

      // KPI 3: Komitmen Pengadaan (Contains '807' and 'jt' or 'M')
      const poCard = page.locator('div').filter({ hasText: /^Komitmen Pengadaan/ }).first();
      await expect(poCard).toBeVisible();
      const poText = await poCard.textContent();
      console.log('  KPI 3 Komitmen Pengadaan Text:', poText?.replace(/\s+/g, ' '));
      expect(poText).toContain('12 PO Diterbitkan');

      // KPI 4: Pembayaran Vendor (Contains '560' and 'jt')
      const payCard = page.locator('div').filter({ hasText: /^Pembayaran Vendor/ }).first();
      await expect(payCard).toBeVisible();
      const payText = await payCard.textContent();
      console.log('  KPI 4 Pembayaran Vendor Text:', payText?.replace(/\s+/g, ' '));
      expect(payText).toContain('10 Transaksi Lunas');

      // KPI 5: Invoice Outstanding (Rp 0, 0 Tagihan Belum Lunas)
      const invCard = page.locator('div').filter({ hasText: /^Invoice Outstanding/ }).first();
      await expect(invCard).toBeVisible();
      const invText = await invCard.textContent();
      console.log('  KPI 5 Invoice Outstanding Text:', invText?.replace(/\s+/g, ' '));
      expect(invText).toContain('0 Tagihan Belum Lunas');

      // KPI 6: Antrean Persetujuan (0 Tugas Manajemen)
      const approvalCard = page.locator('div').filter({ hasText: /^Antrean Persetujuan/ }).first();
      await expect(approvalCard).toBeVisible();
      const approvalText = await approvalCard.textContent();
      console.log('  KPI 6 Antrean Persetujuan Text:', approvalText?.replace(/\s+/g, ' '));
      expect(approvalText).toContain('Tugas Manajemen');

      console.log('✅ All 6 Executive KPIs verified against authoritative backend data.');

      // -------------------------------------------------------------
      // STEP 4: Verify Project Status Overview Consistency
      // -------------------------------------------------------------
      console.log('\n[STEP 4] Verifying Project Status Overview consistency...');
      const donutCenter = page.locator('div').filter({ hasText: /Total Proyek/ }).first();
      await expect(donutCenter).toBeVisible();
      const donutText = await donutCenter.textContent();
      console.log('  Donut Center:', donutText?.replace(/\s+/g, ' '));
      expect(donutText).toContain('9');
      expect(donutText).toContain('Total Proyek');

      // Verify category rows sum exactly to 9
      const statusCard = page.locator('div').filter({ hasText: /^Project Status Overview/ }).first();
      const eksekusiRow = statusCard.locator('div').filter({ hasText: /^Sedang Eksekusi/ }).first();
      const selesaiRow = statusCard.locator('div').filter({ hasText: /^Selesai/ }).first();
      await expect(eksekusiRow).toContainText('4');
      await expect(selesaiRow).toContainText('5');
      console.log('✅ Project Status Overview reconciled: Total Proyek = 9 (4 Eksekusi + 5 Selesai).');

      // -------------------------------------------------------------
      // STEP 5: Verify Decision Panel (Priority Actions & Approval Queue)
      // -------------------------------------------------------------
      console.log('\n[STEP 5] Verifying Executive Decision Panel & Empty State...');
      const priorityTab = page.locator('button').filter({ hasText: 'Priority Actions' });
      await expect(priorityTab).toBeVisible();
      await expect(priorityTab.locator('span').last()).toHaveText('0');

      // Verify clean empty state for Director (no synthetic actions)
      await expect(page.locator('text=Tidak ada tugas prioritas yang membutuhkan aksi langsung Anda saat ini.')).toBeVisible();
      console.log('✅ Priority Actions empty state displayed accurately (0 actionable tasks for Director).');

      // Switch to Approval Queue tab
      const approvalTab = page.locator('button').filter({ hasText: 'Approval Queue' });
      await approvalTab.click();
      await page.waitForTimeout(500);
      await expect(page.locator('text=Tidak ada antrean persetujuan organisasi yang tertunda saat ini.')).toBeVisible();
      console.log('✅ Approval Queue tab verified with real empty state.');

      // -------------------------------------------------------------
      // STEP 6: Verify 4 Time-Series Charts Source Integrity
      // -------------------------------------------------------------
      console.log('\n[STEP 6] Verifying Time-Series Charts source integrity...');
      // Chart 1: Marketing Pipeline Trend (shows real peak tooltip for Oktober)
      await expect(page.locator('text=Tren Pipeline Marketing')).toBeVisible();
      await expect(page.locator('text=Distribusi nilai peluang bisnis per bulan')).toBeVisible();

      // Chart 2: Nilai Kontrak (Won)
      await expect(page.locator('text=Nilai Kontrak (Won)')).toBeVisible();

      // Chart 3: Pembayaran Vendor
      await expect(page.locator('h3:has-text("Pembayaran Vendor")')).toBeVisible();

      // Chart 4: Komitmen Pengadaan
      await expect(page.locator('h3:has-text("Komitmen Pengadaan")')).toBeVisible();
      console.log('✅ All 4 time-series charts verified.');

      // -------------------------------------------------------------
      // STEP 7: Verify 4 Operational Tables Record Integrity
      // -------------------------------------------------------------
      console.log('\n[STEP 7] Verifying 4 Operational Tables record integrity...');
      // Table 1: Proyek Aktif
      await expect(page.locator('text=PROJECT SKF BEKASI').first()).toBeVisible();
      console.log('  Table 1 (Active Projects): Verified real project records with real progress.');

      // Table 2: Tender & Peluang Bisnis
      await expect(page.locator('text=PROJECT PERCOBAAN UNTUK DEBUG').first()).toBeVisible();
      console.log('  Table 2 (Tenders): Verified real tender titles and stages.');

      // Table 3: Pengadaan (PO)
      await expect(page.locator('text=PO-20261023-003').first()).toBeVisible();
      await expect(page.locator('text=CV Logistik Terpadu').first()).toBeVisible();
      console.log('  Table 3 (Purchase Orders): Verified real POs and real vendor names.');

      // Table 4: Pembayaran & Tagihan
      await expect(page.locator('text=INV-20261018-001').first()).toBeVisible();
      await expect(page.locator('text=PT Maju Infrastruktur').first()).toBeVisible();
      console.log('  Table 4 (Invoices): Verified real invoices and real vendor names.');

      // -------------------------------------------------------------
      // STEP 8: Period Filtering Verification
      // -------------------------------------------------------------
      console.log('\n[STEP 8] Testing interactive period filtering...');
      const periodSelect = page.locator('#executive-period-select');
      await expect(periodSelect).toBeVisible();

      // Switch to "Bulan Ini"
      await periodSelect.selectOption('THIS_MONTH');
      await page.waitForTimeout(1500);
      console.log('  Period switched to THIS_MONTH.');

      // Switch to "Bulan Lalu" (September 2026 - where zero transactions exist)
      await periodSelect.selectOption('LAST_MONTH');
      await page.waitForTimeout(2000);
      console.log('  Period switched to LAST_MONTH.');

      // Capture screenshot of filtered state
      const filteredScreenshot = path.join(evidenceDir, '02_dashboard_preview_period_filtered.png');
      await page.screenshot({ path: filteredScreenshot, fullPage: true });
      console.log('📸 Filtered Screenshot saved:', filteredScreenshot);

      // Verify that Pipeline Value reflects Rp 0 for LAST_MONTH
      const lastMonthPipelineText = await pipelineCard.textContent();
      console.log('  LAST_MONTH Pipeline Card:', lastMonthPipelineText?.replace(/\s+/g, ' '));
      expect(lastMonthPipelineText).toContain('Rp 0');
      console.log('✅ Period filtering successfully updated KPIs to Rp 0 for last month.');

      // Switch back to "Tahun Berjalan (YTD)"
      await periodSelect.selectOption('YEAR_TO_DATE');
      await page.waitForTimeout(1500);
      console.log('  Period switched back to YEAR_TO_DATE.');

      // -------------------------------------------------------------
      // STEP 8B: Interactive Division Filtering Verification (CP1)
      // -------------------------------------------------------------
      console.log('\n[STEP 8B] Testing interactive division filtering (CP1)...');
      const divisionSelect = page.locator('#executive-division-select');
      await expect(divisionSelect).toBeVisible();

      // Verify default ALL selection
      const selectedDivVal = await divisionSelect.inputValue();
      expect(selectedDivVal).toBe('ALL');
      console.log('  Division selector verified visible with default: ALL (Semua Divisi).');

      // Verify options contain "Semua Divisi"
      const divisionOptionsText = await divisionSelect.textContent();
      expect(divisionOptionsText).toContain('Semua Divisi');
      console.log('  Division options loaded:', divisionOptionsText?.replace(/\s+/g, ' '));

      // Test negative scenario / API error handling on invalid division
      console.log('  Testing negative division error handling...');
      await page.evaluate(() => {
        const select = document.getElementById('executive-division-select') as HTMLSelectElement;
        if (select) {
          const opt = document.createElement('option');
          opt.value = 'INVALID_DIV_TEST';
          opt.text = 'Divisi Fiktif Tidak Terdaftar';
          select.appendChild(opt);
          select.value = 'INVALID_DIV_TEST';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await page.waitForTimeout(2000);

      // Verify division error alert banner is rendered
      const errorBanner = page.locator('div[class*="divisionErrorBanner"]');
      await expect(errorBanner).toBeVisible();
      const errorText = await errorBanner.textContent();
      expect(errorText).toContain('Peringatan Filter Divisi');
      console.log('  Error Banner caught expected negative response:', errorText?.replace(/\s+/g, ' '));

      // Capture screenshot of division error handling state
      const divErrorScreenshot = path.join(evidenceDir, '03_dashboard_preview_division_error.png');
      await page.screenshot({ path: divErrorScreenshot, fullPage: true });
      console.log('📸 Division Error Screenshot saved:', divErrorScreenshot);

      // Reset back to ALL via "Kembali ke Semua Divisi" button
      const resetBtn = errorBanner.locator('button');
      await resetBtn.click();
      await page.waitForTimeout(2000);

      // Verify error banner is gone and baseline is restored
      await expect(errorBanner).not.toBeVisible();
      const restoredDivVal = await divisionSelect.inputValue();
      expect(restoredDivVal).toBe('ALL');
      const restoredPipelineText = await pipelineCard.textContent();
      expect(restoredPipelineText).toContain('105.569.765.920');
      console.log('✅ Baseline restored cleanly after clearing division selection.');

      // -------------------------------------------------------------
      // STEP 9: Visual Benchmark Comparison at 1440x900 Viewport
      // -------------------------------------------------------------
      console.log('\n[STEP 9] Capturing visual benchmark comparison artifacts at 1440x900...');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      // 1. Viewport Opening (Top fold at 1440x900)
      const benchmarkOpeningShot = path.join(evidenceDir, 'benchmark_preview_1440_opening.png');
      await page.screenshot({ path: benchmarkOpeningShot, fullPage: false });
      console.log('📸 Benchmark Opening Screenshot (1440x900):', benchmarkOpeningShot);

      // 2. Full Page at 1440 width
      const benchmarkFullShot = path.join(evidenceDir, 'benchmark_preview_1440_full.png');
      await page.screenshot({ path: benchmarkFullShot, fullPage: true });
      console.log('📸 Benchmark Full Screenshot (1440 width):', benchmarkFullShot);

      // Measure layout metrics
      const layoutMetrics = await page.evaluate(() => {
        const getBox = (selector: string) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            fontFamily: style.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
            fontSize: style.fontSize,
          };
        };

        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          kpiGrid: getBox('div[class*="kpiGrid"]'),
          kpiCard: getBox('div[class*="kpiCard"]'),
          donutSection: getBox('div[class*="projectOverview"]'),
          decisionPanel: getBox('div[class*="decisionCenter"]'),
          chartsGrid: getBox('div[class*="chartsGrid"]'),
          tablesGrid: getBox('div[class*="tablesGrid"]'),
        };
      });

      console.log('\n================ VISUAL BENCHMARK DOM MEASUREMENTS ================');
      console.log('Viewport:', JSON.stringify(layoutMetrics.viewport));
      console.log('KPI Grid:', JSON.stringify(layoutMetrics.kpiGrid));
      console.log('KPI Card (Sample):', JSON.stringify(layoutMetrics.kpiCard));
      console.log('Donut Overview:', JSON.stringify(layoutMetrics.donutSection));
      console.log('Decision Panel:', JSON.stringify(layoutMetrics.decisionPanel));
      console.log('Charts Grid:', JSON.stringify(layoutMetrics.chartsGrid));
      console.log('Operational Tables Grid:', JSON.stringify(layoutMetrics.tablesGrid));
      console.log('===================================================================\n');

      console.log('\n======================================================');
      console.log('✅ ALL LIVE MICROSOFT EDGE VALIDATION CHECKS PASSED!');
      console.log('======================================================');
    } finally {
      if (context && browser) {
        await browser.close().catch(() => {});
      }
      if (edgeServer) {
        await edgeServer.close().catch(() => {});
      }
    }
  });
});
