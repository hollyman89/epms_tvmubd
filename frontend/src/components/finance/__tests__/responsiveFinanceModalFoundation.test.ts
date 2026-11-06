/**
 * EPMS — FINANCE RESPONSIVE MODAL FOUNDATION UNIT TESTS
 *
 * Verifies the Finance-specialized ResponsiveFinanceModal foundation:
 * 1. Domain preset resolution (INVOICE, PAYMENT, APPROVAL, RECONCILIATION, FORM)
 * 2. SSOT Authority badge generation and customizable evaluation engine tags
 * 3. Standardized footer actions (primary submit, cancel, loading, disabled)
 * 4. Pass-through to underlying Canonical ResponsiveModal
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';

let capturedProps: any[] = [];

jest.mock('@/components/common/ResponsiveModal', () => {
  const actual = jest.requireActual('@/components/common/ResponsiveModal');
  return {
    ...actual,
    ResponsiveModal: (props: any) => {
      capturedProps.push(props);
      if (!props.open) return null;
      return React.createElement(
        'div',
        {
          'data-testid': 'mock-responsive-modal',
          'data-size': props.size,
          'data-icon-theme': props.headerIconTheme,
        },
        props.title,
        props.children,
        props.footerExtra,
        props.footerActions,
        props.footer
      );
    },
  };
});

import { ResponsiveFinanceModal } from '../ResponsiveFinanceModal';

describe('Finance Responsive Modal Foundation', () => {
  beforeEach(() => {
    capturedProps = [];
  });

  describe('1. Domain Presets & Themes', () => {
    it('configures INVOICE domain with blue theme and full size preset', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveFinanceModal, {
          open: true,
          domain: 'INVOICE',
          title: 'Invoice Modal',
        })
      );

      expect(capturedProps.length).toBe(1);
      expect(capturedProps[0].headerIconTheme).toBe('blue');
      expect(capturedProps[0].size).toBe('full');
    });

    it('configures PAYMENT domain with green theme and medium size preset', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveFinanceModal, {
          open: true,
          domain: 'PAYMENT',
          title: 'Payment Modal',
        })
      );

      expect(capturedProps[0].headerIconTheme).toBe('green');
      expect(capturedProps[0].size).toBe('medium');
    });

    it('configures APPROVAL domain with amber theme and medium size preset', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveFinanceModal, {
          open: true,
          domain: 'APPROVAL',
          title: 'Approval Modal',
        })
      );

      expect(capturedProps[0].headerIconTheme).toBe('amber');
      expect(capturedProps[0].size).toBe('medium');
    });

    it('configures RECONCILIATION domain with purple theme and wide size preset', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveFinanceModal, {
          open: true,
          domain: 'RECONCILIATION',
          title: 'Reconciliation Modal',
        })
      );

      expect(capturedProps[0].headerIconTheme).toBe('purple');
      expect(capturedProps[0].size).toBe('wide');
    });

    it('configures FORM domain with blue theme and form size preset', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveFinanceModal, {
          open: true,
          domain: 'FORM',
          title: 'Form Modal',
        })
      );

      expect(capturedProps[0].headerIconTheme).toBe('blue');
      expect(capturedProps[0].size).toBe('form');
    });
  });

  describe('2. SSOT Authority Badge in Footer Extra', () => {
    it('renders default BACKEND SSOT and MATCHING ENGINE badge', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveFinanceModal, {
          open: true,
          title: 'SSOT Test Modal',
        })
      );

      expect(html).toContain('BACKEND SSOT');
      expect(html).toContain('MATCHING ENGINE');
      expect(html).toContain('Otoritas &amp; Status:');
    });

    it('hides SSOT badge when hideSsotBadge is true', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveFinanceModal, {
          open: true,
          title: 'Hidden SSOT Modal',
          hideSsotBadge: true,
        })
      );

      expect(html).not.toContain('BACKEND SSOT');
    });

    it('renders custom authority text when provided', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveFinanceModal, {
          open: true,
          title: 'Custom SSOT Modal',
          ssotAuthorityText: 'AUTHORITATIVE TREASURY',
          ssotEvaluationText: '3-WAY AUDIT',
        })
      );

      expect(html).toContain('AUTHORITATIVE TREASURY');
      expect(html).toContain('3-WAY AUDIT');
    });
  });

  describe('3. Standardized Action Buttons', () => {
    it('renders primary action button and cancel button with customized text', () => {
      const handlePrimary = jest.fn();
      const handleCancel = jest.fn();

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveFinanceModal, {
          open: true,
          title: 'Action Button Modal',
          primaryActionText: 'Terbitkan Invoice Termin #1',
          onPrimaryAction: handlePrimary,
          onCancel: handleCancel,
          cancelText: 'Batalkan Penerbitan',
          primaryActionId: 'btn-submit-invoice',
        })
      );

      expect(html).toContain('Terbitkan Invoice Termin #1');
      expect(html).toContain('Batalkan Penerbitan');
      expect(html).toContain('id="btn-submit-invoice"');
    });

    it('allows overriding footer actions with completely custom buttons', () => {
      const customActions = React.createElement(
        'button',
        { id: 'custom-action-btn' },
        'Custom Action'
      );

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResponsiveFinanceModal, {
          open: true,
          title: 'Custom Actions Modal',
          footerActions: customActions,
        })
      );

      expect(html).toContain('id="custom-action-btn"');
      expect(html).toContain('Custom Action');
    });
  });
});

