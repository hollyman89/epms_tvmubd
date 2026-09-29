import { test, expect } from '@playwright/test';

test.describe('R9.1B-HARNESS-FIX-13: RFQ Response Envelope Unpacking Contract', () => {
  // Helper matching canonical implementation in canonical-lifecycle-helpers.ts
  const unpackRfqPayload = (rfqJson: any) => {
    return rfqJson.data?.data || rfqJson.data || rfqJson;
  };

  test('Matcher contract: exact pathname and method validation', () => {
    const isRfqCreateResponse = (urlStr: string, method: string) => {
      try {
        const url = new URL(urlStr);
        return (
          url.pathname === '/api/v1/procurement/rfqs' &&
          method === 'POST'
        );
      } catch {
        return false;
      }
    };

    // Valid production endpoints
    expect(isRfqCreateResponse('http://localhost:4000/api/v1/procurement/rfqs', 'POST')).toBe(true);
    expect(isRfqCreateResponse('http://localhost:3000/api/v1/procurement/rfqs', 'POST')).toBe(true);
    expect(isRfqCreateResponse('https://epms.company.com/api/v1/procurement/rfqs', 'POST')).toBe(true);

    // Invalid: Old wrong harness endpoint
    expect(isRfqCreateResponse('http://localhost:4000/api/v1/rfq', 'POST')).toBe(false);
    expect(isRfqCreateResponse('http://localhost:4000/api/v1/procurement/rfq', 'POST')).toBe(false);

    // Invalid: Wrong HTTP method
    expect(isRfqCreateResponse('http://localhost:4000/api/v1/procurement/rfqs', 'GET')).toBe(false);
    expect(isRfqCreateResponse('http://localhost:4000/api/v1/procurement/rfqs', 'PUT')).toBe(false);

    // Invalid: Child endpoints
    expect(isRfqCreateResponse('http://localhost:4000/api/v1/procurement/rfqs/7', 'GET')).toBe(false);
    expect(isRfqCreateResponse('http://localhost:4000/api/v1/procurement/rfqs/7/quotations', 'GET')).toBe(false);
  });

  // 1. TransformInterceptor wrapped response: meta -> data -> data -> entity
  test('Case 1: TransformInterceptor wrapped response (meta -> data -> data -> entity)', () => {
    const fullNestJsonResponse = {
      meta: {
        code: 201,
        status: 'success',
        message: 'Request successful',
      },
      data: {
        success: true,
        message: 'Request for Quotation berhasil diterbitkan',
        data: {
          id: 8,
          prId: 11,
          rfqNumber: 'RFQ-20260928-004',
          status: 'OPEN',
          closingDate: '2026-10-12T13:59:35.000Z',
          createdBy: 41,
          createdAt: '2026-09-28T13:59:35.000Z',
          updatedAt: '2026-09-28T13:59:35.000Z',
          deletedAt: null,
        },
      },
    };

    const rfqPayload = unpackRfqPayload(fullNestJsonResponse);
    const capturedRfqId = Number(rfqPayload.id);
    const capturedRfqNumber = String(rfqPayload.rfqNumber || rfqPayload.rfq_number);
    const rfqStatus = rfqPayload.status;
    const rfqPrId = Number(rfqPayload.prId || rfqPayload.pr_id || rfqPayload.purchaseRequestId);

    expect(capturedRfqId).toBe(8);
    expect(capturedRfqId).toBeGreaterThan(0);
    expect(capturedRfqNumber).toBe('RFQ-20260928-004');
    expect(capturedRfqNumber).toMatch(/^RFQ-/);
    expect(rfqStatus).toBe('OPEN');
    expect(rfqPrId).toBe(11);
  });

  // 2. Direct service-style envelope: data -> entity
  test('Case 2: Direct service-style envelope (data -> entity)', () => {
    const directServiceResponse = {
      data: {
        id: 8,
        prId: 11,
        rfqNumber: 'RFQ-20260928-004',
        status: 'OPEN',
      },
    };

    const rfqPayload = unpackRfqPayload(directServiceResponse);
    const capturedRfqId = Number(rfqPayload.id);
    const capturedRfqNumber = String(rfqPayload.rfqNumber || rfqPayload.rfq_number);
    const rfqStatus = rfqPayload.status;
    const rfqPrId = Number(rfqPayload.prId || rfqPayload.pr_id || rfqPayload.purchaseRequestId);

    expect(capturedRfqId).toBe(8);
    expect(capturedRfqId).toBeGreaterThan(0);
    expect(capturedRfqNumber).toBe('RFQ-20260928-004');
    expect(capturedRfqNumber).toMatch(/^RFQ-/);
    expect(rfqStatus).toBe('OPEN');
    expect(rfqPrId).toBe(11);
  });

  // 3. Direct entity fallback: entity
  test('Case 3: Direct entity fallback (raw entity object)', () => {
    const rawEntityResponse = {
      id: 8,
      prId: 11,
      rfqNumber: 'RFQ-20260928-004',
      status: 'OPEN',
    };

    const rfqPayload = unpackRfqPayload(rawEntityResponse);
    const capturedRfqId = Number(rfqPayload.id);
    const capturedRfqNumber = String(rfqPayload.rfqNumber || rfqPayload.rfq_number);
    const rfqStatus = rfqPayload.status;
    const rfqPrId = Number(rfqPayload.prId || rfqPayload.pr_id || rfqPayload.purchaseRequestId);

    expect(capturedRfqId).toBe(8);
    expect(capturedRfqId).toBeGreaterThan(0);
    expect(capturedRfqNumber).toBe('RFQ-20260928-004');
    expect(capturedRfqNumber).toMatch(/^RFQ-/);
    expect(rfqStatus).toBe('OPEN');
    expect(rfqPrId).toBe(11);
  });

  // 4. In-browser route interception with full NestJS TransformInterceptor response
  test('In-browser waitForResponse route interception with canonical TransformInterceptor envelope', async ({ page }) => {
    // Intercept exact production route with real NestJS envelope
    await page.route('**/api/v1/procurement/rfqs', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            meta: { code: 201, status: 'success', message: 'Request successful' },
            data: {
              success: true,
              message: 'Request for Quotation berhasil diterbitkan',
              data: {
                id: 99,
                prId: 55,
                rfqNumber: 'RFQ-20260928-999',
                status: 'OPEN',
              },
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Set up exact matcher
    const rfqResponsePromise = page.waitForResponse(
      (res) => {
        try {
          const url = new URL(res.url());
          return (
            url.pathname === '/api/v1/procurement/rfqs' &&
            res.request().method() === 'POST'
          );
        } catch {
          return false;
        }
      },
      { timeout: 5000 }
    );

    // Fire simulated request from page
    await page.evaluate(async () => {
      await fetch('http://localhost:3000/api/v1/procurement/rfqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseRequestId: 55 }),
      });
    });

    const res = await rfqResponsePromise;
    expect(res.status()).toBe(201);
    const json = await res.json();
    const payload = json.data?.data || json.data || json;
    expect(payload.id).toBe(99);
    expect(payload.rfqNumber).toBe('RFQ-20260928-999');
    expect(payload.status).toBe('OPEN');
    expect(payload.prId).toBe(55);
  });
});
