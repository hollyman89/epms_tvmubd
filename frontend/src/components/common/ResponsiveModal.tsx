/**
 * EPMS CANONICAL RESPONSIVE MODAL FOUNDATION
 *
 * Provides a viewport-bounded, touch-friendly, safe-area aware modal container
 * for Enterprise workflows (Finance, Procurement, Operations).
 *
 * Core Capabilities:
 * 1. Viewport Height Containment: Bounds modal to 100dvh/100vh preventing page-level overflow.
 * 2. Internal Body Scroll: Automatically enables momentum-scrolled body with pinned header & footer.
 * 3. Mobile Anti-Centering: Disables vertical flex centering on mobile to prevent off-screen header collapse.
 * 4. PWA Safe-Area Awareness: Injects env(safe-area-inset-top) and env(safe-area-inset-bottom) with safe fallbacks.
 * 5. Touch Accessibility: Enforces 44x44px touch targets on close button and touch-scaled footer buttons.
 * 6. Responsive Width Presets: Canonical enterprise sizes ('full', 'wide', 'medium', 'form', 'compact').
 */

import React, { useMemo } from 'react';
import { Modal, ModalProps } from 'antd';
import styles from './ResponsiveModal.module.css';

export type ResponsiveModalSize = 'full' | 'wide' | 'medium' | 'form' | 'compact';

export const RESPONSIVE_MODAL_PRESETS: Record<ResponsiveModalSize, string> = {
  full: 'min(1180px, calc(100vw - 24px))',
  wide: 'min(960px, calc(100vw - 24px))',
  medium: 'min(800px, calc(100vw - 24px))',
  form: 'min(680px, calc(100vw - 24px))',
  compact: 'min(520px, calc(100vw - 24px))',
};

export interface ResponsiveModalProps extends Omit<ModalProps, 'styles'> {
  /**
   * Primary title text or custom ReactNode.
   */
  title?: React.ReactNode;
  /**
   * Optional contextual subtitle shown below the title.
   */
  subtitle?: React.ReactNode;
  /**
   * Optional header icon displayed alongside the title.
   */
  headerIcon?: React.ReactNode;
  /**
   * Visual theme color for header icon container. Default: 'blue'.
   */
  headerIconTheme?: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'default';
  /**
   * Left-side metadata slot in modal footer (e.g. SSOT badge, status info, audit stamps).
   */
  footerExtra?: React.ReactNode;
  /**
   * Explicit action button elements. Overrides default AntD ok/cancel buttons.
   */
  footerActions?: React.ReactNode;
  /**
   * Whether modal body scrolls internally within viewport bounds. Default: true.
   */
  bodyScrollable?: boolean;
  /**
   * Optional body maxHeight override. If omitted, flex-grow automatically manages height.
   */
  maxBodyHeight?: number | string;
  /**
   * Whether to center modal on mobile screens. Default: false (top-aligned to prevent off-screen header).
   */
  mobileCentered?: boolean;
  /**
   * Whether to enable PWA safe-area padding. Default: true.
   */
  safeArea?: boolean;
  /**
   * Responsive preset size. Default: 'medium'.
   */
  size?: ResponsiveModalSize | string | number;
  /**
   * Sub-element styling object passed to AntD Modal.
   */
  styles?: ModalProps['styles'];
}

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  title,
  subtitle,
  headerIcon,
  headerIconTheme = 'blue',
  footer,
  footerExtra,
  footerActions,
  bodyScrollable = true,
  maxBodyHeight,
  mobileCentered = false,
  safeArea = true,
  size = 'medium',
  width,
  rootClassName,
  className,
  styles: customStyles,
  style: customStyle,
  children,
  ...restProps
}) => {
  // Resolve modal width based on preset or custom width
  const resolvedWidth = useMemo(() => {
    if (width !== undefined) return width;
    if (typeof size === 'string' && size in RESPONSIVE_MODAL_PRESETS) {
      return RESPONSIVE_MODAL_PRESETS[size as ResponsiveModalSize];
    }
    return size || RESPONSIVE_MODAL_PRESETS.medium;
  }, [width, size]);

  // Resolve header icon theme class
  const iconThemeClass = useMemo(() => {
    switch (headerIconTheme) {
      case 'green':
        return styles.headerIconGreen;
      case 'amber':
        return styles.headerIconAmber;
      case 'purple':
        return styles.headerIconPurple;
      case 'red':
        return styles.headerIconRed;
      case 'default':
        return styles.headerIconDefault;
      case 'blue':
      default:
        return styles.headerIconBlue;
    }
  }, [headerIconTheme]);

  // Construct structured header
  const resolvedTitle = useMemo(() => {
    if (!title && !subtitle && !headerIcon) return null;

    // If title is already structured or no icon/subtitle, preserve direct rendering
    if (!headerIcon && !subtitle && typeof title !== 'string') {
      return title;
    }

    return (
      <div className={styles.headerWrapper} data-testid="responsive-modal-header">
        {headerIcon && (
          <div
            className={`${styles.headerIconContainer} ${iconThemeClass}`}
            data-testid="responsive-modal-header-icon"
          >
            {headerIcon}
          </div>
        )}
        <div className={styles.headerTextContainer}>
          {typeof title === 'string' ? (
            <div className={styles.headerTitle} data-testid="responsive-modal-title">
              {title}
            </div>
          ) : (
            title
          )}
          {subtitle && (
            <div className={styles.headerSubtitle} data-testid="responsive-modal-subtitle">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    );
  }, [title, subtitle, headerIcon, iconThemeClass]);

  // Construct structured footer
  const resolvedFooter = useMemo(() => {
    // If footer is explicitly passed (e.g. null or custom ReactNode), respect it
    if (footer !== undefined) return footer;

    // If custom footer actions or extra slots are provided, render structured responsive layout
    if (footerActions || footerExtra) {
      return (
        <div className={styles.footerContainer} data-testid="responsive-modal-footer">
          {footerExtra ? (
            <div className={styles.footerExtraSlot} data-testid="responsive-modal-footer-extra">
              {footerExtra}
            </div>
          ) : (
            <div />
          )}
          {footerActions && (
            <div className={styles.footerActionsSlot} data-testid="responsive-modal-footer-actions">
              {footerActions}
            </div>
          )}
        </div>
      );
    }

    // Default to Ant Design's standard ok/cancel buttons
    return undefined;
  }, [footer, footerExtra, footerActions]);

  // Scoped class composition for root and dialog
  const composedRootClass = useMemo(() => {
    const classes = [styles.modalRoot, 'epms-responsive-modal-root'];
    if (!bodyScrollable) {
      classes.push(styles.modalRootNatural);
    }
    if (rootClassName) {
      classes.push(rootClassName);
    }
    return classes.filter(Boolean).join(' ');
  }, [bodyScrollable, rootClassName]);

  const composedModalClass = useMemo(() => {
    const classes = [styles.responsiveModal, 'epms-responsive-modal'];
    if (className) {
      classes.push(className);
    }
    return classes.filter(Boolean).join(' ');
  }, [className]);

  // Merge body styles for custom maxBodyHeight
  const mergedStyles = useMemo(() => {
    if (!maxBodyHeight) return customStyles;
    return {
      ...customStyles,
      body: {
        ...(customStyles?.body || {}),
        maxHeight: maxBodyHeight,
      },
    };
  }, [customStyles, maxBodyHeight]);

  return (
    <Modal
      {...restProps}
      title={resolvedTitle}
      footer={resolvedFooter}
      width={resolvedWidth}
      rootClassName={composedRootClass}
      className={composedModalClass}
      styles={mergedStyles}
      style={{
        maxWidth: '100vw',
        ...customStyle,
      }}
      data-testid="epms-responsive-modal"
      data-responsive-size={typeof size === 'string' ? size : 'custom'}
      data-body-scrollable={bodyScrollable ? 'true' : 'false'}
      data-safe-area={safeArea ? 'true' : 'false'}
    >
      {children}
    </Modal>
  );
};

export default ResponsiveModal;

