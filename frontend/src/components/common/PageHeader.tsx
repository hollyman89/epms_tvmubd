import React from 'react';
import { Space, Typography } from 'antd';
import { CANONICAL_FONT_FAMILY } from '@/constants/theme';

const { Title, Text } = Typography;

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  extra?: React.ReactNode;
  tag?: React.ReactNode;
  style?: React.CSSProperties;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  extra,
  tag,
  style,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
        fontFamily: CANONICAL_FONT_FAMILY,
        ...style,
      }}
    >
      <div>
        <Space align="center" size={8} wrap>
          {icon}
          <Title
            level={3}
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 600,
              lineHeight: '32px',
              color: '#0f172a',
              fontFamily: CANONICAL_FONT_FAMILY,
            }}
          >
            {title}
          </Title>
          {tag}
        </Space>
        {subtitle && (
          <Text
            type="secondary"
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 400,
              lineHeight: '20px',
              color: '#64748b',
              marginTop: '4px',
              fontFamily: CANONICAL_FONT_FAMILY,
            }}
          >
            {subtitle}
          </Text>
        )}
      </div>
      {extra && <div>{extra}</div>}
    </div>
  );
};
