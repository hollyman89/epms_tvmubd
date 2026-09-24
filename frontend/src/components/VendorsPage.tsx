"use client";

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Modal,
  Drawer,
  Descriptions,
  message,
  Card,
  Row,
  Col,
  Typography,
  Tooltip,
  Form,
  Popconfirm,
  Badge,
} from 'antd';
import {
  ShopOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  EnvironmentOutlined,
  BankOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/context/AuthContext';
import {
  ProcurementService,
  MasterVendor,
  CreateVendorPayload,
  UpdateVendorPayload,
} from '@/services/procurement.service';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const VENDOR_TYPES = [
  'Hardware',
  'Software',
  'Construction',
  'Logistics',
  'General',
  'Services',
  'Other',
];

const getVendorTypeColor = (type?: string) => {
  switch ((type || '').toLowerCase()) {
    case 'hardware':
      return 'blue';
    case 'software':
      return 'cyan';
    case 'construction':
      return 'orange';
    case 'logistics':
      return 'purple';
    case 'services':
      return 'geekblue';
    case 'general':
      return 'gold';
    default:
      return 'default';
  }
};

export const VendorsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // RBAC permissions
  const userRoles = useMemo(
    () => (user?.roles || []).map((r: string) => String(r).toUpperCase()),
    [user]
  );
  const canMutate = useMemo(
    () =>
      userRoles.some((r: string) =>
        ['SUPER_ADMIN', 'ADMIN', 'PROCUREMENT', 'PURCHASING'].includes(r)
      ),
    [userRoles]
  );

  // Filter & Pagination states
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [vendorTypeFilter, setVendorTypeFilter] = useState<string | undefined>(undefined);

  // Modals & Drawer states
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<MasterVendor | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createForm] = Form.useForm<CreateVendorPayload>();
  const [editForm] = Form.useForm<UpdateVendorPayload>();

  // Fetch vendors via server-side pagination & filter
  const {
    data: queryData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['vendors', pagination.current, pagination.pageSize, searchTerm, vendorTypeFilter],
    queryFn: async () => {
      const result = await ProcurementService.getVendorsPaginated({
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchTerm || undefined,
        vendorType: vendorTypeFilter || undefined,
      });
      return result;
    },
    staleTime: 60 * 1000,
  });

  const vendors = queryData?.data || [];
  const totalVendors = queryData?.total || 0;

  // Handlers
  const handleSearch = (value: string) => {
    setSearchTerm(value.trim());
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setVendorTypeFilter(undefined);
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleOpenDetail = (vendor: MasterVendor) => {
    setSelectedVendor(vendor);
    setIsDetailDrawerOpen(true);
  };

  const handleOpenEdit = (vendor: MasterVendor) => {
    setSelectedVendor(vendor);
    editForm.setFieldsValue({
      name: vendor.name,
      address: vendor.address,
      taxId: vendor.taxId,
      vendorType: vendor.vendorType,
    });
    setIsEditModalOpen(true);
  };

  // Submit Create Vendor
  const handleCreateSubmit = async (values: CreateVendorPayload) => {
    setIsSubmitting(true);
    try {
      const createdVendor = await ProcurementService.createVendor({
        name: values.name.trim(),
        address: values.address?.trim() || undefined,
        taxId: values.taxId?.trim() || undefined,
        vendorType: values.vendorType?.trim() || undefined,
      });

      message.success(
        `Vendor ${createdVendor.name} berhasil dibuat dengan kode ${createdVendor.code}.`
      );
      createForm.resetFields();
      setIsCreateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Gagal mendaftarkan vendor baru. Silakan coba kembali.';
      message.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Update Vendor
  const handleEditSubmit = async (values: UpdateVendorPayload) => {
    if (!selectedVendor) return;
    setIsSubmitting(true);
    try {
      await ProcurementService.updateVendor(selectedVendor.id, {
        name: values.name?.trim(),
        address: values.address?.trim() || undefined,
        taxId: values.taxId?.trim() || undefined,
        vendorType: values.vendorType?.trim() || undefined,
      });

      message.success(`Data vendor ${selectedVendor.code} berhasil diperbarui!`);
      editForm.resetFields();
      setIsEditModalOpen(false);
      setSelectedVendor(null);
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Gagal memperbarui data vendor. Silakan coba kembali.';
      message.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Soft Delete Vendor
  const handleSoftDelete = async (vendor: MasterVendor) => {
    try {
      const res = await ProcurementService.softDeleteVendor(vendor.id);
      message.success(
        res?.message || `Vendor ${vendor.name} (${vendor.code}) berhasil dinonaktifkan.`
      );
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Gagal menonaktifkan vendor. Silakan coba kembali.';
      message.error(errorMsg);
    }
  };

  // Table Columns
  const columns = [
    {
      title: 'Kode Vendor',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (code: string) => (
        <Space size={6}>
          <ShopOutlined style={{ color: '#0284c7' }} />
          <Text strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>
            {code}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Nama Vendor',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: MasterVendor) => (
        <div>
          <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
            {name}
          </Text>
          {record.address && (
            <div style={{ fontSize: 11, color: '#64748b' }}>
              <EnvironmentOutlined style={{ marginRight: 4 }} />
              {record.address.length > 55
                ? `${record.address.substring(0, 55)}...`
                : record.address}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Tipe Vendor',
      dataIndex: 'vendorType',
      key: 'vendorType',
      width: 140,
      render: (type?: string) =>
        type ? (
          <Tag color={getVendorTypeColor(type)} style={{ fontWeight: 500, borderRadius: 4 }}>
            {type}
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'NPWP / Tax ID',
      dataIndex: 'taxId',
      key: 'taxId',
      width: 170,
      render: (taxId?: string) =>
        taxId ? (
          <Space size={4}>
            <BankOutlined style={{ color: '#64748b', fontSize: 11 }} />
            <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{taxId}</Text>
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: () => (
        <Badge status="success" text={<Text style={{ color: '#166534', fontWeight: 500, fontSize: 12 }}>Aktif</Text>} />
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: MasterVendor) => (
        <Space size={6}>
          <Tooltip title="Lihat Detail Vendor">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ color: '#0284c7' }} />}
              onClick={() => handleOpenDetail(record)}
            />
          </Tooltip>

          {canMutate && (
            <>
              <Tooltip title="Edit Informasi Vendor">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: '#d97706' }} />}
                  onClick={() => handleOpenEdit(record)}
                />
              </Tooltip>

              <Popconfirm
                title="Nonaktifkan Vendor?"
                description={
                  <div style={{ maxWidth: 280 }}>
                    Vendor <strong>{record.code}</strong> akan dinonaktifkan. Data transaksi historis (PO, Quotation, Komparasi) tetap dipertahankan.
                  </div>
                }
                okText="Nonaktifkan Vendor"
                cancelText="Batal"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleSoftDelete(record)}
              >
                <Tooltip title="Nonaktifkan Vendor (Soft Delete)">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 32px', minHeight: '85vh', background: '#f8fafc' }}>
      {/* Header Bar */}
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} sm={16}>
            <Space align="center" size={12}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                }}
              >
                <ShopOutlined style={{ fontSize: 22, color: '#ffffff' }} />
              </div>
              <div>
                <Title level={3} style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
                  Data Master Vendor
                </Title>
                <Paragraph style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                  Direktori rekanan vendor dan penyedia jasa pengadaan canonical pada EPMS.
                </Paragraph>
              </div>
            </Space>
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
            {canMutate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="large"
                style={{
                  background: '#0284c7',
                  borderColor: '#0284c7',
                  borderRadius: 8,
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
                }}
                onClick={() => {
                  createForm.resetFields();
                  setIsCreateModalOpen(true);
                }}
              >
                Tambah Vendor
              </Button>
            )}
          </Col>
        </Row>
      </div>

      {/* Main Card: Search, Filter, & Table */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        {/* Filter Controls */}
        <Row gutter={[12, 12]} style={{ marginBottom: 18 }} align="middle">
          <Col xs={24} sm={10} md={8}>
            <Input.Search
              placeholder="Cari kode atau nama vendor..."
              allowClear
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={handleSearch}
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              style={{ width: '100%', borderRadius: 6 }}
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select
              placeholder="Filter Tipe Vendor"
              allowClear
              value={vendorTypeFilter}
              onChange={(val) => {
                setVendorTypeFilter(val);
                setPagination((prev) => ({ ...prev, current: 1 }));
              }}
              style={{ width: '100%' }}
            >
              {VENDOR_TYPES.map((t) => (
                <Option key={t} value={t}>
                  {t}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleResetFilters}
              style={{ borderRadius: 6 }}
            >
              Reset
            </Button>
          </Col>
        </Row>

        {/* Vendors Table */}
        <Table
          columns={columns}
          dataSource={vendors}
          rowKey="id"
          loading={isLoading || isFetching}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: totalVendors,
            showTotal: (total) => `Total ${total} vendor aktif`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (page, pageSize) => {
              setPagination({ current: page, pageSize });
            },
          }}
          locale={{
            emptyText: (
              <div style={{ padding: '36px 0', textAlign: 'center' }}>
                <ShopOutlined style={{ fontSize: 36, color: '#cbd5e1', marginBottom: 12 }} />
                <Paragraph style={{ color: '#64748b', margin: 0 }}>
                  {searchTerm || vendorTypeFilter
                    ? 'Tidak ditemukan vendor yang sesuai kriteria pencarian.'
                    : 'Belum ada data master vendor terdaftar.'}
                </Paragraph>
              </div>
            ),
          }}
        />
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title={
          <Space>
            <ShopOutlined style={{ color: '#0284c7' }} />
            <span>Detail Master Vendor</span>
          </Space>
        }
        placement="right"
        width={480}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedVendor(null);
        }}
        open={isDetailDrawerOpen}
      >
        {selectedVendor && (
          <div>
            <div
              style={{
                background: '#f1f5f9',
                padding: '16px 20px',
                borderRadius: 8,
                marginBottom: 20,
              }}
            >
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Vendor Resmi
              </Text>
              <Title level={4} style={{ margin: '4px 0 0 0', color: '#0f172a' }}>
                {selectedVendor.name}
              </Title>
              <Tag color="blue" style={{ marginTop: 8, fontFamily: 'monospace' }}>
                {selectedVendor.code}
              </Tag>
            </div>

            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Kode Vendor">
                <Text strong style={{ fontFamily: 'monospace' }}>
                  {selectedVendor.code}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Nama Lengkap">
                {selectedVendor.name}
              </Descriptions.Item>
              <Descriptions.Item label="Tipe / Kategori">
                {selectedVendor.vendorType ? (
                  <Tag color={getVendorTypeColor(selectedVendor.vendorType)}>
                    {selectedVendor.vendorType}
                  </Tag>
                ) : (
                  <Text type="secondary">—</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="NPWP / Tax ID">
                {selectedVendor.taxId || <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Alamat Kantor">
                {selectedVendor.address || <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Status Akun">
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  Aktif
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tanggal Pendaftaran">
                {selectedVendor.createdAt ? (
                  <Space size={4}>
                    <CalendarOutlined style={{ color: '#64748b' }} />
                    <Text>{dayjs(selectedVendor.createdAt).format('DD MMMM YYYY, HH:mm')}</Text>
                  </Space>
                ) : (
                  <Text type="secondary">—</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Terakhir Diperbarui">
                {selectedVendor.updatedAt ? (
                  <Text>{dayjs(selectedVendor.updatedAt).format('DD MMMM YYYY, HH:mm')}</Text>
                ) : (
                  <Text type="secondary">—</Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>

      {/* Modal: Tambah Vendor */}
      <Modal
        title={
          <Space>
            <ShopOutlined style={{ color: '#0284c7' }} />
            <span>Pendaftaran Master Vendor Baru</span>
          </Space>
        }
        open={isCreateModalOpen}
        onCancel={() => {
          if (!isSubmitting) {
            createForm.resetFields();
            setIsCreateModalOpen(false);
          }
        }}
        footer={[
          <Button
            key="cancel"
            disabled={isSubmitting}
            onClick={() => {
              createForm.resetFields();
              setIsCreateModalOpen(false);
            }}
          >
            Batal
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
            style={{ background: '#0284c7', borderColor: '#0284c7' }}
            onClick={() => createForm.submit()}
          >
            Simpan Vendor
          </Button>,
        ]}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="code"
            label="Kode Vendor (Otomatis)"
            extra="Kode Vendor akan dibuat otomatis oleh sistem."
          >
            <Input
              disabled
              placeholder="[Otomatis dari Sistem]"
              style={{ fontFamily: 'monospace', background: '#f8fafc', color: '#64748b' }}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nama Perusahaan / Rekanan"
            rules={[{ required: true, message: 'Nama vendor wajib diisi' }]}
          >
            <Input placeholder="Contoh: PT Mitra Solusi Persada" />
          </Form.Item>

          <Form.Item name="vendorType" label="Tipe / Kategori Vendor">
            <Select placeholder="Pilih kategori vendor" allowClear>
              {VENDOR_TYPES.map((t) => (
                <Option key={t} value={t}>
                  {t}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="taxId" label="NPWP / Tax ID">
            <Input placeholder="Contoh: 01.234.567.8-901.000" />
          </Form.Item>

          <Form.Item name="address" label="Alamat Kantor">
            <Input.TextArea
              rows={3}
              placeholder="Alamat kantor, gedung, atau workshop vendor..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Edit Vendor */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: '#d97706' }} />
            <span>Edit Data Master Vendor</span>
          </Space>
        }
        open={isEditModalOpen}
        onCancel={() => {
          if (!isSubmitting) {
            editForm.resetFields();
            setIsEditModalOpen(false);
            setSelectedVendor(null);
          }
        }}
        footer={[
          <Button
            key="cancel"
            disabled={isSubmitting}
            onClick={() => {
              editForm.resetFields();
              setIsEditModalOpen(false);
              setSelectedVendor(null);
            }}
          >
            Batal
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
            style={{ background: '#d97706', borderColor: '#d97706' }}
            onClick={() => editForm.submit()}
          >
            Simpan Perubahan
          </Button>,
        ]}
        destroyOnClose
      >
        {selectedVendor && (
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleEditSubmit}
            style={{ marginTop: 16 }}
          >
            <Form.Item label="Kode Vendor">
              <Input
                value={selectedVendor.code}
                disabled
                style={{
                  fontFamily: 'monospace',
                  background: '#f1f5f9',
                  color: '#64748b',
                }}
                prefix={<ShopOutlined style={{ color: '#94a3b8' }} />}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Kode vendor bersifat permanen dan tidak dapat diubah (immutable).
              </Text>
            </Form.Item>

            <Form.Item
              name="name"
              label="Nama Perusahaan / Rekanan"
              rules={[{ required: true, message: 'Nama vendor tidak boleh kosong' }]}
            >
              <Input placeholder="Nama vendor..." />
            </Form.Item>

            <Form.Item name="vendorType" label="Tipe / Kategori Vendor">
              <Select placeholder="Pilih kategori vendor" allowClear>
                {VENDOR_TYPES.map((t) => (
                  <Option key={t} value={t}>
                    {t}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="taxId" label="NPWP / Tax ID">
              <Input placeholder="NPWP / Tax ID..." />
            </Form.Item>

            <Form.Item name="address" label="Alamat Kantor">
              <Input.TextArea rows={3} placeholder="Alamat lengkap vendor..." />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default VendorsPage;
