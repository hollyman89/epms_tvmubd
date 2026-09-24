"use client";

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Typography,
  Tooltip,
  Alert,
  Empty,
} from 'antd';
import {
  HistoryOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  ClearOutlined,
  UserOutlined,
  DatabaseOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { AuditService, AuditLogRecord, AuditQueryParams } from '@/services/audit.service';
import { AuditDetailDrawer } from './audit/AuditDetailDrawer';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// Canonical audit entities from backend audit exploration
const KNOWN_AUDIT_ENTITIES = [
  { value: 'vendors', label: 'Vendors (Master Data Vendor)' },
  { value: 'contracts', label: 'Contracts (Kontrak & Legal)' },
  { value: 'tenders', label: 'Tenders (Marketing / Tender)' },
  { value: 'work_breakdown_structures', label: 'WBS (Work Breakdown Structure)' },
  { value: 'projects', label: 'Projects (Project Governance)' },
  { value: 'workflow_tasks', label: 'Workflow Tasks (Approval Engine)' },
  { value: 'customers', label: 'Customers (Data Customer)' },
  { value: 'user_sessions', label: 'User Sessions (Autentikasi)' },
];

// Canonical audit actions from backend audit exploration
const KNOWN_AUDIT_ACTIONS = [
  { value: 'CREATE', label: 'CREATE' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'SOFT_DELETE', label: 'SOFT_DELETE' },
  { value: 'CONTRACT_APPROVED', label: 'CONTRACT_APPROVED' },
  { value: 'LEGAL_REVIEW_APPROVED', label: 'LEGAL_REVIEW_APPROVED' },
  { value: 'DOCUMENT_TAMPERING_DETECTED', label: 'DOCUMENT_TAMPERING_DETECTED' },
  { value: 'DOCUMENT_VERIFIED_INTACT', label: 'DOCUMENT_VERIFIED_INTACT' },
  { value: 'WBS_TREE_SAVED', label: 'WBS_TREE_SAVED' },
  { value: 'PROJECT_KICKOFF_INITIATED', label: 'PROJECT_KICKOFF_INITIATED' },
  { value: 'CHARTER_KICKOFF_REJECTED', label: 'CHARTER_KICKOFF_REJECTED' },
  { value: 'CHARTER_RESUBMITTED_TO_PM', label: 'CHARTER_RESUBMITTED_TO_PM' },
];

const getActionTagColor = (action?: string) => {
  if (!action) return 'default';
  const upper = action.toUpperCase();
  if (upper === 'CREATE') return 'success';
  if (upper === 'UPDATE') return 'processing';
  if (upper === 'SOFT_DELETE') return 'error';
  if (upper.includes('APPROVED') || upper.includes('VERIFIED')) return 'green';
  if (upper.includes('REJECTED') || upper.includes('TAMPERING')) return 'volcano';
  if (upper.includes('SAVED') || upper.includes('INITIATED')) return 'cyan';
  return 'default';
};

export const AuditTrailPage: React.FC = () => {
  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Filter States
  const [searchInput, setSearchInput] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string | undefined>(undefined);
  const [selectedAction, setSelectedAction] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  // Detail Drawer State
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<AuditLogRecord | null>(null);

  // Construct query parameters
  const queryParams = useMemo<AuditQueryParams>(() => {
    const params: AuditQueryParams = {
      page,
      limit,
    };

    if (appliedSearch) {
      params.search = appliedSearch;
    }
    if (selectedEntity) {
      params.tableName = selectedEntity;
    }
    if (selectedAction) {
      params.action = selectedAction;
    }
    if (dateRange && dateRange[0] && dateRange[1]) {
      params.dateFrom = dateRange[0].format('YYYY-MM-DD');
      params.dateTo = dateRange[1].format('YYYY-MM-DD');
    }

    return params;
  }, [page, limit, appliedSearch, selectedEntity, selectedAction, dateRange]);

  // React Query Fetcher
  const {
    data: auditData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => AuditService.getAuditLogs(queryParams),
    staleTime: 30000,
  });

  // Handlers for filters (resets page to 1)
  const handleSearch = () => {
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setSelectedEntity(undefined);
    setSelectedAction(undefined);
    setDateRange(null);
    setPage(1);
  };

  const handleOpenDetail = (record: AuditLogRecord) => {
    setSelectedRecord(record);
    setDrawerOpen(true);
  };

  const handleCloseDetail = () => {
    setDrawerOpen(false);
    setSelectedRecord(null);
  };

  // Table Columns Definition
  const columns = [
    {
      title: 'Waktu Server',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 190,
      render: (dateStr: string) => {
        const d = dayjs(dateStr);
        return (
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 13 }}>
              {d.format('DD MMM YYYY')}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {d.format('HH:mm:ss')} WIB
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Aktor / Pelaku',
      dataIndex: 'actor',
      key: 'actor',
      width: 220,
      render: (_: any, record: AuditLogRecord) => {
        if (record.created_by === 0 || !record.created_by) {
          return (
            <Space>
              <Tag color="gold" style={{ fontWeight: 600 }}>
                SISTEM
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Otomatis
              </Text>
            </Space>
          );
        }
        return (
          <Space direction="vertical" size={1}>
            <Space size={4}>
              <UserOutlined style={{ color: '#1677ff', fontSize: 12 }} />
              <Text strong style={{ fontSize: 13 }}>
                {record.actor?.full_name || `User #${record.created_by}`}
              </Text>
            </Space>
            {record.actor?.email && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.actor.email}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Modul / Entitas',
      dataIndex: 'table_name',
      key: 'table_name',
      width: 170,
      render: (tableName: string) => (
        <Space>
          <DatabaseOutlined style={{ color: '#8c8c8c' }} />
          <Tag color="blue" style={{ fontFamily: 'monospace', fontWeight: 500 }}>
            {tableName}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Aksi',
      dataIndex: 'action',
      key: 'action',
      width: 180,
      render: (action: string) => (
        <Tag color={getActionTagColor(action)} style={{ fontWeight: 600 }}>
          {action}
        </Tag>
      ),
    },
    {
      title: 'Record ID',
      dataIndex: 'record_id',
      key: 'record_id',
      width: 110,
      render: (recId: number) => (
        <Text code strong>
          #{recId}
        </Text>
      ),
    },
    {
      title: 'Detail',
      key: 'action_detail',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: AuditLogRecord) => (
        <Tooltip title="Lihat detail snapshot data (Before vs After)">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetail(record)}
          >
            Lihat
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Page Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space direction="vertical" size={2}>
            <Space align="center">
              <HistoryOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
                Audit Trail
              </Title>
              <Tag color="blue" style={{ marginLeft: 8 }}>
                SUPER_ADMIN ONLY
              </Tag>
            </Space>
            <Text type="secondary">
              Riwayat aktivitas sistem yang tercatat secara permanen dan append-only.
            </Text>
          </Space>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined spin={isLoading} />}
            onClick={() => refetch()}
            loading={isLoading}
          >
            Muat Ulang
          </Button>
        </Col>
      </Row>

      {/* Error Alert */}
      {isError && (
        <Alert
          message="Gagal Memuat Data Audit Trail"
          description={
            (error as any)?.response?.data?.message ||
            (error as any)?.message ||
            'Terjadi kesalahan saat menghubungi server backend.'
          }
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={() => refetch()}>
              Coba Lagi
            </Button>
          }
          style={{ marginBottom: 20 }}
        />
      )}

      {/* Filter Card */}
      <Card
        size="small"
        style={{
          marginBottom: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <Row gutter={[16, 16]} align="middle">
          {/* Search */}
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Cari entitas, aksi, atau ID..."
              prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>

          {/* Date Range Picker */}
          <Col xs={24} sm={12} md={7}>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={(dates) => {
                setDateRange(dates as [Dayjs | null, Dayjs | null]);
                setPage(1);
              }}
              placeholder={['Mulai Tanggal', 'Sampai Tanggal']}
            />
          </Col>

          {/* Entity / Table Name */}
          <Col xs={24} sm={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Pilih Modul / Entitas"
              value={selectedEntity}
              onChange={(val) => {
                setSelectedEntity(val);
                setPage(1);
              }}
              allowClear
            >
              {KNOWN_AUDIT_ENTITIES.map((ent) => (
                <Option key={ent.value} value={ent.value}>
                  {ent.label}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Action */}
          <Col xs={24} sm={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Pilih Aksi"
              value={selectedAction}
              onChange={(val) => {
                setSelectedAction(val);
                setPage(1);
              }}
              allowClear
            >
              {KNOWN_AUDIT_ACTIONS.map((act) => (
                <Option key={act.value} value={act.value}>
                  {act.label}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Actions: Search & Reset */}
          <Col xs={24} sm={12} md={2}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                Cari
              </Button>
              <Tooltip title="Reset semua filter">
                <Button icon={<ClearOutlined />} onClick={handleResetFilters} />
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Main Table Card */}
      <Card
        style={{
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
        bodyStyle={{ padding: '16px' }}
      >
        <Table<AuditLogRecord>
          columns={columns}
          dataSource={auditData?.data || []}
          rowKey="id"
          loading={isLoading}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Tidak ada aktivitas audit yang ditemukan."
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize: limit,
            total: auditData?.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (totalCount, range) =>
              `Menampilkan ${range[0]}–${range[1]} dari ${totalCount} aktivitas audit`,
            onChange: (newPage, newPageSize) => {
              setPage(newPage);
              setLimit(newPageSize);
            },
          }}
          size="middle"
        />
      </Card>

      {/* Detail Drawer */}
      <AuditDetailDrawer
        open={drawerOpen}
        record={selectedRecord}
        onClose={handleCloseDetail}
      />
    </div>
  );
};

export default AuditTrailPage;
