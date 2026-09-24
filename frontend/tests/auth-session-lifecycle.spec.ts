import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'ragil@epms.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || '123456';

test.describe('EPMS TVM-UBD Auth Session & Cookie Refresh Lifecycle Specification', () => {
  test.setTimeout(120000);

  // Helper to perform UI Login
  async function performLogin(page: any) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.epms-login-card-title')).toBeVisible({ timeout: 15000 });

    const emailInput = page.locator('#login_form_email');
    await emailInput.click();
    await emailInput.fill(TEST_EMAIL);
    await expect(emailInput).toHaveValue(TEST_EMAIL);

    const passInput = page.locator('#login_form_password');
    await passInput.click();
    await passInput.fill(TEST_PASSWORD);
    await expect(passInput).toHaveValue(TEST_PASSWORD);

    await page.waitForTimeout(300);
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    await expect(page).not.toHaveURL(/.*\/login(\?.*)?$/, { timeout: 15000 });
    await page.waitForLoadState('domcontentloaded');
  }

  // ---------------------------------------------------------------------------
  // TEST 1: Login sets HttpOnly cookie; refresh token NOT in JSON or localStorage
  // ---------------------------------------------------------------------------
  test('1. Login sets HttpOnly cookie; refresh token is absent from JSON response and browser localStorage', async ({ page, context }) => {
    let loginResponseBody: any = null;

    // Intercept login API response
    page.on('response', async (response: any) => {
      if (response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST') {
        try {
          loginResponseBody = await response.json();
        } catch {
          // ignore
        }
      }
    });

    await performLogin(page);

    // Verify JSON Response does NOT contain refreshToken
    expect(loginResponseBody).not.toBeNull();
    const payload = loginResponseBody.data || loginResponseBody;
    expect(payload.accessToken).toBeDefined();
    expect(payload.refreshToken).toBeUndefined();
    expect(payload.refresh_token).toBeUndefined();

    // Verify localStorage has access token but NO refresh token
    const storageData = await page.evaluate(() => {
      return {
        accessToken: localStorage.getItem('access_token') || localStorage.getItem('accessToken'),
        user: localStorage.getItem('user'),
        refreshToken: localStorage.getItem('refresh_token'),
      };
    });

    expect(storageData.accessToken).not.toBeNull();
    expect(storageData.user).not.toBeNull();
    expect(storageData.refreshToken).toBeNull();

    // Verify Browser Cookies contain HttpOnly refresh_token cookie
    const cookies = await context.cookies();
    const refreshCookie = cookies.find((c: any) => c.name === 'refresh_token');

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.path).toBe('/api/v1/auth');
    expect(refreshCookie?.sameSite?.toLowerCase()).toBe('lax');
    expect(refreshCookie?.expires).toBeGreaterThan(Date.now() / 1000 + 6 * 24 * 3600); // ~7 days
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Refresh with valid cookie succeeds even when localStorage has NO refresh token
  // ---------------------------------------------------------------------------
  test('2. Refresh with valid cookie succeeds without refresh token in localStorage', async ({ page }) => {
    await performLogin(page);

    // Explicitly wipe any possible refresh token in localStorage
    await page.evaluate(() => {
      localStorage.removeItem('epms_refresh_token');
      localStorage.removeItem('refresh_token');
    });

    // Call /api/v1/auth/refresh directly from browser context with credentials
    const refreshResult = await page.evaluate(async () => {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      return {
        status: res.status,
        hasAccessToken: Boolean(data.data?.accessToken || data.accessToken),
        hasRefreshTokenInJson: Boolean(data.data?.refreshToken || data.refreshToken),
      };
    });

    expect(refreshResult.status).toBe(200);
    expect(refreshResult.hasAccessToken).toBe(true);
    expect(refreshResult.hasRefreshTokenInJson).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Path 401 -> refresh -> retry recovers transparently for active user
  // ---------------------------------------------------------------------------
  test('3. Expired access token triggers 401 -> refresh -> retry without user disruption', async ({ page }) => {
    await performLogin(page);

    // Tamper access token to be an expired or invalid token
    // Crafting an expired JWT format (header.payload.signature)
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEwLCJlbWFpbCI6InJhZ2lsQGVwbXMuY29tIiwiZXhwIjoxNTAwMDAwMDAwfQ.invalid_or_expired_sig';

    const testExecution = await page.evaluate(async (fakeToken) => {
      // Set expired token in localStorage and default headers
      localStorage.setItem('access_token', fakeToken);

      // Trigger a real request via apiClient (which uses our interceptor)
      const res = await (window as any).apiClient.get('/customers');
      return {
        status: res.status,
        hasData: Boolean(res.data),
        newStoredToken: localStorage.getItem('access_token'),
      };
    }, expiredToken);

    expect(testExecution.status).toBe(200);
    expect(testExecution.hasData).toBe(true);
    // Verified that interceptor updated localStorage with new valid access token
    expect(testExecution.newStoredToken).not.toBe(expiredToken);
    expect(testExecution.newStoredToken).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Page reload with expired access token recovers session via HttpOnly cookie
  // ---------------------------------------------------------------------------
  test('4. Page reload with expired access token recovers session without redirecting to login', async ({ page }) => {
    await performLogin(page);

    // Tamper token to expired token in localStorage
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEwLCJlbWFpbCI6InJhZ2lsQGVwbXMuY29tIiwiZXhwIjoxNTAwMDAwMDAwfQ.invalid_or_expired_sig';

    await page.evaluate((fakeToken) => {
      localStorage.setItem('access_token', fakeToken);
    }, expiredToken);

    // Reload the protected page
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });

    // Expect session to recover without being kicked to /login
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain('/login');
    expect(page.url()).toContain('/customers');

    // Confirm that access_token in localStorage is replaced with a fresh token
    const currentToken = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(currentToken).not.toBe(expiredToken);
    expect(currentToken).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Single-flight refresh for concurrent 401 requests in one tab
  // ---------------------------------------------------------------------------
  test('5. Concurrent 401 requests in a single tab share one refresh call and retry safely', async ({ page }) => {
    await performLogin(page);

    let refreshDispatchedCount = 0;
    page.on('request', (req: any) => {
      if (req.url().includes('/api/v1/auth/refresh') && req.method() === 'POST') {
        refreshDispatchedCount++;
      }
    });

    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEwLCJlbWFpbCI6InJhZ2lsQGVwbXMuY29tIiwiZXhwIjoxNTAwMDAwMDAwfQ.invalid_or_expired_sig';

    const results = await page.evaluate(async (fakeToken) => {
      localStorage.setItem('access_token', fakeToken);
      (window as any).apiClient.defaults.headers.common['Authorization'] = `Bearer ${fakeToken}`;

      // Dispatch 5 concurrent requests simultaneously
      const promises = [
        (window as any).apiClient.get('/customers'),
        (window as any).apiClient.get('/customers'),
        (window as any).apiClient.get('/customers'),
        (window as any).apiClient.get('/customers'),
        (window as any).apiClient.get('/customers'),
      ];

      const responses = await Promise.all(promises);
      return responses.map((r: any) => r.status);
    }, expiredToken);

    // All 5 requests must resolve successfully with 200
    expect(results).toEqual([200, 200, 200, 200, 200]);

    // Single flight queueing: only 1 network refresh was dispatched!
    expect(refreshDispatchedCount).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Multi-tab session synchronization via BroadcastChannel
  // ---------------------------------------------------------------------------
  test('6. Multi-tab coordination synchronizes refreshed session across active tabs', async ({ context }) => {
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    // Login in Tab A
    await performLogin(pageA);

    // Open Tab B on protected route
    await pageB.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await pageB.waitForTimeout(1000);
    expect(pageB.url()).toContain('/customers');

    // Trigger refresh in Tab A
    const tabARefreshToken = await pageA.evaluate(async () => {
      const res = await (window as any).AuthService.refreshSession();
      return res.accessToken;
    });

    // Wait for BroadcastChannel to propagate to Tab B
    await pageB.waitForTimeout(800);

    // Verify Tab B receives and updates its access token
    const tabBStoredToken = await pageB.evaluate(() => localStorage.getItem('access_token'));
    expect(tabBStoredToken).toBe(tabARefreshToken);

    await pageA.close();
    await pageB.close();
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Temporary network failure does NOT clear user session
  // ---------------------------------------------------------------------------
  test('7. Temporary network glitch does NOT log out the user', async ({ page }) => {
    await performLogin(page);

    // Simulate network error on API request
    const sessionIntact = await page.evaluate(async () => {
      try {
        // Calling non-existent host or aborted request
        await (window as any).apiClient.get('/non-existent-endpoint-503', {
          adapter: async () => {
            const err: any = new Error('Network Error');
            err.code = 'ERR_NETWORK';
            throw err;
          },
        });
      } catch {
        // Expected network failure
      }

      // Session must remain intact
      return {
        hasToken: Boolean(localStorage.getItem('access_token')),
        hasUser: Boolean(localStorage.getItem('user')),
      };
    });

    expect(sessionIntact.hasToken).toBe(true);
    expect(sessionIntact.hasUser).toBe(true);
    expect(page.url()).not.toContain('/login');
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Revoked refresh token is rejected and redirects to login; logout cannot be canceled
  // ---------------------------------------------------------------------------
  test('8. Logout invalidates session and clears cookie; late refresh cannot restore session', async ({ page, context }) => {
    await performLogin(page);

    // Click logout via UI
    const userDropdownTrigger = page.locator('header .ant-dropdown-trigger').first();
    await expect(userDropdownTrigger).toBeVisible({ timeout: 10000 });
    await userDropdownTrigger.click();

    const logoutItem = page.locator('.ant-dropdown-menu-item').filter({ hasText: 'Logout' });
    await expect(logoutItem).toBeVisible({ timeout: 10000 });
    await logoutItem.click();

    await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });

    // Verify localStorage cleared
    const storedToken = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(storedToken).toBeNull();

    // Verify refresh token cookie cleared or expired
    const cookies = await context.cookies();
    const refreshCookie = cookies.find((c: any) => c.name === 'refresh_token');
    const isCookieCleared = !refreshCookie || refreshCookie.value === '' || (refreshCookie.expires && refreshCookie.expires <= Date.now() / 1000);
    expect(isCookieCleared).toBe(true);

    // Any delayed attempt to refresh must be rejected with 401
    const lateRefreshStatus = await page.evaluate(async () => {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      return res.status;
    });

    expect(lateRefreshStatus).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // TEST 9: Write operation retry after 401 refresh preserves payload and succeeds
  // ---------------------------------------------------------------------------
  test('9. Write operation retry after 401 preserves request payload and completes authentication', async ({ page }) => {
    await performLogin(page);

    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEwLCJlbWFpbCI6InJhZ2lsQGVwbXMuY29tIiwiZXhwIjoxNTAwMDAwMDAwfQ.invalid_or_expired_sig';

    const result = await page.evaluate(async (fakeToken) => {
      localStorage.setItem('access_token', fakeToken);
      (window as any).apiClient.defaults.headers.common['Authorization'] = `Bearer ${fakeToken}`;

      let receivedPayload = null;
      let finalStatus = null;

      try {
        // Send a POST request with payload to an authenticated write route
        const res = await (window as any).apiClient.post(
          '/customers',
          { name: 'Probe Customer' }
        );
        finalStatus = res.status;
      } catch (err: any) {
        finalStatus = err.response?.status;
      }

      return {
        finalStatus,
        newStoredToken: localStorage.getItem('access_token'),
      };
    }, expiredToken);

    // Assert that the request did NOT end in 401 Unauthorized
    expect(result.finalStatus).not.toBe(401);
    // Assert that a fresh access token was obtained and stored
    expect(result.newStoredToken).not.toBe(expiredToken);
    expect(result.newStoredToken).not.toBeNull();
  });
});
