"use client";

import React from 'react';
import { Row, Col, Typography, Space, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import CountUp from 'react-countup';
import styles from '../SalesPipelinePage.module.css';

const { Text } = Typography;

export interface KpiMetrics {
  count: { value: number; growth: number };
  won: { value: number; growth: number };
  active: { value: number; growth: number };
  winRate: { value: number; countValue: number; growth: number };
}

interface SalesKpiSummaryCardsProps {
  kpis: KpiMetrics;
  renderTrendBadge: (growth: number, isWinRate?: boolean) => React.ReactNode;
}

export const SalesKpiSummaryCards: React.FC<SalesKpiSummaryCardsProps> = ({ kpis, renderTrendBadge }) => {
  return (
    <Row gutter={[16, 16]} className={styles.kpiRibbon}>
      <Col xs={12} sm={6}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text className={styles.kpiTitle}>Total Tenders</Text>
          {renderTrendBadge(kpis.count.growth)}
        </div>
        <div className={styles.kpiValue} style={{ color: '#1677ff' }}>
          <CountUp preserveValue end={kpis.count.value} separator="." />
        </div>
      </Col>

      <Col xs={12} sm={6}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text className={styles.kpiTitle}>Revenue Secured</Text>
          {renderTrendBadge(kpis.won.growth)}
        </div>
        <div className={styles.kpiValue} style={{ color: '#52c41a' }}>
          Rp <CountUp preserveValue end={kpis.won.value} separator="." />
        </div>
      </Col>

      <Col xs={12} sm={6}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text className={styles.kpiTitle}>Active Pipeline</Text>
          {renderTrendBadge(kpis.active.growth)}
        </div>
        <div className={styles.kpiValue} style={{ color: '#faad14' }}>
          Rp <CountUp preserveValue end={kpis.active.value} separator="." />
        </div>
      </Col>

      <Col xs={12} sm={6}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={4}>
            <Text className={styles.kpiTitle}>Win Rate</Text>
            <Tooltip title="Weighted Revenue Win Rate">
              <InfoCircleOutlined style={{ fontSize: 11, color: '#8f959e' }} />
            </Tooltip>
          </Space>
          {renderTrendBadge(kpis.winRate.growth, true)}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <div className={styles.kpiValue} style={{ color: '#eb2f96' }}>
            <CountUp preserveValue end={kpis.winRate.value} decimals={1} />%
          </div>
          <Text type="secondary" style={{ fontSize: 10 }}>
            (by count: {kpis.winRate.countValue}%)
          </Text>
        </div>
      </Col>
    </Row>
  );
};
