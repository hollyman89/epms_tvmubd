import React, { useState, useEffect } from 'react';
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
  Card, 
  Row, 
  Col, 
  Typography, 
  Tooltip, 
  Empty, 
  Avatar, 
  Tabs, 
  Timeline 
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
  UserOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiClient } from '@/lib/axios';
import { useUsersQuery } from '@/hooks/useMasterDataQuery';
import EditCustomerModal from './EditCustomerModal';
import CustomerForm, { CustomerFormPayload } from './CustomerForm';

const { Option } = Select;
const { Title, Text } = Typography;

const getInitials = (name?: string) => {
  if (!name) return 'CU';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const getStatusColor = (status?: string) => {
  const s = status ? status.toUpperCase() : '';
  if (s === 'ACTIVE') return 'success';
  if (s === 'PROSPECT') return 'processing';
  if (s === 'INACTIVE') return 'default';
  return 'default';
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

  // Modals & Drawers
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState<boolean>(false);
  const [detailCustomer, setDetailCustomer] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const roleStr = userRole ? userRole.toUpperCase() : '';
  const isSuperAdmin = roleStr === 'SUPER_ADMIN' || roleStr === 'ADMIN';
  const isCanEdit = isSuperAdmin || roleStr === 'MANAGER' || roleStr === 'GENERAL_MANAGER';

  const { data: queryData, isLoading: loading } = useQuery({
    queryKey: ['customers', pagination.current, pagination.pageSize, searchText, sectorFilter],
    queryFn: async () => {
      try {
        const params: any = { page: pagination.current, limit: pagination.pageSize };
        if (searchText) params.search = searchText;
        if (sectorFilter) params.sector = sectorFilter;

        const res = await apiClient.get('/customers', { params });
        const responseBody = res.data?.data || res.data;
        const customerArray = Array.isArray(responseBody) ? responseBody : (responseBody?.data || []);
        const totalCount = Array.isArray(responseBody) ? responseBody.length : (responseBody?.total || customerArray.length);

        return { customers: customerArray, total: totalCount };
      } catch (error: any) {
        message.error(error.response?.data?.message || 'Failed to fetch customers');
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const customers = queryData?.customers || [];
  const totalCustomers = queryData?.total || 0;

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
    setSearchText(value);
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleSectorFilter = (value: string) => {
    setSectorFilter(value);
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
      message.success('Customer added successfully');
      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.message || 'Failed to save customer');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/customers/${id}`);
      message.success('Customer deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to delete customer');
    }
  };

  const openDetailDrawer = async (record: any) => {
    try {
      const res = await apiClient.get(`/customers/${record.id}`);
      setDetailCustomer(res.data.data || res.data);
      setIsDrawerVisible(true);
    } catch (error: any) {
      message.error('Failed to fetch customer details');
    }
  };

  const columns = [
    { 
      title: 'Code', 
      dataIndex: 'code', 
      key: 'code', 
      width: 110,
      render: (text: string) => <Text code style={{ fontWeight: 600, color: '#334155', fontSize: 12 }}>{text || '-'}</Text>
    },
    { 
      title: 'Name', 
      dataIndex: 'name', 
      key: 'name', 
      width: 200,
      render: (text: string) => <Text strong style={{ color: '#0f172a', fontSize: 13 }}>{text}</Text>
    },
    { 
      title: 'Company', 
      dataIndex: 'company', 
      key: 'company', 
      width: 200,
      render: (text: string) => <Text style={{ color: '#475569', fontSize: 13 }}>{text || '-'}</Text>
    },
    { 
      title: 'Contact Person', 
      dataIndex: 'contact_person', 
      key: 'contact_person', 
      width: 160,
      render: (text: string) => <Text style={{ color: '#334155', fontSize: 12 }}>{text || '-'}</Text>
    },
    { 
      title: 'Phone', 
      dataIndex: 'phone', 
      key: 'phone', 
      width: 140,
      render: (text: string) => <Text style={{ color: '#64748b', fontSize: 12 }}>{text || '-'}</Text>
    },
    { 
      title: 'Email', 
      dataIndex: 'email', 
      key: 'email', 
      width: 190,
      render: (text: string) => <Text style={{ color: '#64748b', fontSize: 12, wordBreak: 'break-all' }}>{text || '-'}</Text>
    },
    { 
      title: 'Sector', 
      dataIndex: 'business_sector', 
      key: 'business_sector', 
      width: 150,
      render: (text: string) => text ? <Tag color="blue" style={{ borderRadius: 6, margin: 0 }}>{text}</Tag> : <Text type="secondary">-</Text>
    },
    { 
      title: 'City', 
      dataIndex: 'city', 
      key: 'city', 
      width: 130,
      render: (text: string) => <Text style={{ color: '#64748b', fontSize: 12 }}>{text || '-'}</Text>
    },
    { 
      title: 'Marketing PIC', 
      dataIndex: 'marketing_pic', 
      key: 'marketing_pic', 
      width: 160,
      render: (pic: any) => {
        if (!pic) return <Text type="secondary">-</Text>;
        return (
          <Space size={6}>
            
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
      render: (status: string) => {
        const s = status ? status.toUpperCase() : 'UNKNOWN';
        if (s === 'ACTIVE') return <Tag color="success" style={{ fontWeight: 600, borderRadius: 10, padding: '2px 8px' }}>ACTIVE</Tag>;
        if (s === 'PROSPECT') return <Tag color="processing" style={{ fontWeight: 600, borderRadius: 10, padding: '2px 8px' }}>PROSPECT</Tag>;
        return <Tag color="default" style={{ fontWeight: 500, borderRadius: 10, padding: '2px 8px' }}>{s}</Tag>;
      }
    },
    { 
      title: 'Action', 
      key: 'action', 
      width: 120,
      align: 'center' as const,
      render: (_: any, record: any) => {
        return (
          <Space size={6}>
            <Tooltip title="View Detail">
              <Button 
                type="text" 
                size="small"
                icon={<EyeOutlined style={{ color: '#2563eb' }} />} 
                onClick={() => openDetailDrawer(record)} 
                style={{ backgroundColor: '#eff6ff', borderRadius: 6 }}
              />
            </Tooltip>
            
            {isCanEdit && (
              <Tooltip title="Edit Customer">
                <Button 
                  type="text" 
                  size="small"
                  icon={<EditOutlined style={{ color: '#d97706' }} />} 
                  onClick={() => openEditModal(record)} 
                  style={{ backgroundColor: '#fef3c7', borderRadius: 6 }}
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
              >
                <Tooltip title="Delete Customer">
                  <Button 
                    type="text" 
                    danger 
                    size="small"
                    icon={<DeleteOutlined style={{ color: '#dc2626' }} />} 
                    style={{ backgroundColor: '#fef2f2', borderRadius: 6 }}
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
    <div style={{ 
      background: '#ffffff', 
      borderRadius: '16px', 
      padding: '24px', 
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02)',
      border: '1px solid #f1f5f9',
      minHeight: '80vh' 
    }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space direction="vertical" size={2}>
            <Space align="center" size={8}>
              <TeamOutlined style={{ fontSize: 22, color: '#0f172a' }} />
              <Title level={4} style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
                Master Data Customer
              </Title>
            </Space>
            <Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>
              Kelola direktori pelanggan, profil perusahaan, dan penanggung jawab (PIC)
            </Text>
          </Space>
        </Col>
        <Col>
          <Space size={12} wrap>
            <Input 
              placeholder="Search Name / Company" 
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} 
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: 250, borderRadius: 8 }}
              allowClear
            />
            <Select 
              placeholder="Filter Sector" 
              style={{ width: 160 }} 
              onChange={handleSectorFilter}
              allowClear
              dropdownStyle={{ borderRadius: 8 }}
            >
              <Option value="Technology">Technology</Option>
              <Option value="Finance">Finance</Option>
              <Option value="Healthcare">Healthcare</Option>
              <Option value="Government">Government</Option>
              <Option value="Retail">Retail</Option>
            </Select>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={openAddModal}
              style={{
                backgroundColor: '#1677ff',
                borderColor: '#1677ff',
                borderRadius: 8,
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(22, 119, 255, 0.2)'
              }}
            >
              Input Customer
            </Button>
          </Space>
        </Col>
      </Row>

      <Table 
        columns={columns} 
        dataSource={customers} 
        rowKey="id" 
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: totalCustomers,
          showSizeChanger: true,
          showTotal: (total, range) => `Menampilkan ${range[0]}-${range[1]} dari ${total} customer`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 1200 }}
        rowClassName={() => 'customer-table-row'}
        locale={{
          emptyText: (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={4}>
                  <Text strong style={{ color: '#475569' }}>Tidak ada data customer</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>Gunakan tombol "Add Customer" di atas untuk menambahkan data baru.</Text>
                </Space>
              }
              style={{ margin: '32px 0' }}
            />
          )
        }}
      />

      <style>{`
        .customer-table-row:hover > td {
          background-color: #f8fafc !important;
          cursor: pointer;
        }
        .customer-table-row > td {
          border-bottom: 1px solid #f1f5f9;
          padding: 12px 16px !important;
          vertical-align: middle !important;
        }
        .ant-table-thead > tr > th {
          background-color: #102A43 !important;
          color: #ffffff !important;
          font-weight: 600 !important;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          padding: 12px 16px !important;
          vertical-align: middle !important;
        }
        .ant-table-thead > tr > th::before {
          display: none !important;
        }
        .ant-table {
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
      `}</style>

      {isModalVisible && (
        <Modal 
          title={
            <Space align="center" size={8}>
              <UserAddOutlined style={{ color: '#1677ff', fontSize: 18 }} />
              <Text strong style={{ fontSize: 16, color: '#0f172a' }}>
                Create New Customer
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

      {/* Redesigned Customer Detail Drawer */}
      {isDrawerVisible && (
        <Drawer 
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TeamOutlined style={{ color: '#2563eb', fontSize: 16 }} />
              <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Customer Details</span>
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
                Copy Info
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
              {/* 1. CUSTOMER IDENTITY HEADER */}
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
                      <Tag 
                        color={getStatusColor(detailCustomer.status)} 
                        style={{ borderRadius: 6, fontWeight: 700, fontSize: 11, padding: '2px 8px', margin: 0 }}
                      >
                        {detailCustomer.status?.toUpperCase() || 'UNKNOWN'}
                      </Tag>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: '#475569', fontSize: 13, fontWeight: 500 }}>
                      <BankOutlined style={{ color: '#64748b' }} />
                      <span style={{ wordBreak: 'break-word' }}>{detailCustomer.company || 'Perusahaan Belum Terdaftar'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <Text code style={{ fontSize: 11, background: '#f1f5f9', color: '#334155', fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>
                        {detailCustomer.code}
                      </Text>
                      {detailCustomer.business_sector && (
                        <Tag color="blue" style={{ borderRadius: 4, fontSize: 11, margin: 0, border: 'none', background: '#eff6ff', color: '#1d4ed8' }}>
                          {detailCustomer.business_sector}
                        </Tag>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. TABS SECTION */}
              <Tabs 
                defaultActiveKey="overview"
                className="customer-detail-tabs"
                items={[
                  {
                    key: 'overview',
                    label: <span style={{ fontWeight: 600 }}><AppstoreOutlined /> Overview</span>,
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
                              <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{detailCustomer.code || '-'}</Text>
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
                                  <a href={`tel:${detailCustomer.phone}`} style={{ fontSize: 13, color: '#2563eb', fontWeight: 600 }}>
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

                        {/* Tender Activity Summary KPI */}
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
                    label: <span style={{ fontWeight: 600 }}><PhoneOutlined /> Contacts</span>,
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
                                  <a href={`tel:${detailCustomer.phone}`} style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>{detailCustomer.phone}</a>
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
                    label: <span style={{ fontWeight: 600 }}><TrophyOutlined /> Activity</span>,
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
                                    <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 2 }}>
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
                    label: <span style={{ fontWeight: 600 }}><FileTextOutlined /> Notes</span>,
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
