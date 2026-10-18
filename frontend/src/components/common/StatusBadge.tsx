import React from 'react';
import { Tag } from 'antd';
import {
  StatusDomain,
  resolveStatusPresentation,
  SemanticColor,
} from '@/lib/statusPresentation';

export interface StatusBadgeProps {
  domain: StatusDomain;
  status: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  showDot?: boolean;
  overrideLabel?: string;
  overrideColor?: SemanticColor;
}

/**
 * StatusBadge (UIUX-ROOT-04)
 * Canonical status presentation component mapping raw backend status enums to
 * standardized Indonesian business labels and semantic color tags.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  domain,
  status,
  className,
  style,
  showDot = false,
  overrideLabel,
  overrideColor,
}) => {
  const presentation = resolveStatusPresentation(domain, status);
  const label = overrideLabel || presentation.label;
  const color = overrideColor || presentation.color;

  const combinedStyle: React.CSSProperties = {
    fontWeight: 600,
    borderRadius: 4,
    margin: 0,
    fontSize: 11.5,
    ...style,
  };

  return (
    <Tag color={color} className={className} style={combinedStyle}>
      {showDot && <span style={{ marginRight: 4 }}>●</span>}
      {label}
    </Tag>
  );
};

export default StatusBadge;
