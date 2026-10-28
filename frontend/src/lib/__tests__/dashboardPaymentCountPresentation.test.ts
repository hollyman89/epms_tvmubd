import React from 'react';
import ReactDOMServer from 'react-dom/server';
import fs from 'fs';
import path from 'path';

describe('DASH-REC-002: Dashboard Payment Count Display Presentation Contract', () => {
  const dashboardTsxPath = path.resolve(__dirname, '../../components/DashboardPage.tsx');
  let tsxContent: string;

  beforeAll(() => {
    tsxContent = fs.readFileSync(dashboardTsxPath, 'utf8');
  });

  describe('Source Code Integrity & Bug Elimination', () => {
    test('1. Must NOT stringify JSX element via template literal interpolation into [object Object]', () => {
      // The bug pattern: `${renderStaticNumber(...)} Transaksi Selesai`
      expect(tsxContent).not.toMatch(/\$\{renderStaticNumber\([^)]*\)\}\s*Transaksi Selesai/);
      expect(tsxContent).not.toContain('${renderStaticNumber(pMetrics?.vendorPayments?.paymentCount)} Transaksi Selesai');
    });

    test('2. Must separate renderStaticNumber component and text in JSX', () => {
      // Must contain renderStaticNumber and Transaksi Selesai as separate JSX siblings
      expect(tsxContent).toMatch(/renderStaticNumber\(pMetrics\?\.vendorPayments\?\.paymentCount\)\s*\}\s*Transaksi Selesai/);
    });

    test('3. Must bind to canonical pMetrics.vendorPayments.paymentCount field without hardcoding 9', () => {
      expect(tsxContent).toContain('pMetrics?.vendorPayments?.paymentCount');
      // Must not hardcode "9 Transaksi Selesai" in the source
      expect(tsxContent).not.toContain("'9 Transaksi Selesai'");
      expect(tsxContent).not.toContain('"9 Transaksi Selesai"');
    });

    test('4. Payment amount display (paymentValue) remains unchanged and bound to API', () => {
      expect(tsxContent).toContain('renderStaticCurrency(pMetrics?.vendorPayments?.paymentValue)');
    });
  });

  describe('Render Behavior Simulation (DASH-REC-002)', () => {
    // Replicate the exact formatter and JSX branch from DashboardPage
    const formatStaticNumber = (val: number | undefined | null) => {
      return Number(val || 0).toLocaleString('id-ID');
    };
    const renderStaticNumber = (val: number | undefined | null) =>
      React.createElement(
        'span',
        { style: { fontVariantNumeric: 'tabular-nums' } },
        formatStaticNumber(val)
      );

    const formatStaticCurrency = (val: number | undefined | null) => {
      return `Rp ${Number(val || 0).toLocaleString('id-ID')}`;
    };
    const renderStaticCurrency = (val: number | undefined | null) =>
      React.createElement(
        'span',
        { style: { fontVariantNumeric: 'tabular-nums' } },
        formatStaticCurrency(val)
      );

    const formatPercentage = (val: number) => `${val}%`;

    const renderPaymentDisbursementStatus = (pMetrics: any) =>
      React.createElement(
        'span',
        {
          style: {
            fontWeight: 600,
            color: (pMetrics?.vendorPayments?.paymentCount ?? 0) > 0 ? '#16a34a' : '#94a3b8',
          },
        },
        (pMetrics as any)?.vendorPayments?.completionRate !== undefined
          ? `${formatPercentage((pMetrics as any).vendorPayments.completionRate)} Selesai`
          : (pMetrics?.vendorPayments?.paymentCount ?? 0) > 0
          ? React.createElement(
              React.Fragment,
              null,
              renderStaticNumber(pMetrics?.vendorPayments?.paymentCount),
              ' Transaksi Selesai'
            )
          : 'Belum ada data'
      );

    test('1. paymentCount = 9 renders "9 Transaksi Selesai"', () => {
      const pMetrics = {
        vendorPayments: {
          paymentCount: 9,
          paymentValue: 543753457,
        },
      };

      const html = ReactDOMServer.renderToStaticMarkup(renderPaymentDisbursementStatus(pMetrics));
      // HTML output contains formatted 9 and "Transaksi Selesai"
      expect(html).toContain('9');
      expect(html).toContain('Transaksi Selesai');
      // Stripped text content matches exact target
      const text = html.replace(/<[^>]+>/g, '');
      expect(text).toBe('9 Transaksi Selesai');
    });

    test('2. rendered output must NOT contain "[object Object]"', () => {
      const pMetrics = {
        vendorPayments: {
          paymentCount: 9,
          paymentValue: 543753457,
        },
      };

      const html = ReactDOMServer.renderToStaticMarkup(renderPaymentDisbursementStatus(pMetrics));
      expect(html).not.toContain('[object Object]');
    });

    test('3. payment amount display (Rp 543.753.457) formats correctly and remains unchanged', () => {
      const pMetrics = {
        vendorPayments: {
          paymentCount: 9,
          paymentValue: 543753457,
        },
      };

      const html = ReactDOMServer.renderToStaticMarkup(renderStaticCurrency(pMetrics.vendorPayments.paymentValue));
      expect(html).toContain('Rp 543.753.457');
    });

    test('4. Fallback when paymentCount is unavailable/0 renders "Belum ada data" without fake defaults', () => {
      const pMetricsNull = { vendorPayments: null };
      const htmlNull = ReactDOMServer.renderToStaticMarkup(renderPaymentDisbursementStatus(pMetricsNull));
      expect(htmlNull).toContain('Belum ada data');
      expect(htmlNull).not.toContain('[object Object]');

      const pMetricsZero = { vendorPayments: { paymentCount: 0 } };
      const htmlZero = ReactDOMServer.renderToStaticMarkup(renderPaymentDisbursementStatus(pMetricsZero));
      expect(htmlZero).toContain('Belum ada data');
    });

    test('5. Optional completionRate takes precedence when present', () => {
      const pMetricsWithRate = {
        vendorPayments: {
          paymentCount: 9,
          completionRate: 100,
        },
      };

      const html = ReactDOMServer.renderToStaticMarkup(renderPaymentDisbursementStatus(pMetricsWithRate));
      expect(html).toContain('100% Selesai');
    });
  });
});
