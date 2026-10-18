import React from 'react';
import { Card } from 'antd';
import { CANONICAL_FONT_FAMILY } from '@/constants/theme';

export interface KpiStatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  supportingText?: React.ReactNode;
  icon?: React.ReactNode;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  semanticState?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  loading?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}

const SEMANTIC_VALUE_COLORS = {
  neutral: '#0f172a',
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#fa8c16',
  danger: '#f5222d',
};

export const KpiStatCard: React.FC<KpiStatCardProps> = ({
  label,
  value,
  supportingText,
  icon,
  prefix,
  suffix,
  semanticState = 'neutral',
  loading = false,
  onClick,
  style,
  bodyStyle,
}) => {
  const valueColor = SEMANTIC_VALUE_COLORS[semanticState] || '#0f172a';

  return (
    <Card
      size="small"
      bordered
      loading={loading}
      onClick={onClick}
      style={{
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: CANONICAL_FONT_FAMILY,
        ...style,
      }}
      bodyStyle={{
        padding: '16px',
        ...bodyStyle,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#64748b',
          }}
        >
          {icon}
          <span>{label}</span>
        </div>
        <div
          style={{
            fontSize: '22px',
            fontWeight: 700,
            lineHeight: '30px',
            color: valueColor,
            fontVariantNumeric: 'tabular-nums',
            display: 'flex',
            alignItems: 'baseline',
            gap: '4px',
          }}
        >
          {prefix && <span style={{ fontSize: '14px', fontWeight: 600 }}>{prefix}</span>}
          <span>{value}</span>
          {suffix && <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748b' }}>{suffix}</span>}
        </div>
        {supportingText && (
          <div
            style={{
              fontSize: '12px',
              fontWeight: 400,
              color: '#64748b',
              marginTop: '2px',
            }}
          >
            {supportingText}
          </div>
        )}
      </div>
    </Card>
  );
};
