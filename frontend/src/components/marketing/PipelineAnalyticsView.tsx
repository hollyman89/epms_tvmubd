"use client";

import React from 'react';
import { Row, Col, Card, Typography, Radio, Skeleton } from 'antd';
import { RocketOutlined, ExclamationCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const { Text, Title, Paragraph } = Typography;

interface PipelineAnalyticsViewProps {
  analyticsPeriodFilter: string;
  setAnalyticsPeriodFilter: (val: string) => void;
  loadingAnalytics: boolean;
  analyticsData: any;
  LineChart: React.ComponentType<any>;
  PieChart: React.ComponentType<any>;
  FunnelChart: React.ComponentType<any>;
  ChartErrorBoundary: React.ComponentType<{ children: React.ReactNode }>;
  EmptyChart: React.ComponentType;
}

export const PipelineAnalyticsView: React.FC<PipelineAnalyticsViewProps> = ({
  analyticsPeriodFilter,
  setAnalyticsPeriodFilter,
  loadingAnalytics,
  analyticsData,
  LineChart,
  PieChart,
  FunnelChart,
  ChartErrorBoundary,
  EmptyChart
}) => {
  return (
    <div style={{ marginTop: 16 }}>
      {/* Filter Area */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Radio.Group value={analyticsPeriodFilter} onChange={e => setAnalyticsPeriodFilter(e.target.value)} buttonStyle="solid">
          <Radio.Button value="LAST_MONTH">Bulan Lalu</Radio.Button>
          <Radio.Button value="THIS_MONTH">Bulan Ini</Radio.Button>
          <Radio.Button value="THIS_QUARTER">Kuartal Ini</Radio.Button>
          <Radio.Button value="YEAR_TO_DATE">Tahun Ini</Radio.Button>
        </Radio.Group>
      </div>

      {loadingAnalytics ? (
        <div style={{ padding: 24, background: '#fff', borderRadius: 8 }}>
          <Skeleton active paragraph={{ rows: 2 }} />
          <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
            <Col span={16}><Skeleton.Button active style={{ width: '100%', height: 300 }} /></Col>
            <Col span={8}><Skeleton.Button active style={{ width: '100%', height: 300 }} /></Col>
          </Row>
        </div>
      ) : analyticsData ? (
        <>
          {/* KPI Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <Text type="secondary">Total Pipeline</Text>
                <Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
                  Rp {(analyticsData.kpi?.totalPipeline || 0).toLocaleString('id-ID')}
                </Title>
                <Text type={analyticsData.kpi?.momGrowth >= 0 ? "success" : "danger"}>
                  {analyticsData.kpi?.momGrowth >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} 
                  {Math.abs(analyticsData.kpi?.momGrowth * 100).toFixed(1)}% dari bulan lalu
                </Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <Text type="secondary">Win Rate</Text>
                <Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
                  {((analyticsData.kpi?.winRate || 0) * 100).toFixed(1)}%
                </Title>
                <Text type="secondary">
                  Dari total {analyticsData.kpi?.totalDeals || 0} Deals
                </Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <Text type="secondary">Avg Deal Size</Text>
                <Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
                  Rp {(analyticsData.kpi?.avgDealSize || 0).toLocaleString('id-ID')}
                </Title>
                <Text type="secondary">Rata-rata per tender</Text>
              </Card>
            </Col>
          </Row>

          {/* Charts Grid */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Card title="Tren Pipeline 12 Bulan Terakhir" bordered={false} style={{ borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <ChartErrorBoundary>
                  {analyticsData.trendLine?.length > 0 ? (
                    <LineChart 
                      data={analyticsData.trendLine || []} 
                      xField="month" 
                      yField="value"
                      smooth={true}
                      style={{ stroke: '#1677ff', lineWidth: 2 }}
                      axis={{
                        y: {
                          labelFormatter: (v: any) => `Rp ${(Number(v) / 1000000000).toFixed(1)}M`
                        }
                      }}
                      tooltip={{
                        items: [
                          {
                            name: 'Total Pipeline',
                            field: 'value',
                            valueFormatter: (v: any) => `Rp ${Number(v).toLocaleString('id-ID')}`
                          }
                        ]
                      }}
                    />
                  ) : <EmptyChart />}
                </ChartErrorBoundary>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="Distribusi Pipeline per Sektor" bordered={false} style={{ borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 16 }}>
                <ChartErrorBoundary>
                  {analyticsData.sectorDistribution?.filter((item: any) => Number(item.value) > 0)?.length > 0 ? (
                    <PieChart 
                      data={analyticsData.sectorDistribution.filter((item: any) => Number(item.value) > 0)} 
                      angleField="value" 
                      colorField="sector" 
                      radius={0.8}
                      innerRadius={0.6}
                      label={{
                        text: (datum: any) => datum.value > 0 ? `${datum.sector}\n${datum.percentage}%` : '',
                        style: { fontSize: 11, textAlign: 'center' }
                      }}
                      tooltip={{
                        items: [
                          {
                            name: 'Nilai',
                            field: 'value',
                            valueFormatter: (v: any) => `Rp ${Number(v).toLocaleString('id-ID')}`
                          }
                        ]
                      }}
                      legend={{ color: { position: 'bottom', layout: { justifyContent: 'center' } } }}
                    />
                  ) : <EmptyChart />}
                </ChartErrorBoundary>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Sales Funnel Conversion" bordered={false} style={{ borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <ChartErrorBoundary>
                  {analyticsData.funnel?.length > 0 ? (
                    (() => {
                      const stageLabelMap: Record<string, string> = {
                        LEAD: 'Prospek', QUALIFICATION: 'Kualifikasi',
                        PROPOSAL: 'Proposal', NEGOTIATION: 'Negosiasi', WON: 'Menang'
                      };
                      const funnelData = analyticsData.funnel.map((item: any) => ({
                        ...item,
                        stage: stageLabelMap[item.stage] || item.stage
                      }));
                      return (
                        <FunnelChart
                          data={funnelData}
                          xField="stage"
                          yField="count"
                          dynamicHeight={true}
                        />
                      );
                    })()
                  ) : <EmptyChart />}
                </ChartErrorBoundary>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="AI Executive Summary" bordered={false} style={{ borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', background: '#f8faff', height: '100%' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <RocketOutlined style={{ fontSize: 24, color: '#1677ff' }} />
                  <div>
                    <Paragraph style={{ fontWeight: 500, fontSize: 15, marginBottom: 8 }}>
                      {analyticsData.insights?.topInsight || "Memuat insight..."}
                    </Paragraph>
                    <Paragraph type="warning" style={{ margin: 0 }}>
                      <ExclamationCircleOutlined /> {analyticsData.insights?.warningInsight || "-"}
                    </Paragraph>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </>
      ) : (
        <EmptyChart />
      )}
    </div>
  );
};
