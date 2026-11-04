"use client";

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Drawer,
  Card,
  Row,
  Col,
  Typography,
  Tooltip,
  Empty,
  Skeleton,
  Spin,
  Alert,
  Divider,
  Modal,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
  ArrowRightOutlined,
  ProjectOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  EnvironmentOutlined,
  FilePdfOutlined,
  UserOutlined,
  FileTextOutlined,
  DollarCircleOutlined,
  CalendarOutlined,
  ClearOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  DownloadOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { streamSecureContractSpk, downloadSecureContractSpk } from '@/lib/fileDelivery';
import { useAuth } from '@/context/AuthContext';
import ProjectService, {
  ProjectMasterItem,
  ProjectMasterResponse,
  ProjectMasterDetail,
} from '@/services/project.service';

const { Title, Text, Paragraph } = Typography;

// Currency Formatter (IDR)
const formatIDR = (val?: number | null) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
};

// Date Formatter (DD MMM YYYY)
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

// Semantic Status Badge Renderer
const renderStatusBadge = (status: string) => {
  switch (status) {
    case 'PLANNING':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            background: '#EFF6FF',
            color: '#1D4ED8',
            border: '1px solid #BFDBFE',
          }}
        >
          <ClockCircleOutlined style={{ fontSize: '11px' }} />
          Planning
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            background: '#ECFDF5',
            color: '#047857',
            border: '1px solid #A7F3D0',
          }}
        >
          <SyncOutlined spin style={{ fontSize: '11px' }} />
          In Progress
        </span>
      );
    case 'COMPLETED':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            background: '#F5F3FF',
            color: '#6D28D9',
            border: '1px solid #DDD6FE',
          }}
        >
          <CheckCircleOutlined style={{ fontSize: '11px' }} />
          Completed
        </span>
      );
    default:
      return (
        <Tag style={{ borderRadius: '9999px', padding: '2px 8px' }}>
          {status}
        </Tag>
      );
  }
};

export const ProjectMasterPage: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();

  const userRolesUpper = useMemo(() => (user?.roles || []).map((r: string) => String(r).toUpperCase()), [user]);
  const canAccessProjectDelivery = useMemo(() => {
    return userRolesUpper.some((r: string) =>
      ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'DIRECTOR', 'PMO', 'PROJECT_MANAGER'].includes(r)
    );
  }, [userRolesUpper]);
  const isProcurementUser = useMemo(() => {
    return userRolesUpper.some((r: string) => ['PROCUREMENT', 'PURCHASING'].includes(r));
  }, [userRolesUpper]);

  // Filters State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<number | undefined>(undefined);
  const [selectedPm, setSelectedPm] = useState<number | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);

  // Drawer State
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Fetch Master Directory
  const {
    data: masterData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<ProjectMasterResponse>({
    queryKey: ['projects', 'master', { searchTerm, selectedCustomer, selectedPm, selectedStatus }],
    queryFn: () =>
      ProjectService.getProjectMaster({
        search: searchTerm || undefined,
        customerId: selectedCustomer,
        managerId: selectedPm,
        status: selectedStatus,
      }),
    staleTime: 30000,
  });

  // Fetch Single Detail for Drawer on demand
  const {
    data: projectDetail,
    isLoading: isDetailLoading,
    isError: isDetailError,
  } = useQuery<ProjectMasterDetail>({
    queryKey: ['projects', 'detail', selectedProjectId],
    queryFn: () => ProjectService.getProjectMasterDetail(selectedProjectId!),
    enabled: !!selectedProjectId && drawerOpen,
    staleTime: 60000,
  });

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCustomer(undefined);
    setSelectedPm(undefined);
    setSelectedStatus(undefined);
    setCurrentPage(1);
  };

  const isFilterActive = !!(searchTerm || selectedCustomer || selectedPm || selectedStatus);

  // Open Drawer
  const handleOpenDetail = (projectId: number) => {
    setSelectedProjectId(projectId);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
  };

  // SPK PDF Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewContractId, setPreviewContractId] = useState<number | null>(null);
  const [previewContractNumber, setPreviewContractNumber] = useState<string | null>(null);

  const handleClosePreview = () => {
    setPreviewModalOpen(false);
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewError(null);
    setPreviewContractId(null);
    setPreviewContractNumber(null);
  };

  const handlePreviewSpk = async (contractId?: number | null, contractNumber?: string | null) => {
    if (!contractId) {
      message.warning('ID kontrak tidak ditemukan untuk pratinjau dokumen.');
      return;
    }

    setPreviewContractId(contractId);
    setPreviewContractNumber(contractNumber || `CONT-${contractId}`);
    setPreviewModalOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);

    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }

    try {
      const { objectUrl } = await streamSecureContractSpk(contractId);
      setPreviewBlobUrl(objectUrl);
    } catch (err: any) {
      console.error('Failed to stream contract SPK:', err);
      const status = err?.response?.status;
      if (status === 403) {
        setPreviewError('Akses ditolak: Anda tidak memiliki izin untuk mengakses dokumen kontrak ini.');
      } else if (status === 404) {
        setPreviewError('Dokumen fisik SPK tidak ditemukan di server.');
      } else if (status === 401) {
        setPreviewError('Sesi Anda telah kedaluwarsa. Silakan masuk kembali.');
      } else {
        setPreviewError('Gagal memuat pratinjau dokumen SPK dari server.');
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadSpk = async () => {
    if (!previewContractId) return;
    try {
      const fileName = `SPK-${previewContractNumber || previewContractId}.pdf`;
      message.loading({ content: `Mengunduh berkas ${fileName}...`, key: 'spk-download' });
      await downloadSecureContractSpk(previewContractId, fileName);
      message.success({ content: `Berkas ${fileName} berhasil diunduh.`, key: 'spk-download' });
    } catch (err: any) {
      console.error('Failed to download contract SPK:', err);
      const status = err?.response?.status;
      if (status === 403) {
        message.error({ content: 'Akses ditolak: Anda tidak memiliki izin mengunduh dokumen ini.', key: 'spk-download' });
      } else if (status === 404) {
        message.error({ content: 'Dokumen SPK tidak ditemukan di server.', key: 'spk-download' });
      } else {
        message.error({ content: 'Gagal mengunduh dokumen SPK.', key: 'spk-download' });
      }
    }
  };

  // Navigate to Project Delivery Deep-Link (gated by access)
  const handleGoToDelivery = (projectId: number) => {
    if (!canAccessProjectDelivery) {
      message.warning('Anda tidak memiliki otorisasi untuk mengakses Project Delivery.');
      return;
    }
    router.push(`/project-delivery?projectId=${projectId}`);
  };

  // Table Columns Definition
  const columns: ColumnsType<ProjectMasterItem> = [
    {
      title: 'PROJECT',
      dataIndex: 'code',
      key: 'code',
      width: 280,
      render: (_: any, record: ProjectMasterItem) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text
              strong
              style={{
                fontSize: '13px',
                color: '#0F172A',
                letterSpacing: '0.2px',
                fontFamily: 'monospace',
              }}
            >
              {record.code}
            </Text>
          </div>
          <Text
            style={{
              fontSize: '13px',
              color: '#334155',
              fontWeight: 500,
              lineHeight: 1.3,
            }}
          >
            {record.name}
          </Text>
          {record.city ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '11px',
                color: '#64748B',
              }}
            >
              <EnvironmentOutlined style={{ fontSize: '11px', color: '#94A3B8' }} />
              {record.city}
            </span>
          ) : (
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>-</span>
          )}
        </div>
      ),
    },
    {
      title: 'CUSTOMER',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 220,
      render: (customerName: string | null) => (
        <Text style={{ fontSize: '13px', color: customerName ? '#1E293B' : '#94A3B8', fontWeight: 500 }}>
          {customerName ?? '-'}
        </Text>
      ),
    },
    {
      title: 'PROJECT MANAGER',
      dataIndex: 'managerName',
      key: 'managerName',
      width: 200,
      render: (managerName: string | null, record: ProjectMasterItem) => {
        if (!managerName) {
          return (
            <span style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
              Belum ditugaskan
            </span>
          );
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#E0F2FE',
                color: '#0284C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              <UserOutlined />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text strong style={{ fontSize: '12px', color: '#1E293B' }}>
                {managerName}
              </Text>
              {record.managerEmail && (
                <Text style={{ fontSize: '11px', color: '#64748B' }}>
                  {record.managerEmail}
                </Text>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'KONTRAK / SPK',
      dataIndex: 'contractNumber',
      key: 'contractNumber',
      width: 220,
      render: (_: any, record: ProjectMasterItem) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Text style={{ fontSize: '12px', color: record.contractNumber ? '#334155' : '#94A3B8', fontWeight: 500 }}>
            {record.contractNumber ?? '-'}
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {record.contractValue ? (
              <span style={{ fontSize: '11px', color: '#0F766E', fontWeight: 600 }}>
                {formatIDR(record.contractValue)}
              </span>
            ) : null}
            {record.spkFileUrl && (
              <Tooltip title="Klik untuk melihat pratinjau dokumen SPK">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreviewSpk(record.contractId, record.contractNumber);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: '11px',
                    color: '#DC2626',
                    background: '#FEF2F2',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: '1px solid #FECACA',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'none',
                    lineHeight: '14px',
                  }}
                >
                  <FilePdfOutlined style={{ fontSize: '10px' }} />
                  SPK
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => renderStatusBadge(status),
    },
    {
      title: 'TIMELINE',
      key: 'timeline',
      width: 180,
      render: (_: any, record: ProjectMasterItem) => {
        if (!record.startDate && !record.endDate) {
          return <span style={{ fontSize: '12px', color: '#94A3B8' }}>-</span>;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '12px', color: '#475569' }}>
            <span>{formatDate(record.startDate)}</span>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>s/d {formatDate(record.endDate)}</span>
          </div>
        );
      },
    },
    {
      title: 'AKSI',
      key: 'action',
      width: 130,
      fixed: 'right',
      render: (_: any, record: ProjectMasterItem) => (
        <Button
          type="default"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleOpenDetail(record.id)}
          style={{
            fontSize: '12px',
            borderColor: '#CBD5E1',
            color: '#1E293B',
            fontWeight: 500,
            borderRadius: '6px',
          }}
        >
          Lihat Detail
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#F8FAFC', minHeight: '100vh' }}>
      {/* 1. Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <Title
            level={3}
            style={{
              margin: 0,
              color: '#0F172A',
              fontWeight: 700,
              letterSpacing: '-0.5px',
            }}
          >
            Project Master
          </Title>
          <Text style={{ fontSize: '14px', color: '#64748B' }}>
            Direktori seluruh project yang terbentuk dari lifecycle EPMS
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined spin={isFetching} />}
          onClick={() => refetch()}
          style={{
            borderRadius: '8px',
            fontWeight: 500,
            color: '#334155',
            borderColor: '#CBD5E1',
          }}
        >
          Segarkan
        </Button>
      </div>

      {/* 2. Summary Cards (Live Data Only) */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8}>
          <Card
            bordered={false}
            style={{
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              background: '#FFFFFF',
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Text style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
                  Total Project
                </Text>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                  {isLoading ? <Spin size="small" /> : (masterData?.summary?.totalProjects ?? 0)}
                </div>
                <Text style={{ fontSize: '12px', color: '#94A3B8' }}>
                  Portofolio Resmi EPMS
                </Text>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  background: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                }}
              >
                <ProjectOutlined />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card
            bordered={false}
            style={{
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              background: '#FFFFFF',
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Text style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
                  Planning
                </Text>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#1D4ED8', marginTop: '4px' }}>
                  {isLoading ? <Spin size="small" /> : (masterData?.summary?.planningCount ?? 0)}
                </div>
                <Text style={{ fontSize: '12px', color: '#94A3B8' }}>
                  Dalam Persiapan Operasional
                </Text>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  background: '#EEF2FF',
                  color: '#4F46E5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                }}
              >
                <ClockCircleOutlined />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card
            bordered={false}
            style={{
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              background: '#FFFFFF',
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Text style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
                  In Progress
                </Text>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#047857', marginTop: '4px' }}>
                  {isLoading ? <Spin size="small" /> : (masterData?.summary?.inProgressCount ?? 0)}
                </div>
                <Text style={{ fontSize: '12px', color: '#94A3B8' }}>
                  Eksekusi Delivery Lapangan
                </Text>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  background: '#ECFDF5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                }}
              >
                <SyncOutlined />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 3. Filter Bar */}
      <Card
        bordered={false}
        style={{
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          background: '#FFFFFF',
          marginBottom: '16px',
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={8} md={7}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
              placeholder="Cari kode, nama project, customer..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              allowClear
              style={{ borderRadius: '8px' }}
            />
          </Col>

          <Col xs={24} sm={8} md={6}>
            <Select
              placeholder="Semua Customer"
              value={selectedCustomer}
              onChange={(val) => {
                setSelectedCustomer(val);
                setCurrentPage(1);
              }}
              allowClear
              style={{ width: '100%', borderRadius: '8px' }}
              options={masterData?.filters?.customers?.map((c) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Col>

          <Col xs={24} sm={8} md={5}>
            <Select
              placeholder="Semua Project Manager"
              value={selectedPm}
              onChange={(val) => {
                setSelectedPm(val);
                setCurrentPage(1);
              }}
              allowClear
              style={{ width: '100%', borderRadius: '8px' }}
              options={masterData?.filters?.projectManagers?.map((pm) => ({
                label: pm.name,
                value: pm.id,
              }))}
            />
          </Col>

          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="Semua Status"
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
              allowClear
              style={{ width: '100%', borderRadius: '8px' }}
              options={[
                { label: 'Planning', value: 'PLANNING' },
                { label: 'In Progress', value: 'IN_PROGRESS' },
              ]}
            />
          </Col>

          {isFilterActive && (
            <Col xs={24} sm={6} md={2}>
              <Button
                type="link"
                icon={<ClearOutlined />}
                onClick={handleResetFilters}
                style={{ padding: 0, fontSize: '13px', color: '#64748B' }}
              >
                Reset
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {/* 4. Error State */}
      {isError && (
        <Alert
          message="Gagal Memuat Data Project Master"
          description={error instanceof Error ? error.message : 'Terjadi kendala jaringan saat memuat direktori project.'}
          type="error"
          showIcon
          action={
            <Button size="small" danger onClick={() => refetch()}>
              Coba Lagi
            </Button>
          }
          style={{ marginBottom: '16px', borderRadius: '8px' }}
        />
      )}

      {/* 5. Primary Project Directory Table */}
      <style dangerouslySetInnerHTML={{ __html: `
        .project-master-table .ant-table-thead > tr > th,
        .project-master-table .ant-table-thead > tr > td {
          background-color: #F8FAFC !important;
          color: #475569 !important;
          border-bottom: 1px solid #E2E8F0 !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          letter-spacing: 0.5px !important;
        }
        .project-master-table .ant-table-thead > tr > th::before {
          background-color: #E2E8F0 !important;
        }
        .project-master-table .ant-table-tbody > tr:hover > td {
          background-color: #F1F5F9 !important;
        }
      `}} />
      <Card
        bordered={false}
        style={{
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          background: '#FFFFFF',
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table<ProjectMasterItem>
          className="project-master-table"
          columns={columns}
          dataSource={masterData?.items || []}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1100 }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: masterData?.items?.length || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
            showTotal: (total, range) => (
              <span style={{ fontSize: '13px', color: '#64748B' }}>
                Menampilkan {range[0]}-{range[1]} dari {total} project
              </span>
            ),
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: '#64748B' }}>
                    {isFilterActive
                      ? 'Tidak ada project yang sesuai dengan filter.'
                      : 'Belum ada project terdaftar dalam sistem.'}
                  </span>
                }
              >
                {isFilterActive && (
                  <Button type="primary" size="small" onClick={handleResetFilters}>
                    Hapus Filter
                  </Button>
                )}
              </Empty>
            ),
          }}
          rowClassName={() => 'project-master-row'}
          style={{
            borderRadius: '12px',
          }}
        />
      </Card>

      {/* 6. Project Detail Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong style={{ fontSize: '16px', color: '#0F172A' }}>
                {projectDetail?.name || 'Detail Project'}
              </Text>
              {projectDetail?.status && renderStatusBadge(projectDetail.status)}
            </div>
            {projectDetail?.code && (
              <Text style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
                {projectDetail.code}
              </Text>
            )}
          </div>
        }
        placement="right"
        width={560}
        onClose={handleCloseDrawer}
        open={drawerOpen}
        bodyStyle={{ padding: '24px', background: '#F8FAFC' }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px' }}>
            <Button onClick={handleCloseDrawer} style={{ borderRadius: '6px' }}>
              Tutup
            </Button>
            {projectDetail?.id && canAccessProjectDelivery && (
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                onClick={() => handleGoToDelivery(projectDetail.id)}
                style={{
                  borderRadius: '6px',
                  background: '#2563EB',
                  borderColor: '#2563EB',
                  fontWeight: 600,
                }}
              >
                Buka Project Delivery
              </Button>
            )}
            {projectDetail?.id && !canAccessProjectDelivery && isProcurementUser && (
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                onClick={() => router.push('/procurement')}
                style={{
                  borderRadius: '6px',
                  background: '#0F766E',
                  borderColor: '#0F766E',
                  fontWeight: 600,
                }}
              >
                Buka Procurement Hub
              </Button>
            )}
          </div>
        }
      >
        {isDetailLoading ? (
          <div style={{ padding: '20px' }}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </div>
        ) : isDetailError || !projectDetail ? (
          <Alert
            message="Gagal Memuat Detail Project"
            description="Data detail project tidak dapat dimuat."
            type="error"
            showIcon
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Section A: Identitas Project */}
            <Card
              bordered={false}
              size="small"
              style={{
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
              }}
              title={
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  <ProjectOutlined style={{ marginRight: 6, color: '#2563EB' }} />
                  IDENTITAS PROJECT
                </span>
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', fontSize: '13px' }}>
                <Text style={{ color: '#64748B' }}>Kode Project:</Text>
                <Text strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{projectDetail.code}</Text>

                <Text style={{ color: '#64748B' }}>Nama Project:</Text>
                <Text style={{ color: '#1E293B', fontWeight: 500 }}>{projectDetail.name}</Text>

                <Text style={{ color: '#64748B' }}>Customer:</Text>
                <Text style={{ color: '#1E293B' }}>{projectDetail.customerName ?? '-'}</Text>

                <Text style={{ color: '#64748B' }}>Lokasi / Site:</Text>
                <Text style={{ color: '#1E293B' }}>
                  {projectDetail.siteName || projectDetail.city || projectDetail.address || '-'}
                </Text>
              </div>
            </Card>

            {/* Section B: Referensi Komersial */}
            <Card
              bordered={false}
              size="small"
              style={{
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
              }}
              title={
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  <FileTextOutlined style={{ marginRight: 6, color: '#059669' }} />
                  REFERENSI KOMERSIAL
                </span>
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', fontSize: '13px' }}>
                <Text style={{ color: '#64748B' }}>Tender / Sumber:</Text>
                <Text style={{ color: '#1E293B' }}>
                  {projectDetail.tenderTitle ? `${projectDetail.tenderTitle} (#${projectDetail.tenderId})` : '-'}
                </Text>

                <Text style={{ color: '#64748B' }}>Nomor Kontrak:</Text>
                <Text style={{ color: '#1E293B', fontWeight: 500 }}>{projectDetail.contractNumber ?? '-'}</Text>

                <Text style={{ color: '#64748B' }}>Nilai Kontrak:</Text>
                <Text strong style={{ color: '#0F766E' }}>
                  {formatIDR(projectDetail.contractValue)}
                </Text>

                <Text style={{ color: '#64748B' }}>Dokumen SPK:</Text>
                {projectDetail.spkFileUrl ? (
                  <Button
                    type="link"
                    icon={<FilePdfOutlined />}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: '#DC2626',
                      fontWeight: 500,
                      padding: 0,
                      height: 'auto',
                      justifyContent: 'flex-start',
                    }}
                    onClick={() => handlePreviewSpk(projectDetail.contractId, projectDetail.contractNumber)}
                  >
                    Pratinjau / Unduh Dokumen SPK
                  </Button>
                ) : (
                  <Text style={{ color: '#94A3B8' }}>Belum tersedia</Text>
                )}
              </div>
            </Card>

            {/* Section C: Kepemilikan & PIC */}
            <Card
              bordered={false}
              size="small"
              style={{
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
              }}
              title={
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  <UserOutlined style={{ marginRight: 6, color: '#D97706' }} />
                  KEPEMILIKAN & PIC
                </span>
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', fontSize: '13px' }}>
                <Text style={{ color: '#64748B' }}>Project Manager:</Text>
                <div>
                  {projectDetail.managerName ? (
                    <div>
                      <Text strong style={{ color: '#0F172A' }}>{projectDetail.managerName}</Text>
                      {projectDetail.managerEmail && (
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{projectDetail.managerEmail}</div>
                      )}
                    </div>
                  ) : (
                    <Text style={{ color: '#94A3B8', fontStyle: 'italic' }}>Belum ditugaskan</Text>
                  )}
                </div>

                <Text style={{ color: '#64748B' }}>Marketing PIC:</Text>
                <div>
                  {projectDetail.marketingPicName ? (
                    <div>
                      <Text style={{ color: '#1E293B', fontWeight: 500 }}>{projectDetail.marketingPicName}</Text>
                      {projectDetail.marketingPicEmail && (
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{projectDetail.marketingPicEmail}</div>
                      )}
                    </div>
                  ) : (
                    <Text style={{ color: '#94A3B8' }}>-</Text>
                  )}
                </div>

                <Text style={{ color: '#64748B' }}>Tata Kelola PMO:</Text>
                <Text style={{ color: '#475569' }}>Pengawasan Portofolio (PMO Governance)</Text>
              </div>
            </Card>

            {/* Section D: Timeline & Jadwal */}
            <Card
              bordered={false}
              size="small"
              style={{
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
              }}
              title={
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  <CalendarOutlined style={{ marginRight: 6, color: '#7C3AED' }} />
                  TIMELINE & JADWAL
                </span>
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', fontSize: '13px' }}>
                <Text style={{ color: '#64748B' }}>Mulai Rencana:</Text>
                <Text style={{ color: '#1E293B' }}>{formatDate(projectDetail.startDate)}</Text>

                <Text style={{ color: '#64748B' }}>Selesai Rencana:</Text>
                <Text style={{ color: '#1E293B' }}>{formatDate(projectDetail.endDate)}</Text>

                <Text style={{ color: '#64748B' }}>Kickoff Lapangan:</Text>
                <Text style={{ color: '#1E293B' }}>
                  {projectDetail.actualKickoffDate
                    ? formatDate(projectDetail.actualKickoffDate)
                    : projectDetail.status === 'IN_PROGRESS'
                    ? 'Sudah Kickoff (Aktif)'
                    : 'Menunggu Kickoff'}
                </Text>

                {canAccessProjectDelivery && (
                  <>
                    <Text style={{ color: '#64748B' }}>Kontrol Jadwal:</Text>
                    <div>
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        icon={<CalendarOutlined />}
                        onClick={() => {
                          router.push(`/project-delivery?tab=berjalan&view=gantt&projectId=${projectDetail.id}`);
                        }}
                        style={{ fontSize: '12px', borderRadius: '6px' }}
                      >
                        Buka Gantt Baseline vs Actual
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Section E: Status Saat Ini & Governance */}
            <Card
              bordered={false}
              size="small"
              style={{
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
              }}
              title={
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  <SafetyCertificateOutlined style={{ marginRight: 6, color: '#2563EB' }} />
                  STATUS SAAT INI & GOVERNANCE
                </span>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', fontSize: '13px' }}>
                  <Text style={{ color: '#64748B' }}>Project Status:</Text>
                  <div>{renderStatusBadge(projectDetail.status)}</div>

                  <Text style={{ color: '#64748B' }}>Legal Status:</Text>
                  <div>
                    {projectDetail.legalStatus ? (
                      <Tag color={projectDetail.legalStatus === 'APPROVED' ? 'green' : 'blue'}>
                        {projectDetail.legalStatus}
                      </Tag>
                    ) : (
                      <Text style={{ color: '#94A3B8' }}>-</Text>
                    )}
                  </div>

                  <Text style={{ color: '#64748B' }}>Kickoff State:</Text>
                  <Text style={{ color: '#1E293B', fontWeight: 500 }}>
                    {projectDetail.status === 'IN_PROGRESS'
                      ? 'Kickoff Selesai (Aktif)'
                      : 'Menunggu Kickoff'}
                  </Text>
                </div>

                {/* 4-Pillar Readiness from Project Delivery */}
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text strong style={{ fontSize: '12px', color: '#475569' }}>
                      Kesiapan Perencanaan (4 Pilar Delivery):
                    </Text>
                    {projectDetail.readiness?.gate?.status && (
                      <Tag color={projectDetail.readiness.gate.status === 'READY_FOR_KICKOFF' ? 'green' : 'orange'}>
                        {projectDetail.readiness.gate.status}
                      </Tag>
                    )}
                  </div>

                  {projectDetail.readiness?.pillars ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div
                        style={{
                          padding: '8px 10px',
                          background: '#F1F5F9',
                          borderRadius: '6px',
                          fontSize: '11px',
                        }}
                      >
                        <Text strong style={{ color: '#334155' }}>WBS:</Text>{' '}
                        <Tag
                          color={projectDetail.readiness.pillars.wbs?.status === 'READY' ? 'success' : 'default'}
                          style={{ fontSize: '10px', lineHeight: '18px' }}
                        >
                          {projectDetail.readiness.pillars.wbs?.status || 'N/A'}
                        </Tag>
                      </div>

                      <div
                        style={{
                          padding: '8px 10px',
                          background: '#F1F5F9',
                          borderRadius: '6px',
                          fontSize: '11px',
                        }}
                      >
                        <Text strong style={{ color: '#334155' }}>Biaya / RAB:</Text>{' '}
                        <Tag
                          color={projectDetail.readiness.pillars.cost?.status === 'READY' ? 'success' : 'default'}
                          style={{ fontSize: '10px', lineHeight: '18px' }}
                        >
                          {projectDetail.readiness.pillars.cost?.status || 'N/A'}
                        </Tag>
                      </div>

                      <div
                        style={{
                          padding: '8px 10px',
                          background: '#F1F5F9',
                          borderRadius: '6px',
                          fontSize: '11px',
                        }}
                      >
                        <Text strong style={{ color: '#334155' }}>Jadwal:</Text>{' '}
                        <Tag
                          color={projectDetail.readiness.pillars.schedule?.status === 'READY' ? 'success' : 'default'}
                          style={{ fontSize: '10px', lineHeight: '18px' }}
                        >
                          {projectDetail.readiness.pillars.schedule?.status || 'N/A'}
                        </Tag>
                      </div>

                      <div
                        style={{
                          padding: '8px 10px',
                          background: '#F1F5F9',
                          borderRadius: '6px',
                          fontSize: '11px',
                        }}
                      >
                        <Text strong style={{ color: '#334155' }}>Kondisi Awal:</Text>{' '}
                        <Tag
                          color={projectDetail.readiness.pillars.initialCondition?.status === 'READY' ? 'success' : 'default'}
                          style={{ fontSize: '10px', lineHeight: '18px' }}
                        >
                          {projectDetail.readiness.pillars.initialCondition?.status || 'N/A'}
                        </Tag>
                      </div>
                    </div>
                  ) : (
                    <Text style={{ fontSize: '12px', color: '#94A3B8' }}>
                      Data kesiapan 4 pilar belum tersedia atau proyek warisan.
                    </Text>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </Drawer>

      {/* 7. SPK Document Preview Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 24 }}>
            <FilePdfOutlined style={{ color: '#DC2626', fontSize: 18 }} />
            <Text strong style={{ fontSize: '15px', color: '#0F172A' }}>
              Pratinjau Dokumen SPK
            </Text>
            {previewContractNumber && (
              <Tag color="red" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {previewContractNumber}
              </Tag>
            )}
          </div>
        }
        open={previewModalOpen}
        onCancel={handleClosePreview}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '4px 0' }}>
            <Space>
              <Button
                key="download"
                icon={<DownloadOutlined />}
                disabled={!previewBlobUrl || previewLoading}
                onClick={handleDownloadSpk}
                style={{ borderRadius: 6, fontWeight: 500 }}
              >
                Unduh Dokumen
              </Button>
              {previewBlobUrl && (
                <Button
                  key="external"
                  icon={<ExportOutlined />}
                  onClick={() => window.open(previewBlobUrl, '_blank')}
                  style={{ borderRadius: 6 }}
                >
                  Buka di Tab Baru
                </Button>
              )}
            </Space>
            <Button
              key="close"
              type="primary"
              onClick={handleClosePreview}
              style={{ backgroundColor: '#1E293B', borderRadius: 6, fontWeight: 500 }}
            >
              Tutup
            </Button>
          </div>
        }
        width="min(1200px, 94vw)"
        centered
        style={{ top: 20 }}
        styles={{
          content: {
            height: 'min(850px, 88vh)',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            borderRadius: 12,
          },
          header: {
            padding: '16px 24px',
            borderBottom: '1px solid #E2E8F0',
            background: '#FFFFFF',
            margin: 0,
          },
          body: {
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            background: '#F8FAFC',
          },
          footer: {
            padding: '12px 24px',
            borderTop: '1px solid #E2E8F0',
            background: '#FFFFFF',
            margin: 0,
          },
        }}
      >
        {previewLoading ? (
          <div style={{ padding: 60, textAlign: 'center', flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin size="large" />
            <Text style={{ color: '#64748B', fontSize: 13 }}>Memuat dokumen SPK dari secure endpoint...</Text>
          </div>
        ) : previewError ? (
          <div style={{ padding: 48, textAlign: 'center', flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Alert
              type="error"
              showIcon
              message="Gagal Memuat Dokumen SPK"
              description={previewError}
              style={{ maxWidth: 500, textAlign: 'left', borderRadius: 8 }}
            />
          </div>
        ) : previewBlobUrl ? (
          <iframe
            src={previewBlobUrl}
            title="Pratinjau Dokumen SPK"
            width="100%"
            height="100%"
            style={{
              border: 'none',
              width: '100%',
              height: '100%',
              flex: '1 1 auto',
              display: 'block',
            }}
          />
        ) : (
          <div style={{ padding: 60, textAlign: 'center', flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text type="secondary">Dokumen tidak dapat dimuat.</Text>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProjectMasterPage;
