"use client";

import React from 'react';
import { Row, Col, Typography, Space, Tooltip } from 'antd';
import {
  InfoCircleOutlined,
  ProjectOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import CountUp from 'react-countup';

const { Text } = Typography;

export interface KpiMetrics {
  count: { value: number; growth: number | null };
  won: { value: number; growth: number | null };
  active: { value: number; growth: number | null };
  winRate: { value: number; countValue: number; growth: number | null };
}

interface SalesKpiSummaryCardsProps {
  kpis: KpiMetrics;
  renderTrendBadge: (growth: number | null, isWinRate?: boolean) => React.ReactNode;
}

export const SalesKpiSummaryCards: React.FC<SalesKpiSummaryCardsProps> = ({ kpis, renderTrendBadge }) => {
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      {/* 1. TOTAL TENDERS */}
      <Col xs={24} sm={12} md={12} lg={12} xl={6}>
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 118,
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={6} align="center">
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                <ProjectOutlined />
              </div>
              <Text style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>
                Total Tenders
              </Text>
            </Space>
            {renderTrendBadge(kpis.count.growth)}
          </div>

          <div style={{ marginTop: 10 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#0F172A',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
              }}
            >
              <CountUp preserveValue end={kpis.count.value} separator="." />
            </div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3 }}>
              Total peluang dalam periode
            </div>
          </div>
        </div>
      </Col>

      {/* 2. REVENUE SECURED */}
      <Col xs={24} sm={12} md={12} lg={12} xl={6}>
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 118,
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={6} align="center">
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  backgroundColor: '#F0FDF4',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                <SafetyCertificateOutlined />
              </div>
              <Text style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>
                Revenue Secured
              </Text>
            </Space>
            {renderTrendBadge(kpis.won.growth)}
          </div>

          <div style={{ marginTop: 10 }}>
            <div
              style={{
                fontSize: 'clamp(17px, 1.2vw, 21px)',
                fontWeight: 700,
                color: '#16A34A',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Rp <CountUp preserveValue end={kpis.won.value} separator="." />
            </div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3 }}>
              Nilai tender berstatus WON
            </div>
          </div>
        </div>
      </Col>

      {/* 3. ACTIVE PIPELINE */}
      <Col xs={24} sm={12} md={12} lg={12} xl={6}>
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 118,
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={6} align="center">
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  backgroundColor: '#FFFBEB',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                <SyncOutlined />
              </div>
              <Text style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>
                Active Pipeline
              </Text>
            </Space>
            {renderTrendBadge(kpis.active.growth)}
          </div>

          <div style={{ marginTop: 10 }}>
            <div
              style={{
                fontSize: 'clamp(17px, 1.2vw, 21px)',
                fontWeight: 700,
                color: '#D97706',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Rp <CountUp preserveValue end={kpis.active.value} separator="." />
            </div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3 }}>
              Total estimasi tender aktif
            </div>
          </div>
        </div>
      </Col>

      {/* 4. WIN RATE */}
      <Col xs={24} sm={12} md={12} lg={12} xl={6}>
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 118,
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={6} align="center">
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  backgroundColor: '#FAF5FF',
                  color: '#9333EA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                <TrophyOutlined />
              </div>
              <Space size={4}>
                <Text style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>
                  Win Rate
                </Text>
                <Tooltip title="Weighted Revenue Win Rate">
                  <InfoCircleOutlined style={{ fontSize: 11, color: '#94A3B8', cursor: 'pointer' }} />
                </Tooltip>
              </Space>
            </Space>
            {renderTrendBadge(kpis.winRate.growth, true)}
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#0F172A',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.2,
                }}
              >
                <CountUp preserveValue end={kpis.winRate.value} decimals={1} />%
              </span>
              <Text style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500 }}>
                (by count: {kpis.winRate.countValue}%)
              </Text>
            </div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3 }}>
              Rasio kemenangan tender
            </div>
          </div>
        </div>
      </Col>
    </Row>
  );
};
