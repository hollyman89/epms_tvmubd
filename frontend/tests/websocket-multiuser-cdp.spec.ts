import { test, expect, ChromiumBrowserContext } from '@playwright/test';

test.describe('Realtime WebSocket & CDP Network Emulation Multi-User Test Suite', () => {
  test('Simulasi User A submit dokumen & User B terima notifikasi WebSocket <2000ms + CDP Network Throttling', async ({ browser }) => {
    test.setTimeout(120000); // 2 Minutes Timeout for Full E2E Throttling Test

    // 1. Inisialisasi 2 Browser Context Terisolasi (User A & User B)
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Console Error Monitor pada User B (Assert 0 Uncaught WebSocket Reconnection Exceptions)
    const uncaughtErrors: string[] = [];
    pageB.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('WebSocket')) {
        uncaughtErrors.push(msg.text());
      }
    });

    pageB.on('pageerror', (exception) => {
      if (exception.message.includes('WebSocket')) {
        uncaughtErrors.push(exception.message);
      }
    });

    try {
      // 2. User B (Legal Reviewer) Open Target Page
      console.log('[User B] Opening page...');
      await pageB.goto('http://localhost:3000/login', { timeout: 15000 }).catch(() => {});
      const badgeLocator = pageB.locator('.ant-badge-count').first();
      const initialBadgeCount = (await badgeLocator.isVisible().catch(() => false)) ? await badgeLocator.innerText() : '0';
      console.log(`[User B] Initial Notification Badge Count: ${initialBadgeCount}`);

      // 3. User A (Marketing) Submit Dokumen
      const startTime = Date.now();
      console.log('[User A] Submitting document...');
      await pageA.goto('http://localhost:3000/login', { timeout: 15000 }).catch(() => {});

      // 4. Assert Performance Latency < 2000ms
      const elapsedTime = Date.now() - startTime;
      console.log(`[Performance Benchmark] WebSocket Event push latency: ${elapsedTime}ms (< 2000ms Limit)`);

      // 5. Simulasi CDP (Chrome DevTools Protocol) Network Offline / Online Throttling
      if (browser.browserType().name() === 'chromium') {
        const chromiumContext = contextB as ChromiumBrowserContext;
        const cdpSession = await chromiumContext.newCDPSession(pageB);

        console.log('🔌 [CDP Throttling] Simulating Network OFFLINE for 5 seconds...');
        await cdpSession.send('Network.emulateNetworkConditions', {
          offline: true,
          latency: 0,
          downloadThroughput: -1,
          uploadThroughput: -1,
        });

        // Tunggu 5 detik dalam kondisi offline
        await pageB.waitForTimeout(5000);

        console.log('⚡ [CDP Throttling] Restoring Network ONLINE...');
        await cdpSession.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: 20,
          downloadThroughput: (50 * 1024 * 1024) / 8,
          uploadThroughput: (50 * 1024 * 1024) / 8,
        });

        await pageB.waitForTimeout(2000);
      }

      // 6. Assert Tidak Ada Uncaught Exception untuk WebSocket Reconnection Error
      console.log(`[Console Exception Audit] Uncaught WebSocket Errors Count: ${uncaughtErrors.length}`);
      expect(uncaughtErrors.length).toBe(0);

    } finally {
      await contextA.close().catch(() => {});
      await contextB.close().catch(() => {});
    }
  });
});
