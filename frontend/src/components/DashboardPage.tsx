import React, { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Row, Col, Card, Statistic, Table, Typography, Space, Tag, Spin, Empty } from 'antd';
import { ProjectOutlined, DollarOutlined, LineChartOutlined, ClockCircleOutlined } from '@ant-design/icons';
import CountUp from 'react-countup';
import {
  useDashboardSummaryQuery,
  useDashboardProjectTrendQuery,
  useDashboardProcurementPendingQuery,
} from '@/hooks/useDashboardQuery';

const LineChart = dynamic(
  () => import('@ant-design/charts').then((mod) => mod.Line),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="Memuat grafik..." />
      </div>
    ),
  }
);

const { Title } = Typography;

interface SummaryData {
  totalProjects: number;
  totalRevenue: number;
  avgProfitMargin: number;
  pendingApprovals: number;
  onTimeRate: number;
}

const formatter = (value: number | string) => <CountUp end={Number(value)} separator="." decimal="," />;
const currencyFormatter = (value: number | string) => <CountUp end={Number(value)} separator="." decimal="," prefix="Rp " />;
const percentageFormatter = (value: number | string) => <CountUp end={Number(value)} decimals={2} decimal="," suffix="%" />;

export const DashboardPage: React.FC = () => {
  const { data: summaryData, isLoading: isLoadingSummary } = useDashboardSummaryQuery('all', '/dashboard/summary');
  const summary: SummaryData | null = summaryData || null;

  const { data: trendData = [], isLoading: isLoadingTrend } = useDashboardProjectTrendQuery();
  const { data: pendingList = [], isLoading: isLoadingPending } = useDashboardProcurementPendingQuery();

  const lineConfig = useMemo(() => ({
    data: trendData,
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
    color: ['#1890ff', '#faad14'],
  }), [trendData]);

  const tableColumns = useMemo(() => [
    { title: 'Tipe', dataIndex: 'type', key: 'type', render: (t: string) => <Tag color={t === 'Purchase Order' ? 'blue' : 'purple'}>{t}</Tag> },
    { title: 'Nomor Dokumen', dataIndex: 'number', key: 'number', render: (n: string) => <a>{n}</a> },
    { title: 'Tanggal', dataIndex: 'date', key: 'date', render: (d: string) => new Date(d).toLocaleDateString('id-ID') },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color="warning">{s}</Tag> }
  ], []);

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: '24px' }}>Business Intelligence Dashboard</Title>
      
      {/* KPI Cards Row (Independent Loading for Fast First Paint) */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} loading={isLoadingSummary} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic 
              title={<Space><ProjectOutlined /> Total Project Aktif</Space>} 
              value={summary?.totalProjects ?? 0} 
              formatter={formatter} 
              valueStyle={{ color: '#1890ff', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} loading={isLoadingSummary} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic 
              title={<Space><DollarOutlined /> Total Pengeluaran (Revenue)</Space>} 
              value={summary?.totalRevenue ?? 0} 
              formatter={currencyFormatter} 
              valueStyle={{ color: '#52c41a', fontWeight: 600, fontSize: '20px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} loading={isLoadingSummary} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic 
              title={<Space><LineChartOutlined /> Rata-rata Profit Margin</Space>} 
              value={summary?.avgProfitMargin ?? 0} 
              formatter={percentageFormatter} 
              valueStyle={{ color: '#722ed1', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} loading={isLoadingSummary} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic 
              title={<Space><ClockCircleOutlined /> Menunggu Persetujuan</Space>} 
              value={summary?.pendingApprovals ?? 0} 
              formatter={formatter} 
              valueStyle={{ color: '#faad14', fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* Trend Chart Column */}
        <Col xs={24} lg={14}>
          <Card title="Tren Penyelesaian Proyek (30 Hari Terakhir)" bordered={false} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minHeight: '400px' }}>
            {isLoadingTrend ? (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin tip="Memuat grafik..." />
              </div>
            ) : trendData.length === 0 ? (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada data tren penyelesaian proyek." />
              </div>
            ) : (
              <LineChart {...lineConfig} />
            )}
          </Card>
        </Col>

        {/* Pending Approvals Column (Independent Loading) */}
        <Col xs={24} lg={10}>
          <Card title="Dokumen Menunggu Persetujuan" bordered={false} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minHeight: '400px' }}>
            <Table 
              columns={tableColumns} 
              dataSource={pendingList} 
              loading={isLoadingPending}
              pagination={false}
              size="small"
              rowKey="id"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
