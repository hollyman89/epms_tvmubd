/**
 * EPMS — CANONICAL RESPONSIVE MODAL FOUNDATION UNIT TESTS
 *
 * Verifies the shared ResponsiveModal foundation behavior:
 * 1. Viewport-bounded modal container and width presets
 * 2. Header structuring, subtitle, icon, and word-break wrapping
 * 3. Body scroll containment configuration and styles merging
 * 4. Structured footer layout with extra metadata and action buttons
 * 5. Safe-area and touch target data contracts
 * 6. Ant Design Modal prop pass-through and lifecycle preservation
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';

// Mock antd Modal to inspect rendered props & static output
let capturedModalProps: any[] = [];

jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return {
    ...actual,
    Modal: (props: any) => {
      capturedModalProps.push(props);
      if (!props.open) return null;
      return React.createElement(
        'div',
        {
          'data-testid': props['data-testid'] || 'mock-modal',
          'data-width': typeof props.width === 'object' ? JSON.stringify(props.width) : props.width,
          'data-root-class': props.rootClassName,
          'data-class': props.className,
          'data-style': props.style ? JSON.stringify(props.style) : undefined,
          'data-styles': props.styles ? JSON.stringify(props.styles) : undefined,
          'data-responsive-size': props['data-responsive-size'],
          'data-body-scrollable': props['data-body-scrollable'],
          'data-safe-area': props['data-safe-area'],
        },
        props.title,
        props.children,
        props.footer
      );
    },
  };
});

import { ResponsiveModal, RESPONSIVE_MODAL_PRESETS } from '../ResponsiveModal';

describe('Canonical Responsive Modal Foundation', () => {
  beforeEach(() => {
    capturedModalProps = [];
  });

  describe('1. Container Bounds & Size Presets', () => {
    it('applies default medium size preset (800px bounded)', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          title: 'Test Modal',
        })
      );

      expect(capturedModalProps.length).toBe(1);
      const prop = capturedModalProps[0];
      expect(prop.width).toBe(RESPONSIVE_MODAL_PRESETS.medium);
      expect(prop.width).toContain('calc(100vw - 24px)');
      expect(prop.style).toEqual(expect.objectContaining({ maxWidth: '100vw' }));
      expect(prop['data-responsive-size']).toBe('medium');
    });

    it('resolves all enterprise presets accurately', () => {
      const presets = ['full', 'wide', 'medium', 'form', 'compact'] as const;

      presets.forEach((size) => {
        capturedModalProps = [];
        ReactDOMServer.renderToStaticMarkup(
          React.createElement(ResponsiveModal, {
            open: true,
            size,
            title: `${size} modal`,
          })
        );

        expect(capturedModalProps.length).toBe(1);
        expect(capturedModalProps[0].width).toBe(RESPONSIVE_MODAL_PRESETS[size]);
        expect(capturedModalProps[0]['data-responsive-size']).toBe(size);
      });
    });

    it('allows explicit custom width string and overrides preset', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          width: 'min(500px, 90vw)',
          title: 'Custom Width Modal',
        })
      );

      expect(capturedModalProps[0].width).toBe('min(500px, 90vw)');
    });

    it('attaches canonical root classes for CSS module scoping', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          title: 'Scoped Class Modal',
        })
      );

      const rootClass = capturedModalProps[0].rootClassName;
      expect(rootClass).toContain('epms-responsive-modal-root');
    });

    it('applies natural height class when bodyScrollable is false', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          bodyScrollable: false,
          title: 'Natural Modal',
        })
      );

      expect(capturedModalProps[0]['data-body-scrollable']).toBe('false');
    });
  });

  describe('2. Header Structuring & Accessibility', () => {
    it('renders structured title, subtitle, and icon in header', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          title: 'Penerbitan Invoice Penagihan Vendor',
          subtitle: 'Evaluasi Matching Engine dan Validasi SSOT',
          headerIcon: React.createElement('span', null, 'ICON'),
          headerIconTheme: 'green',
        })
      );

      expect(html).toContain('data-testid="responsive-modal-header"');
      expect(html).toContain('data-testid="responsive-modal-title"');
      expect(html).toContain('Penerbitan Invoice Penagihan Vendor');
      expect(html).toContain('data-testid="responsive-modal-subtitle"');
      expect(html).toContain('Evaluasi Matching Engine dan Validasi SSOT');
      expect(html).toContain('data-testid="responsive-modal-header-icon"');
    });

    it('renders custom ReactNode title without breakage', () => {
      const customNode = React.createElement(
        'div',
        { className: 'custom-title-node' },
        'Custom Node Title'
      );

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          title: customNode,
        })
      );

      expect(html).toContain('Custom Node Title');
    });
  });

  describe('3. Body Scrolling & Styles Merging', () => {
    it('sets data-body-scrollable to true by default', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          title: 'Scrollable Body Modal',
        }, 'Modal Body Content')
      );

      expect(capturedModalProps[0]['data-body-scrollable']).toBe('true');
    });

    it('merges custom maxBodyHeight into styles.body', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          maxBodyHeight: '450px',
          title: 'Max Height Modal',
        })
      );

      expect(capturedModalProps[0].styles).toEqual({
        body: { maxHeight: '450px' },
      });
    });
  });

  describe('4. Footer Layout & Actions', () => {
    it('renders structured footer when footerExtra and footerActions are passed', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          title: 'Footer Test Modal',
          footerExtra: React.createElement('span', null, 'BACKEND SSOT VERIFIED'),
          footerActions: React.createElement('button', null, 'Simpan Data'),
        })
      );

      expect(html).toContain('data-testid="responsive-modal-footer"');
      expect(html).toContain('data-testid="responsive-modal-footer-extra"');
      expect(html).toContain('BACKEND SSOT VERIFIED');
      expect(html).toContain('data-testid="responsive-modal-footer-actions"');
      expect(html).toContain('Simpan Data');
    });

    it('respects explicit footer={null} without rendering structured footer', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          title: 'No Footer Modal',
          footer: null,
        })
      );

      expect(capturedModalProps[0].footer).toBeNull();
    });
  });

  describe('5. PWA Safe-Area & Touch Target Attributes', () => {
    it('sets safe-area attribute to true by default', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          title: 'Safe Area Modal',
        })
      );

      expect(capturedModalProps[0]['data-safe-area']).toBe('true');
    });

    it('allows disabling safe-area explicitly when embedded', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          safeArea: false,
          title: 'No Safe Area Modal',
        })
      );

      expect(capturedModalProps[0]['data-safe-area']).toBe('false');
    });
  });

  describe('6. Ant Design Modal Compatibility', () => {
    it('forwards standard AntD callbacks and props', () => {
      const handleCancel = jest.fn();

      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveModal, {
          open: true,
          title: 'Prop Pass-Through Modal',
          onCancel: handleCancel,
          destroyOnClose: true,
          maskClosable: false,
        }, React.createElement('div', { className: 'test-child' }, 'Hello Body'))
      );

      expect(capturedModalProps[0].destroyOnClose).toBe(true);
      expect(capturedModalProps[0].maskClosable).toBe(false);
      expect(capturedModalProps[0].onCancel).toBe(handleCancel);
    });
  });
});

