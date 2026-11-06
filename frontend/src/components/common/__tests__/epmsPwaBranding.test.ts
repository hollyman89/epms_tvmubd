import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EpmsWelcomeScreen } from '../EpmsWelcomeScreen';

describe('EPMS UBD & TVM — PWA Branding Implementation Suite', () => {
  const frontendRoot = path.resolve(__dirname, '../../../..');
  const publicDir = path.join(frontendRoot, 'public');
  const iconsDir = path.join(publicDir, 'icons');
  const manifestPath = path.join(publicDir, 'manifest.json');
  const swPath = path.join(publicDir, 'sw.js');
  const layoutPath = path.join(frontendRoot, 'src/app/layout.tsx');
  const rootPagePath = path.join(frontendRoot, 'src/app/(dashboard)/page.tsx');
  const protectedRoutePath = path.join(frontendRoot, 'src/components/ProtectedRoute.tsx');
  const loginPagePath = path.join(frontendRoot, 'src/app/login/page.tsx');

  function readPngDimensions(filePath: string): { width: number; height: number; isPng: boolean } {
    const buf = fs.readFileSync(filePath);
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const isPng = buf.subarray(0, 8).equals(pngSignature);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height, isPng };
  }

  describe('1. PWA App Icon Assets & Manifest Configuration', () => {
    it('provides valid PNG files with exact dimensions for 192x192, 512x512, 192x192 maskable, and 512x512 maskable', () => {
      const expectedAssets = [
        { file: 'epms-icon-192.png', width: 192, height: 192 },
        { file: 'epms-icon-512.png', width: 512, height: 512 },
        { file: 'epms-icon-maskable-192.png', width: 192, height: 192 },
        { file: 'epms-icon-maskable-512.png', width: 512, height: 512 },
      ];

      for (const asset of expectedAssets) {
        const fullPath = path.join(iconsDir, asset.file);
        expect(fs.existsSync(fullPath)).toBe(true);
        const dims = readPngDimensions(fullPath);
        expect(dims.isPng).toBe(true);
        expect(dims.width).toBe(asset.width);
        expect(dims.height).toBe(asset.height);
      }
    });

    it('declares all 4 icons (any and maskable) and deep navy branding colors in manifest.json', () => {
      const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest.short_name).toBe('EPMS');
      expect(manifest.display).toBe('standalone');
      expect(manifest.background_color).toBe('#021329');
      expect(manifest.theme_color).toBe('#021329');
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons).toHaveLength(4);

      expect(manifest.icons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            src: expect.stringContaining('/icons/epms-icon-192.png'),
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          }),
          expect.objectContaining({
            src: expect.stringContaining('/icons/epms-icon-512.png'),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          }),
          expect.objectContaining({
            src: expect.stringContaining('/icons/epms-icon-maskable-192.png'),
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          }),
          expect.objectContaining({
            src: expect.stringContaining('/icons/epms-icon-maskable-512.png'),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          }),
        ]),
      );
    });

    it('updates root layout metadata and service worker push icon references while preserving push handlers', () => {
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      expect(layoutContent).toContain("manifest: '/manifest.json'");
      expect(layoutContent).toContain("themeColor: '#021329'");
      expect(layoutContent).toContain('/icons/epms-icon-192.png');
      expect(layoutContent).toContain('/icons/epms-icon-512.png');

      const swContent = fs.readFileSync(swPath, 'utf8');
      expect(swContent).toContain('/icons/epms-icon-192.png');
      expect(swContent).toContain("self.addEventListener('push'");
      expect(swContent).toContain("self.addEventListener('notificationclick'");
    });
  });

  describe('2. Welcome Screen & Workspace Initialization State Rendering', () => {
    it('renders Welcome Screen (mode="welcome") with emblem, EPMS wordmark, subtitle, UBD & TVM identity, and 3-dot loading indicator', () => {
      const html = renderToStaticMarkup(React.createElement(EpmsWelcomeScreen, { mode: 'welcome' }));

      expect(html).toContain('data-testid="epms-welcome-screen"');
      expect(html).toContain('data-mode="welcome"');
      expect(html).toContain('data-testid="epms-welcome-emblem"');
      expect(html).toContain('data-testid="epms-welcome-wordmark"');
      expect(html).toContain('>EPMS<');
      expect(html).toContain('ENTERPRISE PROJECT');
      expect(html).toContain('MANAGEMENT SYSTEM');
      expect(html).toContain('UBD &amp; TVM');
      expect(html).toContain('data-testid="epms-welcome-loading-dots"');
      expect(html).not.toContain('data-testid="epms-workspace-initializing-state"');
    });

    it('renders Workspace Initialization State (mode="initializing") with check indicator and "Menyiapkan workspace..."', () => {
      const html = renderToStaticMarkup(
        React.createElement(EpmsWelcomeScreen, {
          mode: 'initializing',
          statusText: 'Menyiapkan workspace...',
        }),
      );

      expect(html).toContain('data-testid="epms-welcome-screen"');
      expect(html).toContain('data-mode="initializing"');
      expect(html).toContain('data-testid="epms-welcome-emblem"');
      expect(html).toContain('>EPMS<');
      expect(html).toContain('ENTERPRISE PROJECT');
      expect(html).toContain('MANAGEMENT SYSTEM');
      expect(html).toContain('UBD &amp; TVM');
      expect(html).toContain('data-testid="epms-workspace-initializing-state"');
      expect(html).toContain('data-testid="epms-workspace-check-indicator"');
      expect(html).toContain('Menyiapkan workspace...');
      expect(html).not.toContain('data-testid="epms-welcome-loading-dots"');
    });
  });

  describe('3. Application Entry & Initialization Lifecycle Integration', () => {
    it('optimizes RootRedirectPage gateway: transitions directly into mode="initializing" for authenticated cold launch, renders neutral loader for unauthenticated, and eliminates redundant mode="welcome"', () => {
      const rootPageContent = fs.readFileSync(rootPagePath, 'utf8');

      expect(rootPageContent).toContain('EpmsWelcomeScreen');
      expect(rootPageContent).toContain('mode="initializing"');
      expect(rootPageContent).not.toContain('mode="welcome"');
      expect(rootPageContent).toContain('Menyiapkan workspace...');
      expect(rootPageContent).toContain('data-testid="root-redirect-session-loader"');
      expect(rootPageContent).not.toContain('setTimeout');
    });

    it('ensures ProtectedRoute renders neutral session loader during verification and never flashes Welcome Screen on internal refreshes', () => {
      const protectedRouteContent = fs.readFileSync(protectedRoutePath, 'utf8');

      // During generic session verification (isLoading || !isAuthenticated), ProtectedRoute renders neutral Spin loader
      expect(protectedRouteContent).toContain('data-testid="protected-route-session-loader"');
      expect(protectedRouteContent).toContain('Memverifikasi sesi...');
      expect(protectedRouteContent).toContain('Spin');

      // It must NOT render mode="welcome"
      expect(protectedRouteContent).not.toContain('mode="welcome"');

      // It retains mode="initializing" only when a genuine role landing redirect from root is executing
      expect(protectedRouteContent).toContain('EpmsWelcomeScreen');
      expect(protectedRouteContent).toContain('mode="initializing"');
      expect(protectedRouteContent).toContain('Menyiapkan workspace...');
      expect(protectedRouteContent).not.toContain('setTimeout');
    });

    it('ensures LoginPage renders neutral session loader during initial loading and branded initializing screen only when confirmed authenticated', () => {
      const loginPageContent = fs.readFileSync(loginPagePath, 'utf8');

      // Initial loading state uses neutral Spin loader on #f8fafc canvas
      expect(loginPageContent).toContain('data-testid="login-session-loader"');
      expect(loginPageContent).toContain('Memverifikasi sesi...');
      expect(loginPageContent).not.toContain('mode="welcome"');

      // Confirmed authenticated user redirecting to workspace retains branded initializing screen
      expect(loginPageContent).toContain('EpmsWelcomeScreen');
      expect(loginPageContent).toContain('mode="initializing"');
      expect(loginPageContent).toContain('Menyiapkan workspace...');
    });
  });
});

