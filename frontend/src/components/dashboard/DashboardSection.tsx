import React from 'react';
import styles from './DashboardSection.module.css';

export interface DashboardSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  description,
  icon,
  actions,
  children,
  className = '',
  style,
}) => {
  return (
    <section className={`${styles.section} ${className}`} style={style}>
      <header className={styles.sectionHeader}>
        <div className={styles.titleArea}>
          {icon && <div className={styles.iconWrapper}>{icon}</div>}
          <div>
            <h2 className={styles.titleText}>{title}</h2>
            {description && <p className={styles.descriptionText}>{description}</p>}
          </div>
        </div>
        {actions && <div className={styles.actionsArea}>{actions}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
};
