'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Card, Typography, Tag, Button, Input, Select, Space, Breadcrumb, Modal, message, Spin } from 'antd';
import { FilePdfOutlined, DownloadOutlined, EyeOutlined, SearchOutlined, FolderOpenOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/axios';
import { streamSecureDocument, downloadSecureDocument } from '@/lib/fileDelivery';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const { Title, Text } = Typography;
const { Option } = Select;

export default function DocumentsRepositoryPage() {
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Preview Modal State
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const { data: documentsData = [], isLoading: loading, refetch: fetchDocuments } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/documents');

        // Penanganan unwrap response bersarang NestJS (response.data.data.data)
        const rawBody = response.data;
        const resData = rawBody?.data?.data || rawBody?.data || rawBody;
        return Array.isArray(resData) ? resData : [];
      } catch (err) {
        console.warn('Gagal memuat dokumen API, menggunakan data simulasi:', err);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const handlePreview = async (doc: any) => {
    setPreviewDoc(doc);
    setPreviewVisible(true);
    setPreviewLoading(true);
    setPreviewError(null);

    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }

    try {
      const { objectUrl } = await streamSecureDocument(doc.id);
      setPreviewBlobUrl(objectUrl);
    } catch (err: any) {
      console.error('Failed to stream document:', err);
      setPreviewError('Gagal memuat pratinjau dokumen dari secure endpoint.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewVisible(false);
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewDoc(null);
    setPreviewError(null);
  };

  const handleDownload = async (doc: any) => {
    if (!doc?.id) {
      message.error('ID dokumen tidak valid.');
      return;
    }
    try {
      message.loading({ content: `Mengunduh berkas ${doc.fileName}...`, key: 'doc-download' });
      await downloadSecureDocument(doc.id, doc.fileName || `document-${doc.id}.pdf`);
      message.success({ content: `Dokumen ${doc.fileName} berhasil diunduh.`, key: 'doc-download' });
    } catch (err) {
      console.error('Download error:', err);
      message.error({ content: `Gagal mengunduh dokumen: ${doc.fileName}`, key: 'doc-download' });
    }
  };

  const safeDocuments = Array.isArray(documentsData) ? documentsData : [];

  const filteredDocuments = safeDocuments.filter((doc) => {
    if (!doc) return false;
    const matchesSearch = doc.fileName?.toLowerCase().includes(searchText.toLowerCase()) ||
                          String(doc.entityId || '').includes(searchText);
    const matchesType = selectedType === 'ALL' || doc.entityType?.toUpperCase() === selectedType.toUpperCase();
    return matchesSearch && matchesType;
  });

  const columns = useMemo(() => [
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
  ], []);

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DIRECTOR', 'LEGAL', 'GENERAL_MANAGER']}>
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

          <Button icon={<ReloadOutlined />} onClick={() => fetchDocuments()} loading={loading}>
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
            scroll={{ x: 800 }}
          />
        </Card>

        {/* Modal Preview PDF */}
        {previewVisible && (
          <Modal
            title={`Preview Dokumen — ${previewDoc?.fileName || ''}`}
            open={previewVisible}
            onCancel={handleClosePreview}
            footer={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => previewDoc && handleDownload(previewDoc)} style={{ backgroundColor: '#1d4ed8', borderRadius: 6 }}>
                  Unduh Berkas
                </Button>
                <Button key="close" onClick={handleClosePreview} style={{ borderRadius: 6 }}>
                  Tutup
                </Button>
              </div>
            }
            width="min(1440px, 92vw)"
            centered
            style={{ top: 0, paddingBottom: 0 }}
            styles={{
              content: {
                height: 'min(900px, 90vh)',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden',
                borderRadius: 12,
              },
              header: {
                flex: '0 0 auto',
                padding: '12px 20px',
                margin: 0,
                borderBottom: '1px solid #e2e8f0',
                background: '#ffffff',
              },
              body: {
                flex: '1 1 auto',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden',
                background: '#f1f5f9',
              },
              footer: {
                flex: '0 0 auto',
                padding: '12px 20px',
                margin: 0,
                borderTop: '1px solid #e2e8f0',
                background: '#ffffff',
              },
            }}
          >
            {previewLoading ? (
              <div style={{ padding: 40, textAlign: 'center', flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Spin size="large" tip="Memuat dokumen dari secure endpoint..." />
              </div>
            ) : previewError ? (
              <div style={{ padding: 40, textAlign: 'center', flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="danger">{previewError}</Text>
              </div>
            ) : previewBlobUrl ? (
              <iframe
                src={previewBlobUrl}
                title="Preview Dokumen"
                width="100%"
                height="100%"
                style={{ border: 'none', width: '100%', height: '100%', flex: '1 1 auto', display: 'block' }}
              />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary">File dokumen tidak dapat dimuat.</Text>
              </div>
            )}
          </Modal>
        )}
      </div>
    </ProtectedRoute>
  );
}
