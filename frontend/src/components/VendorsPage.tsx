"use client";

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Button,
  Input,
  Select,
  Modal,
  Drawer,
  Descriptions,
  message,
  Card,
  Typography,
  Tooltip,
  Form,
  Popconfirm,
  Alert,
  Breadcrumb,
  Empty,
  Spin,
  Pagination,
} from 'antd';
import {
  ShopOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
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
import styles from './VendorsPage.module.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Available filter categories (Vendor Type is free text in DB; these provide quick filter options)
const VENDOR_TYPES = [
  'Hardware',
  'Software',
  'Construction',
  'Logistics',
  'General',
  'Services',
  'Other',
];

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
    isError,
    error,
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

  // Submit Soft Delete Vendor (Guarded by F0 delete-safety backend check)
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

  // Restrained Vendor Type Presentation
  const renderVendorType = (type?: string) => {
    if (!type) return <Text type="secondary">—</Text>;
    return <span className={styles.vendorTypeTag}>{type}</span>;
  };

  // Table Columns - Canonical light-slate header structure, NO fake status column
  const columns = useMemo(
    () => [
      {
        title: 'KODE VENDOR',
        dataIndex: 'code',
        key: 'code',
        width: 140,
        render: (code: string) => (
          <span className={styles.vendorCodeBadge}>{code || '—'}</span>
        ),
      },
      {
        title: 'NAMA VENDOR',
        dataIndex: 'name',
        key: 'name',
        render: (name: string, record: MasterVendor) => (
          <div className={styles.vendorNameGroup}>
            <Tooltip title={name} placement="topLeft">
              <span className={styles.vendorName}>{name || 'Vendor Tanpa Nama'}</span>
            </Tooltip>
            {record.address && (
              <span className={styles.vendorAddressMeta} title={record.address}>
                <EnvironmentOutlined style={{ fontSize: 11, flexShrink: 0 }} />
                <span>{record.address}</span>
              </span>
            )}
          </div>
        ),
      },
      {
        title: 'TIPE VENDOR',
        dataIndex: 'vendorType',
        key: 'vendorType',
        width: 150,
        render: (type?: string) => renderVendorType(type),
      },
      {
        title: 'NPWP / TAX ID',
        dataIndex: 'taxId',
        key: 'taxId',
        width: 170,
        render: (taxId?: string) =>
          taxId ? (
            <span className={styles.taxIdText}>
              <BankOutlined style={{ marginRight: 5, color: '#64748B', fontSize: 11 }} />
              {taxId}
            </span>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: 'AKSI',
        key: 'actions',
        width: 130,
        align: 'right' as const,
        render: (_: any, record: MasterVendor) => (
          <div className={styles.actionGroup}>
            <Tooltip title="Lihat Detail Vendor">
              <Button
                className={styles.btnActionView}
                icon={<EyeOutlined style={{ fontSize: 13 }} />}
                onClick={() => handleOpenDetail(record)}
              />
            </Tooltip>

            {canMutate && (
              <>
                <Tooltip title="Edit Informasi Vendor">
                  <Button
                    className={styles.btnActionEdit}
                    icon={<EditOutlined style={{ fontSize: 13 }} />}
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
                  <Tooltip title="Nonaktifkan Vendor">
                    <Button
                      className={styles.btnActionDelete}
                      icon={<DeleteOutlined style={{ fontSize: 13 }} />}
                    />
                  </Tooltip>
                </Popconfirm>
              </>
            )}
          </div>
        ),
      },
    ],
    [canMutate]
  );

  return (
    <div className={styles.pageContainer} style={{ padding: '24px', minHeight: 'calc(100vh - 64px)' }}>
      {/* Header Section */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <Breadcrumb
            className={styles.breadcrumb}
            items={[{ title: 'Data Master' }, { title: 'Vendors' }]}
          />
          <div className={styles.titleRow}>
            <div className={styles.headerIconSurface}>
              <ShopOutlined />
            </div>
            <div>
              <Title level={4} className={styles.pageTitle}>
                Vendor Master
              </Title>
              <Text className={styles.pageSubtitle}>
                Direktori vendor dan penyedia barang/jasa untuk proses pengadaan.
              </Text>
            </div>
          </div>
        </div>

        <div className={styles.headerRight}>
          {canMutate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className={styles.btnCreate}
              onClick={() => {
                createForm.resetFields();
                setIsCreateModalOpen(true);
              }}
            >
              Tambah Vendor
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar & Filter Bar */}
      <div className={styles.toolbarCard}>
        <div className={styles.toolbarContent}>
          <div className={styles.toolbarFilters}>
            <Input.Search
              placeholder="Cari kode atau nama vendor..."
              allowClear
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={handleSearch}
              prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
              className={styles.searchInput}
            />

            <Select
              placeholder="Semua Tipe Vendor"
              allowClear
              value={vendorTypeFilter}
              onChange={(val) => {
                setVendorTypeFilter(val);
                setPagination((prev) => ({ ...prev, current: 1 }));
              }}
              className={styles.typeSelect}
            >
              {VENDOR_TYPES.map((t) => (
                <Option key={t} value={t}>
                  {t}
                </Option>
              ))}
            </Select>

            {(searchTerm || vendorTypeFilter || searchInput) && (
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={handleResetFilters}
                className={styles.btnReset}
              >
                Reset Filter
              </Button>
            )}
          </div>

          <div className={styles.toolbarStats}>
            Total <strong>{totalVendors}</strong> vendor
          </div>
        </div>
      </div>

      {/* Error Alert if query fails */}
      {isError && (
        <Alert
          type="error"
          message="Gagal Memuat Direktori Vendor"
          description={
            (error as any)?.response?.data?.message ||
            (error as any)?.message ||
            'Terjadi kesalahan saat memuat data vendor.'
          }
          showIcon
          action={
            <Button size="small" type="primary" danger onClick={() => refetch()}>
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
            className={styles.vendorTable}
            columns={columns}
            dataSource={vendors}
            rowKey="id"
            loading={isLoading || isFetching}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: totalVendors,
              showTotal: (total) => `Total ${total} vendor`,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              onChange: (page, pageSize) => {
                setPagination({ current: page, pageSize });
              },
            }}
            locale={{
              emptyText: (
                <div style={{ padding: '36px 0', textAlign: 'center' }}>
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      searchTerm || vendorTypeFilter
                        ? 'Tidak ada vendor yang sesuai dengan pencarian atau filter.'
                        : 'Belum ada data master vendor terdaftar.'
                    }
                  />
                </div>
              ),
            }}
            scroll={{ x: 800 }}
          />
        </div>
      </div>

      {/* Mobile Vendor Cards View (<= 768px) */}
      <div className={styles.mobileCardsView}>
        {isLoading ? (
          <Card className={styles.tableCard} style={{ padding: '40px 0', textAlign: 'center' }}>
            <Spin tip="Memuat vendor..." />
          </Card>
        ) : vendors.length === 0 ? (
          <Card className={styles.tableCard} style={{ padding: '32px 16px', textAlign: 'center' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                searchTerm || vendorTypeFilter
                  ? 'Tidak ada vendor yang sesuai dengan pencarian atau filter.'
                  : 'Belum ada data master vendor terdaftar.'
              }
            />
          </Card>
        ) : (
          <>
            {vendors.map((vendor) => (
              <div key={vendor.id} className={styles.mobileVendorCard}>
                <div className={styles.mobileCardTop}>
                  <div className={styles.mobileVendorHeader}>
                    <span className={styles.mobileVendorName}>
                      {vendor.name || 'Vendor Tanpa Nama'}
                    </span>
                    <span className={styles.vendorCodeBadge} style={{ alignSelf: 'flex-start' }}>
                      {vendor.code || '—'}
                    </span>
                  </div>
                  <div>{renderVendorType(vendor.vendorType)}</div>
                </div>

                <div className={styles.mobileCardGrid}>
                  <div className={styles.mobileGridItem}>
                    <span className={styles.mobileLabel}>NPWP / Tax ID</span>
                    <span className={styles.mobileValue} style={{ fontFamily: 'ui-monospace, monospace' }}>
                      {vendor.taxId || '—'}
                    </span>
                  </div>

                  <div className={styles.mobileGridItem}>
                    <span className={styles.mobileLabel}>Tipe Vendor</span>
                    <span className={styles.mobileValue}>
                      {vendor.vendorType || '—'}
                    </span>
                  </div>

                  <div className={styles.mobileGridItemFull}>
                    <span className={styles.mobileLabel}>Alamat Kantor</span>
                    <span className={styles.mobileValue}>
                      {vendor.address || '—'}
                    </span>
                  </div>
                </div>

                <div className={styles.mobileCardFooter}>
                  <Button
                    size="small"
                    className={styles.btnActionView}
                    icon={<EyeOutlined style={{ fontSize: 13 }} />}
                    onClick={() => handleOpenDetail(vendor)}
                  />

                  {canMutate && (
                    <>
                      <Button
                        size="small"
                        className={styles.btnActionEdit}
                        icon={<EditOutlined style={{ fontSize: 13 }} />}
                        onClick={() => handleOpenEdit(vendor)}
                      />

                      <Popconfirm
                        title="Nonaktifkan Vendor?"
                        description={
                          <div style={{ maxWidth: 280 }}>
                            Vendor <strong>{vendor.code}</strong> akan dinonaktifkan.
                          </div>
                        }
                        okText="Nonaktifkan"
                        cancelText="Batal"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleSoftDelete(vendor)}
                      >
                        <Button
                          size="small"
                          className={styles.btnActionDelete}
                          icon={<DeleteOutlined style={{ fontSize: 13 }} />}
                        />
                      </Popconfirm>
                    </>
                  )}
                </div>
              </div>
            ))}

            <div className={styles.mobilePagination}>
              <Pagination
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={totalVendors}
                onChange={(page, pageSize) => setPagination({ current: page, pageSize })}
                simple
              />
            </div>
          </>
        )}
      </div>

      {/* Detail Drawer - Only Authoritative Fields, NO fake status */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShopOutlined style={{ color: '#0284c7' }} />
            <span>Detail Master Vendor</span>
          </div>
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
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '16px 20px',
                borderRadius: 8,
                marginBottom: 20,
              }}
            >
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                Identitas Vendor
              </Text>
              <Title level={4} style={{ margin: '4px 0 6px 0', color: '#0f172a' }}>
                {selectedVendor.name}
              </Title>
              <span className={styles.vendorCodeBadge}>
                {selectedVendor.code}
              </span>
            </div>

            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Kode Vendor">
                <Text strong style={{ fontFamily: 'ui-monospace, monospace' }}>
                  {selectedVendor.code}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Nama Perusahaan">
                {selectedVendor.name}
              </Descriptions.Item>
              <Descriptions.Item label="Tipe / Kategori">
                {renderVendorType(selectedVendor.vendorType)}
              </Descriptions.Item>
              <Descriptions.Item label="NPWP / Tax ID">
                {selectedVendor.taxId ? (
                  <span style={{ fontFamily: 'ui-monospace, monospace' }}>{selectedVendor.taxId}</span>
                ) : (
                  <Text type="secondary">—</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Alamat Kantor">
                {selectedVendor.address || <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Tanggal Pendaftaran">
                {selectedVendor.createdAt ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarOutlined style={{ color: '#64748b' }} />
                    <Text>{dayjs(selectedVendor.createdAt).format('DD MMMM YYYY, HH:mm')}</Text>
                  </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShopOutlined style={{ color: '#0284c7' }} />
            <span>Pendaftaran Master Vendor Baru</span>
          </div>
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
              style={{ fontFamily: 'ui-monospace, monospace', background: '#f8fafc', color: '#64748b' }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined style={{ color: '#d97706' }} />
            <span>Edit Data Master Vendor</span>
          </div>
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
                  fontFamily: 'ui-monospace, monospace',
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
