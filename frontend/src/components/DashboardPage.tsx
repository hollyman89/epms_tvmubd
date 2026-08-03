import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Typography, Space, Tag } from 'antd';
import { ProjectOutlined, DollarOutlined, LineChartOutlined, ClockCircleOutlined } from '@ant-design/icons';
import CountUp from 'react-countup';
import { Line } from '@ant-design/charts';
import axios from 'axios';

const { Title, Text } = Typography;

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
  const [summary, setSummary] = useState<SummaryData>({
    totalProjects: 0,
    totalRevenue: 0,
    avgProfitMargin: 0,
    pendingApprovals: 0,
    onTimeRate: 0
  });
  const [trendData, setTrendData] = useState<any[]>([]);
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getAuthToken = () => localStorage.getItem('access_token') || '';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        let token = localStorage.getItem('access_token');
        
        // Auto-login for demo if token is missing
        if (!token) {
          const loginRes = await axios.post('http://localhost:4000/api/v1/auth/login', {
            email: 'admin@epms.com',
            password: 'password123'
          });
          token = loginRes.data?.data?.access_token || loginRes.data?.access_token;
          if (token) localStorage.setItem('access_token', token);
        }

        const headers = { Authorization: `Bearer ${token}` };
        
        const [sumRes, trendRes, pendRes] = await Promise.all([
          axios.get('http://localhost:4000/api/v1/dashboard/summary', { headers }),
          axios.get('http://localhost:4000/api/v1/dashboard/project-trend', { headers }),
          axios.get('http://localhost:4000/api/v1/dashboard/procurement-pending', { headers })
        ]);

        // Handle possible nested data structures from Interceptors
        const sData = sumRes.data?.data?.data || sumRes.data?.data || sumRes.data;
        const tData = trendRes.data?.data?.data || trendRes.data?.data || trendRes.data;
        const pData = pendRes.data?.data?.data || pendRes.data?.data || pendRes.data;

        setSummary(sData);
        setTrendData(Array.isArray(tData) ? tData : []);
        setPendingList(Array.isArray(pData) ? pData : []);
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const lineConfig = {
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
  };

  const tableColumns = [
    { title: 'Tipe', dataIndex: 'type', key: 'type', render: (t: string) => <Tag color={t === 'Purchase Order' ? 'blue' : 'purple'}>{t}</Tag> },
    { title: 'Nomor Dokumen', dataIndex: 'number', key: 'number', render: (n: string) => <a>{n}</a> },
    { title: 'Tanggal', dataIndex: 'date', key: 'date', render: (d: string) => new Date(d).toLocaleDateString('id-ID') },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color="warning">{s}</Tag> }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: '24px' }}>Business Intelligence Dashboard</Title>
      
      {/* KPI Cards Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic 
              title={<Space><ProjectOutlined /> Total Project Aktif</Space>} 
              value={summary.totalProjects} 
              formatter={formatter} 
              valueStyle={{ color: '#1890ff', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic 
              title={<Space><DollarOutlined /> Total Pengeluaran (Revenue)</Space>} 
              value={summary.totalRevenue} 
              formatter={currencyFormatter} 
              valueStyle={{ color: '#52c41a', fontWeight: 600, fontSize: '20px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic 
              title={<Space><LineChartOutlined /> Rata-rata Profit Margin</Space>} 
              value={summary.avgProfitMargin} 
              formatter={percentageFormatter} 
              valueStyle={{ color: '#722ed1', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic 
              title={<Space><ClockCircleOutlined /> Menunggu Persetujuan</Space>} 
              value={summary.pendingApprovals} 
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
            {loading ? <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Memuat grafik...</div> : <Line {...lineConfig} />}
          </Card>
        </Col>

        {/* Pending Approvals Column */}
        <Col xs={24} lg={10}>
          <Card title="Dokumen Menunggu Persetujuan" bordered={false} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minHeight: '400px' }}>
            <Table 
              columns={tableColumns} 
              dataSource={pendingList} 
              loading={loading}
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
