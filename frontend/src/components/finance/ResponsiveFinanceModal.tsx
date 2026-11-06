/**
 * EPMS FINANCE RESPONSIVE MODAL FOUNDATION
 *
 * Finance-specialized implementation of the Canonical Responsive Modal Standard.
 * Encapsulates Finance design rules, SSOT badges, audit identity, and domain presets.
 */

import React, { useMemo } from 'react';
import { Button, Tag, Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import {
  ResponsiveModal,
  ResponsiveModalProps,
  ResponsiveModalSize,
} from '@/components/common/ResponsiveModal';

const { Text } = Typography;

export type FinanceModalDomain = 'INVOICE' | 'PAYMENT' | 'APPROVAL' | 'RECONCILIATION' | 'FORM';

export interface ResponsiveFinanceModalProps extends ResponsiveModalProps {
  /**
   * Functional finance domain defining theme and size presets.
   */
  domain?: FinanceModalDomain;
  /**
   * Authority source tag. Default: 'BACKEND SSOT'.
   */
  ssotAuthorityText?: string;
  /**
   * Secondary evaluation engine tag. Default: 'MATCHING ENGINE'.
   */
  ssotEvaluationText?: string;
  /**
   * Hide the standard finance SSOT badge in the footer. Default: false.
   */
  hideSsotBadge?: boolean;
  /**
   * Convenience text for the primary action button.
   */
  primaryActionText?: string;
  /**
   * Primary action click handler.
   */
  onPrimaryAction?: () => void;
  /**
   * Primary action submission loading state.
   */
  isSubmitting?: boolean;
  /**
   * Primary action disabled state.
   */
  isSubmitDisabled?: boolean;
  /**
   * Primary action danger state.
   */
  isPrimaryDanger?: boolean;
  /**
   * Custom icon for primary action button.
   */
  primaryActionIcon?: React.ReactNode;
  /**
   * Primary action HTML button ID for testing/automation.
   */
  primaryActionId?: string;
  /**
   * Cancel button label. Default: 'Batal'.
   */
  cancelText?: string;
}

export const ResponsiveFinanceModal: React.FC<ResponsiveFinanceModalProps> = ({
  domain = 'INVOICE',
  ssotAuthorityText = 'BACKEND SSOT',
  ssotEvaluationText = 'MATCHING ENGINE',
  hideSsotBadge = false,
  primaryActionText,
  onPrimaryAction,
  isSubmitting = false,
  isSubmitDisabled = false,
  isPrimaryDanger = false,
  primaryActionIcon,
  primaryActionId,
  cancelText = 'Batal',
  headerIconTheme: customHeaderTheme,
  size: customSize,
  footerActions: customFooterActions,
  footerExtra: customFooterExtra,
  onCancel,
  ...restProps
}) => {
  // Resolve domain defaults
  const domainTheme = useMemo(() => {
    switch (domain) {
      case 'PAYMENT':
        return { iconTheme: 'green' as const, size: 'medium' as ResponsiveModalSize };
      case 'APPROVAL':
        return { iconTheme: 'amber' as const, size: 'medium' as ResponsiveModalSize };
      case 'RECONCILIATION':
        return { iconTheme: 'purple' as const, size: 'wide' as ResponsiveModalSize };
      case 'FORM':
        return { iconTheme: 'blue' as const, size: 'form' as ResponsiveModalSize };
      case 'INVOICE':
      default:
        return { iconTheme: 'blue' as const, size: 'full' as ResponsiveModalSize };
    }
  }, [domain]);

  // Compose Finance SSOT authority badge for footerExtra
  const resolvedFooterExtra = useMemo(() => {
    if (customFooterExtra !== undefined) return customFooterExtra;
    if (hideSsotBadge) return null;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <SafetyCertificateOutlined style={{ color: '#059669', fontSize: 15, flexShrink: 0 }} />
        <Text style={{ fontSize: 11.5, color: '#475569' }}>
          Otoritas &amp; Status:{' '}
          <Tag color="blue" style={{ fontWeight: 700, margin: '0 2px', fontSize: 10 }}>
            {ssotAuthorityText}
          </Tag>
          {ssotEvaluationText && (
            <>
              — Evaluasi:{' '}
              <Tag color="default" style={{ fontWeight: 600, margin: '0 2px', fontSize: 10 }}>
                {ssotEvaluationText}
              </Tag>
            </>
          )}
        </Text>
      </div>
    );
  }, [customFooterExtra, hideSsotBadge, ssotAuthorityText, ssotEvaluationText]);

  // Compose standardized footer actions
  const resolvedFooterActions = useMemo(() => {
    if (customFooterActions !== undefined) return customFooterActions;
    if (!primaryActionText && !onCancel) return undefined;

    return (
      <>
        {onCancel && (
          <Button onClick={onCancel} disabled={isSubmitting} style={{ borderRadius: 6 }}>
            {cancelText}
          </Button>
        )}
        {primaryActionText && (
          <Button
            type="primary"
            danger={isPrimaryDanger}
            loading={isSubmitting}
            disabled={isSubmitDisabled}
            onClick={onPrimaryAction}
            icon={primaryActionIcon}
            id={primaryActionId}
            style={{
              backgroundColor: isPrimaryDanger ? undefined : isSubmitDisabled ? undefined : '#059669',
              borderColor: isPrimaryDanger ? undefined : isSubmitDisabled ? undefined : '#059669',
              borderRadius: 6,
              fontWeight: 600,
            }}
          >
            {primaryActionText}
          </Button>
        )}
      </>
    );
  }, [
    customFooterActions,
    primaryActionText,
    onCancel,
    isSubmitting,
    cancelText,
    isPrimaryDanger,
    isSubmitDisabled,
    onPrimaryAction,
    primaryActionIcon,
    primaryActionId,
  ]);

  return (
    <ResponsiveModal
      headerIconTheme={customHeaderTheme || domainTheme.iconTheme}
      size={customSize || domainTheme.size}
      footerExtra={resolvedFooterExtra}
      footerActions={resolvedFooterActions}
      onCancel={onCancel}
      {...restProps}
    />
  );
};

export default ResponsiveFinanceModal;

