'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Tag, Button, Input, Select, Space, Breadcrumb, Modal, message } from 'antd';
import { FilePdfOutlined, DownloadOutlined, EyeOutlined, SearchOutlined, FolderOpenOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { MainLayout } from '../../components/MainLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';

const { Title, Text } = Typography;
const { Option } = Select;

export default function DocumentsRepositoryPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Preview Modal State
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get('http://localhost:4000/api/v1/documents', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Penanganan unwrap response bersarang NestJS (response.data.data.data)
      const rawBody = response.data;
      const resData = rawBody?.data?.data || rawBody?.data || rawBody;
      const dataArray = Array.isArray(resData) ? resData : [];
      setDocuments(dataArray);
    } catch (err) {
      console.warn('Gagal memuat dokumen API, menggunakan data simulasi:', err);
      setDocuments([
        {
          id: 1,
          fileName: 'Proposal_Penawaran_Pengadaan_Leasing_2026.pdf',
          entityType: 'PROPOSAL',
          entityId: 1,
          fileSize: 2450000,
          createdAt: new Date().toISOString(),
          fileUrl: 'http://localhost:4000/uploads/proposals/sample_proposal.pdf'
        },
        {
          id: 2,
          fileName: 'Surat_Perjanjian_Kerja_SPK_Resmi.pdf',
          entityType: 'SPK',
          entityId: 1,
          fileSize: 1840000,
          createdAt: new Date().toISOString(),
          fileUrl: 'http://localhost:4000/uploads/proposals/sample_spk.pdf'
        },
        {
          id: 3,
          fileName: 'Dokumen_Kontrak_Legal_Verified_CTR001.pdf',
          entityType: 'CONTRACT',
          entityId: 7,
          fileSize: 3120000,
          createdAt: new Date().toISOString(),
          fileUrl: 'http://localhost:4000/uploads/proposals/sample_contract.pdf'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (doc: any) => {
    setPreviewDoc(doc);
    setPreviewVisible(true);
  };

  const handleDownload = (doc: any) => {
    if (doc?.fileUrl) {
      window.open(doc.fileUrl, '_blank');
      message.success(`Mengunduh file: ${doc.fileName}`);
    } else {
      message.error('URL file tidak ditemukan.');
    }
  };

  const safeDocuments = Array.isArray(documents) ? documents : [];

  const filteredDocuments = safeDocuments.filter((doc) => {
    if (!doc) return false;
    const matchesSearch = doc.fileName?.toLowerCase().includes(searchText.toLowerCase()) ||
                          String(doc.entityId || '').includes(searchText);
    const matchesType = selectedType === 'ALL' || doc.entityType?.toUpperCase() === selectedType.toUpperCase();
    return matchesSearch && matchesType;
  });

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
    },
    {
      title: 'Nama Dokumen',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (text: string) => (
        <Space>
          <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
          <Text strong>{text || 'Dokumen Tanpa Nama'}</Text>
        </Space>
      ),
    },
    {
      title: 'Kategori / Tipe',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 140,
      render: (type: string) => {
        const uppercaseType = (type || 'DOCUMENT').toUpperCase();
        let color = 'blue';
        if (uppercaseType === 'PROPOSAL') color = 'gold';
        if (uppercaseType === 'SPK') color = 'purple';
        if (uppercaseType === 'CONTRACT') color = 'green';
        if (uppercaseType === 'PURCHASE_ORDER') color = 'cyan';
        return <Tag color={color}>{uppercaseType}</Tag>;
      },
    },
    {
      title: 'Tender / Contract ID',
      dataIndex: 'entityId',
      key: 'entityId',
      width: 150,
      render: (id: number, record: any) => (
        <Text type="secondary">
          #{id || '-'} ({record?.entityType || 'Ref'})
        </Text>
      ),
    },
    {
      title: 'Ukuran File',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 120,
      render: (bytes: number) => {
        if (!bytes) return '-';
        const mb = (bytes / (1024 * 1024)).toFixed(2);
        return `${mb} MB`;
      },
    },
    {
      title: 'Tanggal Upload',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (dateStr: string) => dateStr ? new Date(dateStr).toLocaleString('id-ID') : '-',
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record)}
          >
            Pratinjau
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
          >
            Unduh
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DIRECTOR', 'LEGAL', 'GENERAL_MANAGER']}>
      <MainLayout>
        <div style={{ padding: '24px', minHeight: 'calc(100vh - 64px)' }}>
          {/* Header */}
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Breadcrumb items={[{ title: 'Data Master' }, { title: 'Master Documents Repository' }]} />
              <Title level={3} style={{ margin: '8px 0 0 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <FolderOpenOutlined style={{ color: '#1677ff' }} />
                Master Document Repository
              </Title>
              <Text type="secondary">
                Repositori terpusat untuk melihat, mendownload, dan memverifikasi seluruh dokumen SPK, Proposal, dan Kontrak.
              </Text>
            </div>

            <Button icon={<ReloadOutlined />} onClick={fetchDocuments} loading={loading}>
              Refresh Data
            </Button>
          </div>

          {/* Filter Bar */}
          <Card style={{ marginBottom: 20 }}>
            <Space size="middle" wrap>
              <Input
                placeholder="Cari nama dokumen atau ID..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 300 }}
                allowClear
              />

              <Select
                value={selectedType}
                onChange={(val) => setSelectedType(val)}
                style={{ width: 200 }}
              >
                <Option value="ALL">Semua Tipe Dokumen</Option>
                <Option value="PROPOSAL">PROPOSAL</Option>
                <Option value="SPK">SPK</Option>
                <Option value="CONTRACT">CONTRACT</Option>
                <Option value="PURCHASE_ORDER">PURCHASE ORDER</Option>
              </Select>
            </Space>
          </Card>

          {/* Table Document */}
          <Card bodyStyle={{ padding: 0 }}>
            <Table
              dataSource={filteredDocuments}
              columns={columns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Card>

          {/* Modal Preview PDF */}
          <Modal
            title={`Pratinjau Dokumen: ${previewDoc?.fileName || ''}`}
            open={previewVisible}
            onCancel={() => setPreviewVisible(false)}
            footer={[
              <Button key="close" onClick={() => setPreviewVisible(false)}>
                Tutup
              </Button>,
              <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => handleDownload(previewDoc)}>
                Unduh File
              </Button>,
            ]}
            width={900}
            bodyStyle={{ height: '650px', padding: 0 }}
          >
            {previewDoc?.fileUrl ? (
              <iframe
                src={previewDoc.fileUrl}
                title="Document Preview"
                width="100%"
                height="100%"
                style={{ border: 'none' }}
              />
            ) : (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Text type="secondary">File dokumen tidak dapat dimuat.</Text>
              </div>
            )}
          </Modal>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
