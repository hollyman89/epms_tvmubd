import React from 'react';
import { Skeleton, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import styles from './ExecutiveKpiCard.module.css';

export interface ExecutiveKpiCardProps {
  icon: React.ReactNode;
  iconTone?: 'blue' | 'sky' | 'orange' | 'purple' | 'green' | 'amber' | 'neutral';
  label: string;
  tooltip?: string;
  value: React.ReactNode;
  secondaryContext?: React.ReactNode;
  badgeLabel?: string;
  badgeType?: 'period' | 'snapshot';
  loading?: boolean;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const ExecutiveKpiCard: React.FC<ExecutiveKpiCardProps> = ({
  icon,
  iconTone = 'blue',
  label,
  tooltip,
  value,
  secondaryContext,
  badgeLabel,
  badgeType = 'period',
  loading = false,
  action,
  className = '',
  style,
}) => {
  const toneClass = {
    blue: styles.iconBlue,
    sky: styles.iconSky,
    orange: styles.iconOrange,
    purple: styles.iconPurple,
    green: styles.iconGreen,
    amber: styles.iconAmber,
    neutral: '',
  }[iconTone];

  return (
    <div className={`${styles.card} ${className}`} style={style}>
      {loading ? (
        <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 2, width: ['80%', '40%'] }} />
      ) : (
        <>
          <div>
            <div className={styles.topRow}>
              {tooltip ? (
                <Tooltip title={tooltip}>
                  <div className={styles.labelArea} style={{ cursor: 'help' }}>
                    <div className={`${styles.iconContainer} ${toneClass}`}>
                      {icon}
                    </div>
                    <span className={styles.label} title={label}>
                      {label}
                    </span>
                  </div>
                </Tooltip>
              ) : (
                <div className={styles.labelArea}>
                  <div className={`${styles.iconContainer} ${toneClass}`}>
                    {icon}
                  </div>
                  <span className={styles.label} title={label}>
                    {label}
                  </span>
                </div>
              )}
              {action && (
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {action}
                </div>
              )}
            </div>

            <div className={styles.valueArea}>
              {value}
            </div>
          </div>

          <div className={styles.footerRow}>
            <span className={styles.secondaryContext}>
              {secondaryContext}
            </span>
            {badgeLabel && (
              <span
                className={`${styles.badge} ${
                  badgeType === 'snapshot' ? styles.badgeSnapshot : styles.badgePeriod
                }`}
              >
                {badgeLabel}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};
