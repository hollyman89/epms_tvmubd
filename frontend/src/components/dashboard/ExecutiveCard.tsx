import React from 'react';
import styles from './ExecutiveCard.module.css';

export type ExecutiveCardVariant = 'default' | 'kpi' | 'attention' | 'subtle' | 'neutral';

export interface ExecutiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ExecutiveCardVariant;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const ExecutiveCard: React.FC<ExecutiveCardProps> = ({
  variant = 'default',
  interactive = false,
  className = '',
  children,
  style,
  ...rest
}) => {
  const variantClass = {
    default: styles.variantDefault,
    kpi: styles.variantKpi,
    attention: styles.variantAttention,
    subtle: styles.variantSubtle,
    neutral: styles.variantNeutral,
  }[variant];

  return (
    <div
      className={`${styles.card} ${variantClass} ${interactive ? styles.cardInteractive : ''} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
};
