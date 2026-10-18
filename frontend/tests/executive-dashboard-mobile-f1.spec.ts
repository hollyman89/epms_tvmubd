import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginViaUi } from './canonical-lifecycle-helpers';

const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');
const ARTIFACT_DIR = 'C:\\Users\\UBDOPS3\\.gemini\\antigravity-ide\\brain\\c64d9b06-e194-4d03-96f7-231144e1b37f';

async function saveScreenshot(page: any, filename: string) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  const localPath = path.join(SCREENSHOT_DIR, filename);
  const artifactPath = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: true });
  try {
    fs.copyFileSync(localPath, artifactPath);
    console.log(`[SCREENSHOT] Saved: ${filename}`);
  } catch (err: any) {
    console.warn(`[SCREENSHOT] Failed to copy to artifact dir: ${err?.message}`);
  }
}

test.describe('EPMS Executive Dashboard Responsive F1 Validation', () => {
  test('Validate responsive layout, zero horizontal overflow, and capture F1 screenshots in visible Chrome', async ({ page }) => {
    test.setTimeout(240000);

    const baseUrl = 'http://localhost:3000';
    console.log('\n[F1 TEST START] Logging in as Director via UI...');

    await loginViaUi(page, baseUrl, 'director@epms.com', '123456');

    console.log('[F1 TEST] Navigating to /dashboard...');
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Wait for Dashboard to render
    const heading = page.locator('h1', { hasText: 'Executive Management Dashboard' });
    await expect(heading).toBeVisible({ timeout: 15000 });
    console.log('[F1 TEST] Dashboard header visible.');

    // Wait for data hydration
    await page.waitForTimeout(2000);

    const viewports = [
      { name: 'Desktop 1920', width: 1920, height: 1080, screenshot: 'dashboard_f1_1920.png', category: 'desktop' },
      { name: 'Desktop 1440', width: 1440, height: 900, screenshot: 'dashboard_f1_1440.png', category: 'desktop' },
      { name: 'Desktop 1366', width: 1366, height: 768, screenshot: 'dashboard_f1_1366.png', category: 'desktop' },
      { name: 'Desktop 1280', width: 1280, height: 800, screenshot: 'dashboard_f1_1280.png', category: 'desktop' },
      { name: 'Tablet 1024', width: 1024, height: 768, screenshot: 'dashboard_f1_1024.png', category: 'tablet' },
      { name: 'Tablet 820', width: 820, height: 1180, screenshot: 'dashboard_f1_820.png', category: 'tablet' },
      { name: 'Tablet 768', width: 768, height: 1024, screenshot: 'dashboard_f1_768.png', category: 'tablet' },
      { name: 'Mobile 430', width: 430, height: 932, screenshot: 'dashboard_f1_430.png', category: 'mobile' },
      { name: 'Mobile 390', width: 390, height: 844, screenshot: 'dashboard_f1_390.png', category: 'mobile' },
      { name: 'Mobile 375', width: 375, height: 812, screenshot: 'dashboard_f1_375.png', category: 'mobile' },
      { name: 'Boundary 767', width: 767, height: 1024, screenshot: 'dashboard_f1_767.png', category: 'boundary' },
      { name: 'Boundary 768', width: 768, height: 1024, screenshot: null, category: 'boundary' },
      { name: 'Boundary 769', width: 769, height: 1024, screenshot: 'dashboard_f1_769.png', category: 'boundary' },
    ];

    const f1Results: Record<string, any> = {};

    for (const vp of viewports) {
      console.log(`\n========================================`);
      console.log(`[F1 VALIDATION] Testing ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`========================================`);

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(600); // allow responsive reflow

      // Measure in browser
      const measurements = await page.evaluate((currentVp) => {
        const docEl = document.documentElement;
        const body = document.body;

        // Normal metrics
        const clientWidth = docEl.clientWidth;
        const scrollWidth = docEl.scrollWidth;
        const normalOverflow = Math.max(0, scrollWidth - clientWidth);

        // Temporarily disable overflow clipping to test REAL unclipped DOM
        const origHtmlOverflow = docEl.style.overflowX;
        const origBodyOverflow = body.style.overflowX;
        docEl.style.setProperty('overflow-x', 'visible', 'important');
        body.style.setProperty('overflow-x', 'visible', 'important');

        const unclippedScrollWidth = docEl.scrollWidth;
        const unclippedOverflow = Math.max(0, unclippedScrollWidth - clientWidth);

        // Restore
        docEl.style.overflowX = origHtmlOverflow;
        body.style.overflowX = origBodyOverflow;

        // Check Sider presence
        const sider = document.querySelector('.epms-sidebar-sider');
        const siderVisible = sider ? window.getComputedStyle(sider).display !== 'none' : false;
        const siderWidth = sider ? sider.getBoundingClientRect().width : 0;

        // Check Row 1 KPI Grid columns
        const kpiGrid = document.querySelector('[class*="kpiGrid"]');
        let kpiCols = 'unknown';
        if (kpiGrid) {
          const style = window.getComputedStyle(kpiGrid);
          kpiCols = style.gridTemplateColumns;
        }

        // Check Row 2 Management
        const mgmtRow = document.querySelector('[class*="managementRow"]');
        let mgmtCols = 'unknown';
        if (mgmtRow) {
          mgmtCols = window.getComputedStyle(mgmtRow).gridTemplateColumns;
        }

        // Check Row 2 Highlights Internal Grid
        const hlGrid = document.querySelector('[class*="highlightsTileGrid"]');
        let hlCols = 'unknown';
        if (hlGrid) {
          hlCols = window.getComputedStyle(hlGrid).gridTemplateColumns;
        }

        // Check Row 3 Domain Cards Grid
        const domGrid = document.querySelector('[class*="domainGrid"]');
        let domCols = 'unknown';
        if (domGrid) {
          domCols = window.getComputedStyle(domGrid).gridTemplateColumns;
        }

        // Check Row 4 Pulse Grid
        const pulseGrid = document.querySelector('[class*="operationalPulseGrid"]');
        let pulseCols = 'unknown';
        if (pulseGrid) {
          pulseCols = window.getComputedStyle(pulseGrid).gridTemplateColumns;
        }

        // Dashboard container padding
        const dashContainer = document.querySelector('[class*="dashboardContainer"]');
        let dashPadding = 'unknown';
        if (dashContainer) {
          const comp = window.getComputedStyle(dashContainer);
          dashPadding = `${comp.paddingTop} ${comp.paddingRight} ${comp.paddingBottom} ${comp.paddingLeft}`;
        }

        return {
          clientWidth,
          scrollWidth,
          normalOverflow,
          unclippedScrollWidth,
          unclippedOverflow,
          siderVisible,
          siderWidth,
          kpiCols,
          mgmtCols,
          hlCols,
          domCols,
          pulseCols,
          dashPadding,
        };
      }, vp);

      console.log(`  clientWidth: ${measurements.clientWidth}px`);
      console.log(`  scrollWidth: ${measurements.scrollWidth}px (overflow: ${measurements.normalOverflow}px)`);
      console.log(`  unclippedScrollWidth: ${measurements.unclippedScrollWidth}px (unclipped overflow: ${measurements.unclippedOverflow}px)`);
      console.log(`  Sider visible: ${measurements.siderVisible} (${measurements.siderWidth}px)`);
      console.log(`  Dashboard Padding: ${measurements.dashPadding}`);
      const kpiCount = measurements.kpiCols !== 'unknown' ? measurements.kpiCols.trim().split(/\s+/).length : 'unknown';
      const mgmtCount = measurements.mgmtCols !== 'unknown' ? measurements.mgmtCols.trim().split(/\s+/).length : 'unknown';
      const domCount = measurements.domCols !== 'unknown' ? measurements.domCols.trim().split(/\s+/).length : 'unknown';
      console.log(`  KPI grid cols: ${kpiCount} columns (${measurements.kpiCols})`);
      console.log(`  Management grid: ${mgmtCount} columns (${measurements.mgmtCols})`);
      console.log(`  Domain grid: ${domCount} columns (${measurements.domCols})`);

      const pass = measurements.unclippedOverflow === 0 && measurements.normalOverflow === 0;
      console.log(`  RESULT: ${pass ? 'PASS' : 'FAIL'}`);

      f1Results[vp.name] = {
        ...vp,
        ...measurements,
        pass,
      };

      if (vp.screenshot) {
        await saveScreenshot(page, vp.screenshot);
      }

      // Hard assertion for overflow
      expect(measurements.normalOverflow, `${vp.name} must have 0px normal horizontal overflow`).toBe(0);
      expect(measurements.unclippedOverflow, `${vp.name} must have 0px unclipped horizontal overflow`).toBe(0);
    }

    // Boundary 767 / 768 / 769 assertion
    console.log('\n--- BOUNDARY 767 / 768 / 769 VERIFICATION ---');
    console.log(`767px Sider visible: ${f1Results['Boundary 767'].siderVisible} (expected false)`);
    console.log(`768px Sider visible: ${f1Results['Tablet 768'].siderVisible} (expected false)`);
    console.log(`769px Sider visible: ${f1Results['Boundary 769'].siderVisible} (expected true)`);

    expect(f1Results['Boundary 767'].siderVisible).toBe(false);
    expect(f1Results['Tablet 768'].siderVisible).toBe(false);
    expect(f1Results['Boundary 769'].siderVisible).toBe(true);

    // Save full measurement data
    const resultsPath = path.resolve(__dirname, 'f1-measurements.json');
    fs.writeFileSync(resultsPath, JSON.stringify(f1Results, null, 2));
    console.log(`\n[F1 COMPLETED] All viewports verified successfully. Results written to ${resultsPath}`);
  });
});
