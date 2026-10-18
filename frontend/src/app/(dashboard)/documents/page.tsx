'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  Card,
  Typography,
  Button,
  Input,
  Select,
  Breadcrumb,
  Modal,
  message,
  Spin,
  Alert,
  Tooltip,
  Empty,
  Pagination,
} from 'antd';
import {
  FilePdfOutlined,
  FileImageOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FileTextOutlined,
  DownloadOutlined,
  EyeOutlined,
  SearchOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/lib/axios';
import { streamSecureDocument, downloadSecureDocument } from '@/lib/fileDelivery';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import styles from './DocumentsPage.module.css';

const { Title, Text } = Typography;
const { Option } = Select;

interface DocumentRecord {
  id: number;
  fileName: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  entityType?: string;
  entityId?: number;
  uploadedBy?: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function DocumentsRepositoryPage() {
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Preview Modal State
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const {
    data: documentsData = [],
    isLoading: loading,
    isError,
    error,
    refetch: fetchDocuments,
  } = useQuery<DocumentRecord[]>({
    queryKey: ['documents'],
    queryFn: async () => {
      const response = await apiClient.get('/documents');

      // Unwrap response standard NestJS (response.data.data.data or response.data.data or response.data)
      const rawBody = response.data;
      const resData = rawBody?.data?.data || rawBody?.data || rawBody;
      return Array.isArray(resData) ? resData : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const handlePreview = async (doc: DocumentRecord) => {
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

  const handleDownload = async (doc: DocumentRecord) => {
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

  const safeDocuments = useMemo(() => (Array.isArray(documentsData) ? documentsData : []), [documentsData]);

  const filteredDocuments = useMemo(() => {
    return safeDocuments.filter((doc) => {
      if (!doc) return false;
      const term = searchText.trim().toLowerCase();
      const matchesSearch =
        !term ||
        (doc.fileName && doc.fileName.toLowerCase().includes(term)) ||
        String(doc.id).includes(term) ||
        String(doc.entityId || '').includes(term);

      const matchesType =
        selectedType === 'ALL' || (doc.entityType && doc.entityType.toUpperCase() === selectedType.toUpperCase());

      return matchesSearch && matchesType;
    });
  }, [safeDocuments, searchText, selectedType]);

  const handleSearchChange = (val: string) => {
    setSearchText(val);
    setCurrentPage(1);
  };

  const handleTypeChange = (val: string) => {
    setSelectedType(val);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchText('');
    setSelectedType('ALL');
    setCurrentPage(1);
  };

  // MIME / Extension Aware Icon
  const getFileIcon = (fileName?: string, mimeType?: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    const mime = mimeType?.toLowerCase();

    if (mime?.includes('pdf') || ext === 'pdf') {
      return <FilePdfOutlined style={{ color: '#EF4444', fontSize: 18 }} />;
    }
    if (mime?.includes('image') || ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext || '')) {
      return <FileImageOutlined style={{ color: '#3B82F6', fontSize: 18 }} />;
    }
    if (mime?.includes('spreadsheet') || mime?.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext || '')) {
      return <FileExcelOutlined style={{ color: '#10B981', fontSize: 18 }} />;
    }
    if (mime?.includes('word') || ['doc', 'docx'].includes(ext || '')) {
      return <FileWordOutlined style={{ color: '#2563EB', fontSize: 18 }} />;
    }
    return <FileTextOutlined style={{ color: '#64748B', fontSize: 18 }} />;
  };

  // Restrained Category Tags
  const renderTypeTag = (type?: string) => {
    const upper = (type || 'DOCUMENT').toUpperCase();
    switch (upper) {
      case 'CONTRACT':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0',
            }}
          >
            KONTRAK
          </span>
        );
      case 'SPK':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              backgroundColor: '#F5F3FF',
              color: '#5B21B6',
              border: '1px solid #DDD6FE',
            }}
          >
            SPK
          </span>
        );
      case 'PROPOSAL':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              backgroundColor: '#EFF6FF',
              color: '#1E40AF',
              border: '1px solid #BFDBFE',
            }}
          >
            PROPOSAL
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              backgroundColor: '#F1F5F9',
              color: '#475569',
              border: '1px solid #CBD5E1',
            }}
          >
            {upper}
          </span>
        );
    }
  };

  // Business Reference Formatter
  const renderBusinessReference = (entityType?: string, entityId?: number | string) => {
    if (!entityId) {
      return <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: '12px' }}>Tidak terhubung</span>;
    }
    const type = (entityType || '').toUpperCase();
    if (type === 'PROPOSAL' || type === 'SPK') {
      return <span style={{ color: '#1E293B', fontWeight: 500 }}>Tender #{entityId}</span>;
    }
    if (type === 'CONTRACT') {
      return <span style={{ color: '#1E293B', fontWeight: 500 }}>Kontrak #{entityId}</span>;
    }
    return <span style={{ color: '#1E293B', fontWeight: 500 }}>Ref #{entityId}</span>;
  };

  // Byte Size Formatter
  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null || bytes <= 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Indonesian Date Formatter
  const formatIndonesianDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';

      const datePart = d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const timePart = d
        .toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        .replace('.', ':');

      return `${datePart} · ${timePart}`;
    } catch {
      return '-';
    }
  };

  // Paged items for mobile cards
  const pagedDocuments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDocuments.slice(start, start + pageSize);
  }, [filteredDocuments, currentPage, pageSize]);

  const columns = useMemo(
    () => [
      {
        title: 'NAMA DOKUMEN',
        dataIndex: 'fileName',
        key: 'fileName',
        render: (_: any, record: DocumentRecord) => (
          <div className={styles.docNameCell}>
            <div className={styles.docIcon}>
              {getFileIcon(record.fileName, record.mimeType)}
            </div>
            <div className={styles.docNameMeta}>
              <Tooltip title={record.fileName || 'Dokumen Tanpa Nama'} placement="topLeft">
                <span className={styles.docFileName}>
                  {record.fileName || 'Dokumen Tanpa Nama'}
                </span>
              </Tooltip>
              <span className={styles.docSubId}>Doc ID: #{record.id}</span>
            </div>
          </div>
        ),
      },
      {
        title: 'TIPE DOKUMEN',
        dataIndex: 'entityType',
        key: 'entityType',
        width: 140,
        render: (type: string) => renderTypeTag(type),
      },
      {
        title: 'REFERENSI BISNIS',
        dataIndex: 'entityId',
        key: 'entityId',
        width: 160,
        render: (_: any, record: DocumentRecord) =>
          renderBusinessReference(record.entityType, record.entityId),
      },
      {
        title: 'UKURAN BERKAS',
        dataIndex: 'fileSize',
        key: 'fileSize',
        width: 120,
        render: (bytes?: number) => (
          <span style={{ color: '#475569', fontSize: '12.5px', fontFamily: 'ui-monospace, monospace' }}>
            {formatFileSize(bytes)}
          </span>
        ),
      },
      {
        title: 'TANGGAL UNGGAH',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 170,
        render: (dateStr?: string) => (
          <span style={{ color: '#475569', fontSize: '12px' }}>
            {formatIndonesianDate(dateStr)}
          </span>
        ),
      },
      {
        title: 'AKSI',
        key: 'action',
        width: 180,
        align: 'right' as const,
        render: (_: any, record: DocumentRecord) => (
          <div className={styles.actionGroup} style={{ justifyContent: 'flex-end' }}>
            <Button
              className={styles.btnActionPreview}
              icon={<EyeOutlined style={{ fontSize: 12 }} />}
              onClick={() => handlePreview(record)}
            >
              Pratinjau
            </Button>
            <Button
              className={styles.btnActionDownload}
              icon={<DownloadOutlined style={{ fontSize: 12 }} />}
              onClick={() => handleDownload(record)}
            >
              Unduh
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const isFiltering = searchText.trim() !== '' || selectedType !== 'ALL';

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DIRECTOR', 'LEGAL', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS']}>
      <div className={styles.pageContainer} style={{ padding: '24px', minHeight: 'calc(100vh - 64px)' }}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div className={styles.headerLeft}>
            <Breadcrumb
              className={styles.breadcrumb}
              items={[{ title: 'Data Master' }, { title: 'Documents' }]}
            />
            <div className={styles.titleRow}>
              <div className={styles.headerIconSurface}>
                <FolderOpenOutlined />
              </div>
              <div>
                <Title level={4} className={styles.pageTitle}>
                  Document Repository
                </Title>
                <Text className={styles.pageSubtitle}>
                  Repositori terpusat dokumen bisnis EPMS.
                </Text>
              </div>
            </div>
          </div>

          <div className={styles.headerRight}>
            <Button
              className={styles.btnRefresh}
              icon={<ReloadOutlined />}
              onClick={() => fetchDocuments()}
              loading={loading}
            >
              Segarkan
            </Button>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className={styles.toolbarCard}>
          <div className={styles.toolbarContent}>
            <div className={styles.toolbarFilters}>
              <Input
                placeholder="Cari nama dokumen atau ID..."
                prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
                value={searchText}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={styles.searchInput}
                allowClear
              />

              <Select
                value={selectedType}
                onChange={handleTypeChange}
                className={styles.typeSelect}
              >
                <Option value="ALL">Semua Tipe Dokumen</Option>
                <Option value="CONTRACT">CONTRACT</Option>
                <Option value="SPK">SPK</Option>
                <Option value="PROPOSAL">PROPOSAL</Option>
              </Select>

              {isFiltering && (
                <Button
                  type="text"
                  icon={<ClearOutlined />}
                  onClick={handleResetFilters}
                  className={styles.btnReset}
                >
                  Reset Filter
                </Button>
              )}
            </div>

            <div className={styles.toolbarStats}>
              Menampilkan <strong>{filteredDocuments.length}</strong> dari <strong>{safeDocuments.length}</strong> dokumen
            </div>
          </div>
        </div>

        {/* Error Alert if query fails */}
        {isError && (
          <Alert
            type="error"
            message="Gagal Memuat Repositori Dokumen"
            description={
              (error as any)?.response?.data?.message ||
              (error as any)?.message ||
              'Terjadi kesalahan saat memuat dokumen.'
            }
            showIcon
            action={
              <Button size="small" type="primary" danger onClick={() => fetchDocuments()}>
                Coba Lagi
              </Button>
            }
            style={{ borderRadius: 8 }}
          />
        )}

        {/* Desktop / Tablet Table View */}
        <div className={styles.desktopTableView}>
          <div className={styles.tableCard}>
            <Table
              className={styles.documentTable}
              dataSource={filteredDocuments}
              columns={columns}
              rowKey="id"
              loading={loading}
              locale={{
                emptyText: (
                  <div style={{ padding: '32px 0' }}>
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="Tidak ada dokumen yang sesuai dengan pencarian atau filter."
                    />
                  </div>
                ),
              }}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: filteredDocuments.length,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
                onChange: (page, size) => {
                  setCurrentPage(page);
                  setPageSize(size);
                },
                showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} dokumen`,
              }}
              scroll={{ x: 800 }}
            />
          </div>
        </div>

        {/* Mobile Document Cards View (<= 768px) */}
        <div className={styles.mobileCardsView}>
          {loading ? (
            <Card className={styles.tableCard} style={{ padding: '40px 0', textAlign: 'center' }}>
              <Spin tip="Memuat dokumen..." />
            </Card>
          ) : filteredDocuments.length === 0 ? (
            <Card className={styles.tableCard} style={{ padding: '32px 16px', textAlign: 'center' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Tidak ada dokumen yang sesuai dengan pencarian atau filter."
              />
            </Card>
          ) : (
            <>
              {pagedDocuments.map((doc) => (
                <div key={doc.id} className={styles.mobileDocCard}>
                  <div className={styles.mobileCardTop}>
                    <div className={styles.mobileDocHeader}>
                      {getFileIcon(doc.fileName, doc.mimeType)}
                      <div className={styles.mobileDocTitleGroup}>
                        <span className={styles.mobileDocTitle}>
                          {doc.fileName || 'Dokumen Tanpa Nama'}
                        </span>
                        <span className={styles.mobileDocId}>Doc ID: #{doc.id}</span>
                      </div>
                    </div>
                    <div>{renderTypeTag(doc.entityType)}</div>
                  </div>

                  <div className={styles.mobileCardGrid}>
                    <div className={styles.mobileGridItem}>
                      <span className={styles.mobileLabel}>Referensi Bisnis</span>
                      <span className={styles.mobileValue}>
                        {renderBusinessReference(doc.entityType, doc.entityId)}
                      </span>
                    </div>

                    <div className={styles.mobileGridItem}>
                      <span className={styles.mobileLabel}>Ukuran Berkas</span>
                      <span className={styles.mobileValue} style={{ fontFamily: 'ui-monospace, monospace' }}>
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </div>

                    <div className={styles.mobileGridItemFull}>
                      <span className={styles.mobileLabel}>Diunggah Pada</span>
                      <span className={styles.mobileValue}>
                        {formatIndonesianDate(doc.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.mobileCardFooter}>
                    <Button
                      className={styles.btnActionPreview}
                      icon={<EyeOutlined style={{ fontSize: 12 }} />}
                      onClick={() => handlePreview(doc)}
                    >
                      Pratinjau
                    </Button>
                    <Button
                      className={styles.btnActionDownload}
                      icon={<DownloadOutlined style={{ fontSize: 12 }} />}
                      onClick={() => handleDownload(doc)}
                    >
                      Unduh
                    </Button>
                  </div>
                </div>
              ))}

              <div className={styles.mobilePagination}>
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={filteredDocuments.length}
                  onChange={(page) => setCurrentPage(page)}
                  simple
                />
              </div>
            </>
          )}
        </div>

        {/* Modal Preview PDF */}
        {previewVisible && (
          <Modal
            title={`Pratinjau Dokumen — ${previewDoc?.fileName || ''}`}
            open={previewVisible}
            onCancel={handleClosePreview}
            footer={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Button
                  key="download"
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => previewDoc && handleDownload(previewDoc)}
                  style={{ backgroundColor: '#2563EB', borderRadius: 6 }}
                >
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
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  flex: '1 1 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Spin size="large" tip="Memuat dokumen dari secure endpoint..." />
              </div>
            ) : previewError ? (
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  flex: '1 1 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Alert type="error" message={previewError} showIcon />
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
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  flex: '1 1 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text type="secondary">File dokumen tidak dapat dimuat.</Text>
              </div>
            )}
          </Modal>
        )}
      </div>
    </ProtectedRoute>
  );
}
