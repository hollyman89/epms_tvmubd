import React, { useState, useEffect, useMemo } from 'react';
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
  Popconfirm, 
  Typography, 
  Tooltip, 
  Empty, 
  Avatar, 
  Tabs, 
  Timeline,
  Pagination,
  Spin
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined, 
  SearchOutlined, 
  TeamOutlined, 
  UserAddOutlined, 
  PlusOutlined,
  PhoneOutlined,
  MailOutlined,
  BankOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  TrophyOutlined,
  AppstoreOutlined,
  CopyOutlined,
  UserOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiClient } from '@/lib/axios';
import { useUsersQuery } from '@/hooks/useMasterDataQuery';
import EditCustomerModal from './EditCustomerModal';
import CustomerForm, { CustomerFormPayload, BUSINESS_SECTORS } from './CustomerForm';
import styles from './customers/CustomersPage.module.css';

const { Option } = Select;
const { Title, Text } = Typography;

const getInitials = (name?: string) => {
  if (!name) return 'CU';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export interface Customer {
  id: number;
  code: string;
  name: string;
  company?: string;
  contact_person: string;
  phone: string;
  email: string;
  business_sector?: string;
  city?: string;
  status: 'Active' | 'Inactive' | 'PROSPECT';
  marketing_pic_id?: number;
  marketing_pic?: {
    id: number;
    fullName: string;
    email: string;
  };
}

export const CustomersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  const { data: rawMarketingPics = [] } = useUsersQuery();
  const marketingPics = rawMarketingPics;
  
  // Pagination & Filters
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [searchText, setSearchText] = useState<string>('');
  const [sectorFilter, setSectorFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Modals & Drawers
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState<boolean>(false);
  const [detailCustomer, setDetailCustomer] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const roleStr = userRole ? userRole.toUpperCase() : '';
  const isSuperAdmin = roleStr === 'SUPER_ADMIN' || roleStr === 'ADMIN';
  const isCanEdit = isSuperAdmin || roleStr === 'MANAGER' || roleStr === 'GENERAL_MANAGER' || roleStr === 'MARKETING';
  const isCanCreate = isSuperAdmin || roleStr === 'MARKETING';

  const { data: queryData, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ['customers', pagination.current, pagination.pageSize, searchText, sectorFilter, statusFilter],
    queryFn: async () => {
      try {
        const params: any = { page: pagination.current, limit: pagination.pageSize };
        if (searchText) params.search = searchText;
        if (sectorFilter) params.sector = sectorFilter;
        if (statusFilter) params.status = statusFilter;

        const res = await apiClient.get('/customers', { params });
        const responseBody = res.data?.data || res.data;
        const customerArray = Array.isArray(responseBody) ? responseBody : (responseBody?.data || []);
        const totalCount = Array.isArray(responseBody) ? responseBody.length : (responseBody?.total || customerArray.length);

        return { customers: customerArray, total: totalCount };
      } catch (err: any) {
        message.error(err.response?.data?.message || 'Gagal memuat data customer');
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const customers = queryData?.customers || [];
  const totalCustomers = queryData?.total || 0;

  // Build sector options dynamically combining BUSINESS_SECTORS + existing live sectors
  const sectorOptions = useMemo(() => {
    const set = new Set<string>(BUSINESS_SECTORS);
    customers.forEach((c: Customer) => {
      if (c.business_sector) set.add(c.business_sector);
    });
    return Array.from(set);
  }, [customers]);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const parsedUser = JSON.parse(userStr);
        if (parsedUser && parsedUser.roles && parsedUser.roles.length > 0) {
          setUserRole(parsedUser.roles[0]);
        }
      }
    } catch (e) {
      console.error('Error parsing user from localStorage', e);
    }
  }, []);

  const handleTableChange = (pag: any) => {
    setPagination({ current: pag.current, pageSize: pag.pageSize });
  };

  const handleSearch = (value: string) => {
    setSearchText(value.trim());
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleSectorFilter = (value: string | undefined) => {
    setSectorFilter(value);
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleStatusFilter = (value: string | undefined) => {
    setStatusFilter(value);
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const openAddModal = () => {
    setIsModalVisible(true);
  };

  const openEditModal = (record: any) => {
    setSelectedCustomer(record);
    setIsEditModalOpen(true);
  };

  const handleCreateCustomer = async (payload: CustomerFormPayload) => {
    try {
      setIsSubmitting(true);
      await apiClient.post('/customers', payload);
      message.success('Customer berhasil ditambahkan');
      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err: any) {
      if (err.response) {
        message.error(err.response?.data?.message || 'Gagal menyimpan data customer');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/customers/${id}`);
      message.success('Customer berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Gagal menghapus customer');
    }
  };

  const openDetailDrawer = async (record: any) => {
    try {
      const res = await apiClient.get(`/customers/${record.id}`);
      setDetailCustomer(res.data?.data || res.data);
      setIsDrawerVisible(true);
    } catch (err: any) {
      message.error('Gagal mengambil detail customer');
    }
  };

  const renderStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'ACTIVE') {
      return <span className={styles.statusBadgeActive}>ACTIVE</span>;
    }
    if (s === 'PROSPECT') {
      return <span className={styles.statusBadgeProspect}>PROSPECT</span>;
    }
    return <span className={styles.statusBadgeInactive}>{s || 'INACTIVE'}</span>;
  };

  const columns = [
    { 
      title: 'Kode', 
      dataIndex: 'code', 
      key: 'code', 
      width: 105,
      render: (text: string) => <span className={styles.codeTag}>{text || '-'}</span>
    },
    { 
      title: 'Nama Customer', 
      dataIndex: 'name', 
      key: 'name', 
      width: 190,
      render: (text: string) => <Text strong style={{ color: '#0f172a', fontSize: 13 }}>{text}</Text>
    },
    { 
      title: 'Perusahaan (Legal)', 
      dataIndex: 'company', 
      key: 'company', 
      width: 200,
      render: (text: string) => <Text style={{ color: '#475569', fontSize: 13 }}>{text || '-'}</Text>
    },
    { 
      title: 'Kontak Utama', 
      dataIndex: 'contact_person', 
      key: 'contact_person', 
      width: 150,
      render: (text: string) => <Text style={{ color: '#334155', fontSize: 12 }}>{text || '-'}</Text>
    },
    { 
      title: 'Telepon', 
      dataIndex: 'phone', 
      key: 'phone', 
      width: 140,
      render: (text: string) => <span className={styles.phoneCell}>{text || '-'}</span>
    },
    { 
      title: 'Email', 
      dataIndex: 'email', 
      key: 'email', 
      width: 190,
      render: (text: string) => {
        if (!text) return <Text type="secondary">-</Text>;
        return (
          <Tooltip title={text}>
            <a href={`mailto:${text}`} className={styles.emailLink}>
              {text}
            </a>
          </Tooltip>
        );
      }
    },
    { 
      title: 'Sektor', 
      dataIndex: 'business_sector', 
      key: 'business_sector', 
      width: 160,
      render: (text: string) => text ? <Tag className={styles.sectorTag}>{text}</Tag> : <Text type="secondary">-</Text>
    },
    { 
      title: 'Kota', 
      dataIndex: 'city', 
      key: 'city', 
      width: 120,
      render: (text: string) => <Text style={{ color: '#475569', fontSize: 12 }}>{text || '-'}</Text>
    },
    { 
      title: 'Marketing PIC', 
      dataIndex: 'marketing_pic', 
      key: 'marketing_pic', 
      width: 160,
      render: (pic: any) => {
        if (!pic) return <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 12 }}>Belum ditugaskan</Text>;
        return (
          <Space size={6}>
            <Avatar size={20} icon={<UserOutlined />} style={{ background: '#e0e7ff', color: '#4338ca', fontSize: 10 }} />
            <Text style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>
              {pic.fullName || pic.email}
            </Text>
          </Space>
        );
      }
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status', 
      width: 110,
      render: (status: string) => renderStatusBadge(status)
    },
    { 
      title: 'Aksi', 
      key: 'action', 
      width: 110,
      align: 'center' as const,
      render: (_: any, record: any) => {
        return (
          <Space size={6}>
            <Tooltip title="Lihat Detail">
              <Button 
                type="text" 
                size="small"
                icon={<EyeOutlined />} 
                onClick={() => openDetailDrawer(record)} 
                className={styles.viewActionBtn}
              />
            </Tooltip>
            
            {isCanEdit && (
              <Tooltip title="Edit Customer">
                <Button 
                  type="text" 
                  size="small"
                  icon={<EditOutlined />} 
                  onClick={() => openEditModal(record)} 
                  className={styles.editActionBtn}
                />
              </Tooltip>
            )}

            {isSuperAdmin && (
              <Popconfirm 
                title="Hapus Customer?"
                description="Customer yang memiliki Tender aktif tidak dapat dihapus."
                onConfirm={() => handleDelete(record.id)}
                okText="Hapus"
                cancelText="Batal"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Hapus Customer">
                  <Button 
                    type="text" 
                    danger 
                    size="small"
                    icon={<DeleteOutlined />} 
                    className={styles.deleteActionBtn}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className={styles.pageContainer}>
      {/* 1. PAGE HEADER */}
      <div className={styles.pageHeader}>
        <div className={styles.headerTextGroup}>
          <div className={styles.titleRow}>
            <TeamOutlined className={styles.headerIcon} />
            <Title level={3} className={styles.pageTitle}>
              Customer Master
            </Title>
          </div>
          <Text className={styles.pageSubtitle}>
            Direktori customer, profil perusahaan, dan kontak utama.
          </Text>
        </div>

        {/* 2. SEARCH & FILTER TOOLBAR */}
        <div className={styles.toolbarContainer}>
          <Input 
            placeholder="Cari Nama / Perusahaan..." 
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} 
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 240, height: 38, borderRadius: 8 }}
            allowClear
          />

          <Select 
            placeholder="Filter Sektor" 
            style={{ width: 180, height: 38 }} 
            onChange={handleSectorFilter}
            allowClear
            dropdownStyle={{ borderRadius: 8 }}
          >
            {sectorOptions.map((sector) => (
              <Option key={sector} value={sector}>{sector}</Option>
            ))}
          </Select>

          <Select 
            placeholder="Filter Status" 
            style={{ width: 140, height: 38 }} 
            onChange={handleStatusFilter}
            allowClear
            dropdownStyle={{ borderRadius: 8 }}
          >
            <Option value="PROSPECT">PROSPECT</Option>
            <Option value="Active">ACTIVE</Option>
            <Option value="Inactive">INACTIVE</Option>
          </Select>

          {isCanCreate && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={openAddModal}
              className={styles.primaryCtaBtn}
            >
              Input Customer
            </Button>
          )}
        </div>
      </div>

      {/* 3. ERROR STATE */}
      {isError && (
        <div style={{ 
          padding: '24px', 
          background: '#fef2f2', 
          border: '1px solid #fecaca', 
          borderRadius: '10px', 
          textAlign: 'center', 
          marginBottom: 16 
        }}>
          <Text strong style={{ color: '#b91c1c', display: 'block', fontSize: 14 }}>
            Terjadi kesalahan saat memuat data customer.
          </Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            {(error as any)?.message || 'Koneksi ke backend bermasalah.'}
          </Text>
          <Button 
            type="primary" 
            danger 
            icon={<ReloadOutlined />} 
            onClick={() => refetch()} 
            style={{ marginTop: 12, borderRadius: 6 }}
          >
            Muat Ulang
          </Button>
        </div>
      )}

      {/* 4. DESKTOP / TABLET ENTERPRISE TABLE */}
      <div className={styles.desktopOnly}>
        <div className={styles.tableContainer}>
          <Table 
            columns={columns} 
            dataSource={customers} 
            rowKey="id" 
            loading={loading}
            className={styles.customerTable}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: totalCustomers,
              showSizeChanger: true,
              showTotal: (total, range) => `Menampilkan ${range[0]}-${range[1]} dari ${total} customer`,
              style: { padding: '12px 16px', margin: 0 }
            }}
            onChange={handleTableChange}
            scroll={{ x: 1150 }}
            locale={{
              emptyText: (
                <Empty 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Space direction="vertical" size={4}>
                      <Text strong style={{ color: '#475569' }}>
                        Tidak ada customer yang sesuai dengan pencarian atau filter.
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Coba periksa kata kunci pencarian atau reset filter.
                      </Text>
                    </Space>
                  }
                  style={{ margin: '36px 0' }}
                />
              )
            }}
          />
        </div>
      </div>

      {/* 5. MOBILE RESPONSIVE CARDS VIEW (<= 768px) */}
      <div className={styles.mobileOnly}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="Memuat data customer..." />
          </div>
        ) : customers.length === 0 ? (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <Text strong style={{ color: '#475569' }}>
                  Tidak ada customer yang sesuai dengan pencarian atau filter.
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Coba periksa kata kunci pencarian atau reset filter.
                </Text>
              </Space>
            }
            style={{ margin: '36px 0' }}
          />
        ) : (
          <>
            {customers.map((c: Customer) => (
              <div key={c.id} className={styles.mobileCard}>
                <div className={styles.mobileCardTop}>
                  <span className={styles.codeTag}>{c.code}</span>
                  {renderStatusBadge(c.status)}
                </div>

                <div>
                  <div className={styles.mobileCardCustomerName}>{c.name}</div>
                  <div className={styles.mobileCardCompany}>{c.company || 'Perusahaan Belum Terdaftar'}</div>
                </div>

                <div className={styles.mobileCardGrid}>
                  <div>
                    <div className={styles.mobileCardFieldLabel}>Kontak Utama</div>
                    <div className={styles.mobileCardFieldValue}>{c.contact_person || '-'}</div>
                  </div>
                  <div>
                    <div className={styles.mobileCardFieldLabel}>Telepon</div>
                    <div className={styles.mobileCardFieldValue}>
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} style={{ color: '#2563eb', fontWeight: 600 }}>{c.phone}</a>
                      ) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className={styles.mobileCardFieldLabel}>Email</div>
                    <div className={styles.mobileCardFieldValue}>
                      {c.email ? (
                        <a href={`mailto:${c.email}`} style={{ color: '#2563eb' }}>{c.email}</a>
                      ) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className={styles.mobileCardFieldLabel}>Sektor / Kota</div>
                    <div className={styles.mobileCardFieldValue}>
                      {c.business_sector ? <Tag className={styles.sectorTag} style={{ marginBottom: 2 }}>{c.business_sector}</Tag> : null}
                      <span style={{ color: '#64748b', fontSize: 11 }}>{c.city ? `(${c.city})` : ''}</span>
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div className={styles.mobileCardFieldLabel}>Marketing PIC</div>
                    <div className={styles.mobileCardFieldValue}>
                      {c.marketing_pic?.fullName || (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Belum ditugaskan</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.mobileCardFooter}>
                  <Button 
                    size="small" 
                    icon={<EyeOutlined />} 
                    onClick={() => openDetailDrawer(c)}
                    className={styles.mobileActionBtn}
                    style={{ background: '#eff6ff', borderColor: '#dbeafe', color: '#2563eb' }}
                  >
                    Lihat
                  </Button>

                  {isCanEdit && (
                    <Button 
                      size="small" 
                      icon={<EditOutlined />} 
                      onClick={() => openEditModal(c)}
                      className={styles.mobileActionBtn}
                      style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#d97706' }}
                    >
                      Edit
                    </Button>
                  )}

                  {isSuperAdmin && (
                    <Popconfirm 
                      title="Hapus Customer?"
                      description="Customer dengan Tender aktif tidak dapat dihapus."
                      onConfirm={() => handleDelete(c.id)}
                      okText="Hapus"
                      cancelText="Batal"
                      okButtonProps={{ danger: true }}
                    >
                      <Button 
                        size="small" 
                        danger 
                        icon={<DeleteOutlined />}
                        className={styles.mobileActionBtn}
                        style={{ background: '#fef2f2', borderColor: '#fecaca' }}
                      >
                        Hapus
                      </Button>
                    </Popconfirm>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <Pagination 
                size="small"
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={totalCustomers}
                onChange={(page, pageSize) => setPagination({ current: page, pageSize })}
                showTotal={(total) => `Total ${total} customer`}
              />
            </div>
          </>
        )}
      </div>

      {/* CREATE MODAL */}
      {isModalVisible && (
        <Modal 
          title={
            <Space align="center" size={8}>
              <UserAddOutlined style={{ color: '#2563eb', fontSize: 18 }} />
              <Text strong style={{ fontSize: 16, color: '#0f172a' }}>
                Input Customer Baru
              </Text>
            </Space>
          } 
          open={isModalVisible} 
          onCancel={() => setIsModalVisible(false)} 
          width={720}
          style={{ top: 40, maxWidth: '95vw' }}
          footer={null}
          destroyOnClose
        >
          <CustomerForm
            onSubmit={handleCreateCustomer}
            onCancel={() => setIsModalVisible(false)}
            isSubmitting={isSubmitting}
            marketingPics={marketingPics}
            userRole={userRole}
          />
        </Modal>
      )}

      {/* CUSTOMER DETAIL DRAWER */}
      {isDrawerVisible && (
        <Drawer 
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TeamOutlined style={{ color: '#2563eb', fontSize: 16 }} />
              <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Detail Customer</span>
            </div>
          } 
          placement="right" 
          onClose={() => setIsDrawerVisible(false)} 
          open={isDrawerVisible}
          width={480}
          bodyStyle={{ 
            padding: 0, 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            background: '#f8fafc',
            overflow: 'hidden'
          }}
          headerStyle={{ 
            borderBottom: '1px solid #e2e8f0', 
            padding: '16px 20px', 
            background: '#ffffff',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}
          footer={
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '12px 16px',
              background: '#ffffff',
              borderTop: '1px solid #e2e8f0'
            }}>
              <Button 
                onClick={() => {
                  if (detailCustomer) {
                    const text = `Customer: ${detailCustomer.name} (${detailCustomer.code})\nCompany: ${detailCustomer.company || '-'}\nSector: ${detailCustomer.business_sector || '-'}\nContact: ${detailCustomer.contact_person} (${detailCustomer.phone} / ${detailCustomer.email})`;
                    navigator.clipboard.writeText(text);
                    message.success('Informasi customer disalin ke clipboard');
                  }
                }}
                icon={<CopyOutlined />}
                style={{ borderRadius: 8 }}
              >
                Salin Info
              </Button>

              {isCanEdit && (
                <Button 
                  type="primary" 
                  icon={<EditOutlined />} 
                  onClick={() => {
                    setIsDrawerVisible(false);
                    openEditModal(detailCustomer);
                  }}
                  style={{ background: '#2563eb', borderColor: '#2563eb', borderRadius: 8, fontWeight: 600 }}
                >
                  Edit Customer
                </Button>
              )}
            </div>
          }
        >
          {detailCustomer && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {/* Profile Card Header */}
              <div style={{ 
                background: '#ffffff', 
                borderRadius: 14, 
                padding: '20px', 
                border: '1px solid #e2e8f0', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <Avatar 
                    size={52} 
                    style={{ 
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', 
                      fontSize: 18, 
                      fontWeight: 700,
                      flexShrink: 0,
                      boxShadow: '0 4px 10px rgba(37,99,235,0.2)'
                    }}
                  >
                    {getInitials(detailCustomer.name)}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <Typography.Title level={4} style={{ margin: 0, color: '#0f172a', fontWeight: 700, fontSize: 18, lineHeight: 1.3 }}>
                        {detailCustomer.name}
                      </Typography.Title>
                      {renderStatusBadge(detailCustomer.status)}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: '#475569', fontSize: 13, fontWeight: 500 }}>
                      <BankOutlined style={{ color: '#64748b' }} />
                      <span style={{ wordBreak: 'break-word' }}>{detailCustomer.company || 'Perusahaan Belum Terdaftar'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <span className={styles.codeTag}>
                        {detailCustomer.code}
                      </span>
                      {detailCustomer.business_sector && (
                        <Tag className={styles.sectorTag}>
                          {detailCustomer.business_sector}
                        </Tag>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs Section */}
              <Tabs 
                defaultActiveKey="overview"
                items={[
                  {
                    key: 'overview',
                    label: <span style={{ fontWeight: 600 }}><AppstoreOutlined /> Ringkasan</span>,
                    children: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Company Info */}
                        <div style={{ 
                          background: '#ffffff', 
                          borderRadius: 12, 
                          padding: '16px', 
                          border: '1px solid #e2e8f0' 
                        }}>
                          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 12 }}>
                            Informasi Perusahaan
                          </Text>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Kode Customer</Text>
                              <Text strong style={{ fontSize: 13, color: '#0f172a', fontFamily: 'var(--font-mono, monospace)' }}>{detailCustomer.code || '-'}</Text>
                            </div>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Kota / Lokasi</Text>
                              <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                                <EnvironmentOutlined style={{ marginRight: 4, color: '#64748b' }} />
                                {detailCustomer.city || '-'}
                              </Text>
                            </div>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Sektor Industri</Text>
                              <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{detailCustomer.business_sector || '-'}</Text>
                            </div>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Terdaftar Sejak</Text>
                              <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                                {detailCustomer.created_at ? dayjs(detailCustomer.created_at).format('DD MMM YYYY') : '-'}
                              </Text>
                            </div>
                          </div>
                        </div>

                        {/* Contact Info Card */}
                        <div style={{ 
                          background: '#ffffff', 
                          borderRadius: 12, 
                          padding: '16px', 
                          border: '1px solid #e2e8f0' 
                        }}>
                          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 12 }}>
                            Kontak Utama
                          </Text>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar size={28} icon={<UserOutlined />} style={{ background: '#e0e7ff', color: '#4338ca' }} />
                              <div>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Contact Person</Text>
                                <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{detailCustomer.contact_person || '-'}</Text>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar size={28} icon={<PhoneOutlined />} style={{ background: '#dcfce7', color: '#15803d' }} />
                              <div>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Nomor Telepon</Text>
                                {detailCustomer.phone ? (
                                  <a href={`tel:${detailCustomer.phone}`} style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, fontFamily: 'var(--font-mono, monospace)' }}>
                                    {detailCustomer.phone}
                                  </a>
                                ) : (
                                  <Text type="secondary" style={{ fontSize: 13 }}>-</Text>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar size={28} icon={<MailOutlined />} style={{ background: '#ffedd5', color: '#c2410c' }} />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Email</Text>
                                {detailCustomer.email ? (
                                  <a href={`mailto:${detailCustomer.email}`} style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, wordBreak: 'break-all' }}>
                                    {detailCustomer.email}
                                  </a>
                                ) : (
                                  <Text type="secondary" style={{ fontSize: 13 }}>-</Text>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Tender Summary */}
                        <div style={{ 
                          background: '#ffffff', 
                          borderRadius: 12, 
                          padding: '16px', 
                          border: '1px solid #e2e8f0' 
                        }}>
                          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 12 }}>
                            Ringkasan Tender
                          </Text>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div style={{ 
                              background: '#f8fafc', 
                              borderRadius: 10, 
                              padding: '12px 14px', 
                              border: '1px solid #e2e8f0' 
                            }}>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block', fontWeight: 600 }}>TOTAL TENDER</Text>
                              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                                {detailCustomer.tenders?.length || 0}
                              </div>
                            </div>

                            <div style={{ 
                              background: '#f0fdf4', 
                              borderRadius: 10, 
                              padding: '12px 14px', 
                              border: '1px solid #bbf7d0' 
                            }}>
                              <Text style={{ fontSize: 11, display: 'block', fontWeight: 600, color: '#166534' }}>WON TENDERS</Text>
                              <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 2 }}>
                                {detailCustomer.tenders?.filter((t: any) => t.stage === 'WON' || t.status === 'WON').length || 0}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  },
                  {
                    key: 'contacts',
                    label: <span style={{ fontWeight: 600 }}><PhoneOutlined /> Kontak</span>,
                    children: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ 
                          background: '#ffffff', 
                          borderRadius: 12, 
                          padding: '16px', 
                          border: '1px solid #e2e8f0' 
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <Avatar size={36} icon={<UserOutlined />} style={{ background: '#3b82f6' }} />
                            <div>
                              <Text strong style={{ fontSize: 14, color: '#0f172a', display: 'block' }}>{detailCustomer.contact_person || 'Nama Kontak Belum Ada'}</Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>Kontak Utama</Text>
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11 }}>Telepon:</Text>
                              <div style={{ marginTop: 2 }}>
                                {detailCustomer.phone ? (
                                  <a href={`tel:${detailCustomer.phone}`} style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', fontFamily: 'var(--font-mono, monospace)' }}>{detailCustomer.phone}</a>
                                ) : (
                                  <Text type="secondary">-</Text>
                                )}
                              </div>
                            </div>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11 }}>Email:</Text>
                              <div style={{ marginTop: 2 }}>
                                {detailCustomer.email ? (
                                  <a href={`mailto:${detailCustomer.email}`} style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', wordBreak: 'break-all' }}>{detailCustomer.email}</a>
                                ) : (
                                  <Text type="secondary">-</Text>
                                )}
                              </div>
                            </div>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11 }}>Lokasi / Kota:</Text>
                              <div style={{ marginTop: 2, fontSize: 13, color: '#334155' }}>
                                {detailCustomer.city || '-'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {detailCustomer.marketing_pic && (
                          <div style={{ 
                            background: '#ffffff', 
                            borderRadius: 12, 
                            padding: '16px', 
                            border: '1px solid #e2e8f0' 
                          }}>
                            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 10 }}>
                              PIC Marketing Internal
                            </Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar size={32} icon={<UserOutlined />} style={{ background: '#6366f1' }} />
                              <div>
                                <Text strong style={{ fontSize: 13, color: '#0f172a', display: 'block' }}>{detailCustomer.marketing_pic.fullName}</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>{detailCustomer.marketing_pic.email}</Text>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  },
                  {
                    key: 'activity',
                    label: <span style={{ fontWeight: 600 }}><TrophyOutlined /> Aktivitas</span>,
                    children: (
                      <div style={{ background: '#ffffff', borderRadius: 12, padding: '16px', border: '1px solid #e2e8f0' }}>
                        {detailCustomer.tenders && detailCustomer.tenders.length > 0 ? (
                          <Timeline
                            mode="left"
                            style={{ marginTop: 8 }}
                            items={detailCustomer.tenders.map((tender: any) => ({
                              color: tender.stage === 'WON' || tender.status === 'WON' ? 'green' : '#3b82f6',
                              children: (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                    <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{tender.title}</Text>
                                    <Tag color={tender.stage === 'WON' || tender.status === 'WON' ? 'success' : 'processing'} style={{ borderRadius: 4, margin: 0, fontSize: 10 }}>
                                      {tender.stage || tender.status || 'ACTIVE'}
                                    </Tag>
                                  </div>
                                  {tender.estimated_budget && (
                                    <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 2, fontFamily: 'var(--font-mono, monospace)' }}>
                                      Rp {Number(tender.estimated_budget).toLocaleString('id-ID')}
                                    </div>
                                  )}
                                  {tender.created_at && (
                                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                                      {dayjs(tender.created_at).format('DD MMM YYYY, HH:mm')}
                                    </Text>
                                  )}
                                </div>
                              )
                            }))}
                          />
                        ) : (
                          <Empty 
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={<Text type="secondary" style={{ fontSize: 12 }}>Belum ada aktivitas tender untuk customer ini.</Text>}
                            style={{ margin: '24px 0' }}
                          />
                        )}
                      </div>
                    )
                  },
                  {
                    key: 'notes',
                    label: <span style={{ fontWeight: 600 }}><FileTextOutlined /> Catatan</span>,
                    children: (
                      <div style={{ background: '#ffffff', borderRadius: 12, padding: '16px', border: '1px solid #e2e8f0' }}>
                        <Empty 
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={<Text type="secondary" style={{ fontSize: 12 }}>Belum ada catatan untuk customer ini.</Text>}
                          style={{ margin: '24px 0' }}
                        />
                      </div>
                    )
                  }
                ]}
              />
            </div>
          )}
        </Drawer>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <EditCustomerModal 
          visible={isEditModalOpen} 
          customer={selectedCustomer} 
          onClose={() => setIsEditModalOpen(false)} 
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['customers'] })} 
        />
      )}
    </div>
  );
};

export default CustomersPage;
