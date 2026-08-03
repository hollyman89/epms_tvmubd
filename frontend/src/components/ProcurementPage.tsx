import React, { useState, useEffect } from 'react';
import { Table, Typography, Card, Row, Col, Statistic, Tag, message } from 'antd';
import { FileDoneOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { ProcurementService } from '@/services';

const { Title, Text } = Typography;

export const ProcurementPage: React.FC = () => {
  const [prs, setPrs] = useState<import('@/services').PurchaseRequest[]>([]);
  const [pos, setPos] = useState<import('@/services').PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prData, poData] = await Promise.all([
        ProcurementService.getPurchaseRequests(),
        ProcurementService.getPurchaseOrders()
      ]);

      setPrs(Array.isArray(prData) ? prData : []);
      setPos(Array.isArray(poData) ? poData : []);
    } catch (error: any) {
      if (error.response?.status === 401) {
        message.warning('Anda belum login. Beberapa data mungkin tidak tampil.');
      } else {
        message.error('Gagal mengambil data Procurement');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const prColumns = [
    { title: 'Nomor PR', dataIndex: 'prNumber', key: 'prNumber' },
    { title: 'Estimasi Total', dataIndex: 'totalEstimatedAmount', key: 'totalEstimatedAmount', render: (val: number) => `Rp ${val.toLocaleString('id-ID')}` },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'APPROVED' ? 'green' : status === 'SUBMITTED' ? 'blue' : 'orange'}>
          {status}
        </Tag>
      )
    },
    { title: 'Tanggal Dibuat', dataIndex: 'createdAt', key: 'createdAt', render: (date: string) => new Date(date).toLocaleDateString() },
  ];

  const poColumns = [
    { title: 'Nomor PO', dataIndex: 'poNumber', key: 'poNumber' },
    { title: 'Total Pembelian', dataIndex: 'totalAmount', key: 'totalAmount', render: (val: number) => `Rp ${val.toLocaleString('id-ID')}` },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ISSUED' ? 'blue' : 'green'}>
          {status}
        </Tag>
      )
    },
    { title: 'Tanggal Terbit', dataIndex: 'createdAt', key: 'createdAt', render: (date: string) => new Date(date).toLocaleDateString() },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Procurement Module</Title>
      <Text type="secondary">Rekapitulasi Purchase Request (PR) dan Purchase Order (PO)</Text>

      <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
        <Col span={12}>
          <Card>
            <Statistic 
              title="Total Purchase Request" 
              value={prs.length} 
              prefix={<FileDoneOutlined />} 
              valueStyle={{ color: '#1677ff' }} 
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic 
              title="Total Purchase Order" 
              value={pos.length} 
              prefix={<ShoppingCartOutlined />} 
              valueStyle={{ color: '#52c41a' }} 
            />
          </Card>
        </Col>
      </Row>

      <Card title="Daftar Purchase Request" style={{ marginBottom: 24 }}>
        <Table 
          columns={prColumns} 
          dataSource={prs} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 5 }}
        />
      </Card>

      <Card title="Daftar Purchase Order">
        <Table 
          columns={poColumns} 
          dataSource={pos} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 5 }}
        />
      </Card>
    </div>
  );
};
