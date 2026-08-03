import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Tag, Space, Modal, Form, Drawer, Descriptions, message, Popconfirm, Card, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import EditCustomerModal from './EditCustomerModal';

const { Option } = Select;

const BUSINESS_SECTORS = [
  'Telekomunikasi & Internet',
  'Teknologi Informasi & Software',
  'Perbankan & Keuangan',
  'Energi & Sumber Daya Mineral',
  'Konstruksi & Infrastruktur',
  'Manufaktur & Industri',
  'Transportasi & Logistik',
  'Pemerintahan & BUMN',
  'Kesehatan & Farmasi',
  'Pendidikan',
  'Properti & Real Estate',
  'Pariwisata & Perhotelan'
];

const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [marketingPics, setMarketingPics] = useState<any[]>([]);
  
  // Pagination & Filters
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState<string>('');
  const [sectorFilter, setSectorFilter] = useState<string | undefined>(undefined);

  // Modals & Drawers
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [detailCustomer, setDetailCustomer] = useState<any>(null);
  const [isCustomSector, setIsCustomSector] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [form] = Form.useForm();

  const fetchCustomers = async (page = 1, limit = 10, search = searchText, sector = sectorFilter) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const params: any = { page, limit };
      if (search) params.search = search;
      if (sector) params.sector = sector;

      const res = await axios.get('http://localhost:4000/api/v1/customers', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      const responseBody = res.data?.data || res.data;
      const customerArray = Array.isArray(responseBody) ? responseBody : (responseBody?.data || []);
      const totalCount = Array.isArray(responseBody) ? responseBody.length : (responseBody?.total || customerArray.length);
      
      setCustomers(customerArray);
      setPagination({ current: page, pageSize: limit, total: totalCount });
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketingPics = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get('http://localhost:4000/api/v1/marketing/pics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMarketingPics(res.data.data || res.data);
    } catch (error) {
      console.error('Failed to fetch marketing pics', error);
    }
  };

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
    fetchCustomers();
    fetchMarketingPics();
  }, []);

  const handleTableChange = (pag: any) => {
    fetchCustomers(pag.current, pag.pageSize);
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchCustomers(1, pagination.pageSize, value, sectorFilter);
  };

  const handleSectorFilter = (value: string) => {
    setSectorFilter(value);
    fetchCustomers(1, pagination.pageSize, searchText, value);
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    form.resetFields();
    form.setFieldsValue({
      status: userRole === 'MARKETING' ? 'PROSPECT' : 'Active'
    });
    setIsCustomSector(false);
    setIsModalVisible(true);
  };

  const openEditModal = (record: any) => {
    setSelectedCustomer(record);
    setIsEditModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setIsSubmitting(true);
      const token = localStorage.getItem('access_token');
      
      const payload: any = {
        ...values,
        business_sector: values.business_sector_select === 'Lainnya' 
          ? values.business_sector_custom 
          : values.business_sector_select,
        marketing_pic_id: values.marketing_pic_id ? Number(values.marketing_pic_id) : null
      };

      delete payload.business_sector_select;
      delete payload.business_sector_custom;
      
      if (editingCustomer) {
        await axios.patch(`http://localhost:4000/api/v1/customers/${editingCustomer.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success('Customer updated successfully');
      } else {
        await axios.post('http://localhost:4000/api/v1/customers', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success('Customer added successfully');
      }
      
      setIsModalVisible(false);
      fetchCustomers(pagination.current, pagination.pageSize);
    } catch (error: any) {
      if (error.errorFields) {
        message.error('Harap perbaiki isian form yang ditandai dengan warna merah.');
        return;
      }
      if (error.response) {
        message.error(error.response?.data?.message || 'Failed to save customer');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`http://localhost:4000/api/v1/customers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('Customer deleted successfully');
      fetchCustomers(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to delete customer');
    }
  };

  const openDetailDrawer = async (record: any) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(`http://localhost:4000/api/v1/customers/${record.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDetailCustomer(res.data.data || res.data);
      setIsDrawerVisible(true);
    } catch (error: any) {
      message.error('Failed to fetch customer details');
    }
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'Name', dataIndex: 'name', key: 'name', width: 200 },
    { title: 'Company', dataIndex: 'company', key: 'company', width: 200 },
    { title: 'Contact Person', dataIndex: 'contact_person', key: 'contact_person', width: 150 },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', width: 150 },
    { title: 'Sector', dataIndex: 'business_sector', key: 'business_sector', width: 120 },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'Active' ? 'green' : 'default'}>
          {status ? status.toUpperCase() : 'UNKNOWN'}
        </Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => {
        const roleStr = userRole ? userRole.toUpperCase() : '';
        const isSuperAdmin = roleStr === 'SUPER_ADMIN' || roleStr === 'ADMIN';
        // Marketing role is explicitly excluded from editing (View only)
        const isCanEdit = isSuperAdmin || roleStr === 'MANAGER' || roleStr === 'GENERAL_MANAGER';

        return (
          <Space size="middle">
            <Button type="text" icon={<EyeOutlined />} onClick={() => openDetailDrawer(record)} />
            
            {isCanEdit && (
              <Button type="text" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
            )}

            {isSuperAdmin && (
              <Popconfirm title="Yakin ingin menghapus customer ini? Customer yang memiliki Tender aktif tidak dapat dihapus." onConfirm={() => handleDelete(record.id)}>
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#fff', borderRadius: '12px', minHeight: '80vh' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <h2 style={{ margin: 0 }}>Master Data Customer</h2>
        </Col>
        <Col>
          <Space>
            <Input 
              placeholder="Search Name / Company" 
              prefix={<SearchOutlined />} 
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Select 
              placeholder="Filter Sector" 
              style={{ width: 150 }} 
              onChange={handleSectorFilter}
              allowClear
            >
              <Option value="Technology">Technology</Option>
              <Option value="Finance">Finance</Option>
              <Option value="Healthcare">Healthcare</Option>
              <Option value="Government">Government</Option>
              <Option value="Retail">Retail</Option>
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
              Add Customer
            </Button>
          </Space>
        </Col>
      </Row>

      <Table 
        columns={columns} 
        dataSource={customers} 
        rowKey="id" 
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        scroll={{ x: 1000 }}
      />

      <Modal 
        title={editingCustomer ? "Edit Customer" : "Add New Customer"} 
        open={isModalVisible} 
        onOk={handleModalOk} 
        onCancel={() => setIsModalVisible(false)}
        width={700}
        confirmLoading={isSubmitting}
        okText={isSubmitting ? "Menyimpan..." : (editingCustomer ? "Update" : "Save")}
        okButtonProps={{ disabled: isSubmitting }}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Customer Name" extra="Minimal 3 karakter" rules={[
                { required: true, message: 'Nama Customer wajib diisi' },
                { min: 3, message: 'Minimal 3 karakter' },
                { max: 100, message: 'Maksimal 100 karakter' }
              ]}>
                <Input placeholder="e.g. PT Teknologi Cerdas" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company" label="Legal Company" rules={[
                { required: true, message: 'Legal Company wajib diisi' },
                { min: 3, message: 'Minimal 3 karakter' },
                { max: 150, message: 'Maksimal 150 karakter' }
              ]}>
                <Input placeholder="e.g. PT Teknologi Cerdas Indonesia" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contact_person" label="Contact Person" rules={[{ required: true, message: 'Contact Person wajib diisi' }]}>
                <Input placeholder="Name of contact person" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone Number" extra="Contoh: 081234567890 atau +6281234567890 (Min. 10 digit)" rules={[
                { required: true, message: 'Nomor Telepon wajib diisi' },
                { pattern: /^(0|\+62)[0-9]+$/, message: 'Hanya angka, diawali 0 atau +62' },
                { min: 10, message: 'Minimal 10 digit' },
                { max: 15, message: 'Maksimal 15 digit' }
              ]}>
                <Input placeholder="e.g. 08123456789" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email Address" rules={[{ type: 'email', message: 'Format email tidak valid' }]}>
                <Input placeholder="email@company.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Business Sector" style={{ marginBottom: 0 }} required>
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="business_sector_select" style={{ width: isCustomSector ? '40%' : '100%', margin: 0 }} rules={[{ required: true, message: 'Harap pilih sektor' }]}>
                    <Select 
                      showSearch 
                      placeholder="Select Sector" 
                      dropdownMatchSelectWidth={false}
                      popupMatchSelectWidth={false}
                      onChange={(val) => setIsCustomSector(val === 'Lainnya')}
                    >
                      {BUSINESS_SECTORS.map(sector => (
                        <Option key={sector} value={sector}>{sector}</Option>
                      ))}
                      <Option value="Lainnya">Lainnya</Option>
                    </Select>
                  </Form.Item>
                  {isCustomSector && (
                    <Form.Item name="business_sector_custom" style={{ width: '60%', margin: 0 }} rules={[{ required: true, message: 'Harap diisi' }]}>
                      <Input placeholder="Ketik sektor lain" />
                    </Form.Item>
                  )}
                </Space.Compact>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="city" label="City">
                <Input placeholder="e.g. Jakarta" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status" initialValue="Active">
                <Select disabled={userRole === 'MARKETING'}>
                  {userRole !== 'MARKETING' && <Option value="Active">Active</Option>}
                  {userRole !== 'MARKETING' && <Option value="Inactive">Inactive</Option>}
                  <Option value="PROSPECT">PROSPECT</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="marketing_pic_id" label="Marketing PIC">
                <Select placeholder="Select PIC" allowClear>
                  {marketingPics.map(pic => (
                    <Option key={pic.id} value={pic.id}>{pic.full_name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer 
        title="Customer Details" 
        placement="right" 
        onClose={() => setIsDrawerVisible(false)} 
        open={isDrawerVisible}
        width={500}
      >
        {detailCustomer && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions title="Company Info" column={1} bordered size="small">
              <Descriptions.Item label="Code">{detailCustomer.code}</Descriptions.Item>
              <Descriptions.Item label="Name">{detailCustomer.name}</Descriptions.Item>
              <Descriptions.Item label="Legal Company">{detailCustomer.company || '-'}</Descriptions.Item>
              <Descriptions.Item label="Sector">{detailCustomer.business_sector || '-'}</Descriptions.Item>
              <Descriptions.Item label="City">{detailCustomer.city || '-'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={detailCustomer.status === 'Active' ? 'green' : 'default'}>
                  {detailCustomer.status?.toUpperCase() || 'UNKNOWN'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Descriptions title="Contact Info" column={1} bordered size="small">
              <Descriptions.Item label="Contact Person">{detailCustomer.contact_person}</Descriptions.Item>
              <Descriptions.Item label="Phone">{detailCustomer.phone}</Descriptions.Item>
              <Descriptions.Item label="Email">{detailCustomer.email}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Tenders Activity" style={{ background: '#fafafa' }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Total Tenders">
                  <strong style={{ fontSize: '1.2em' }}>{detailCustomer.tenders?.length || 0}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Won Tenders">
                  <strong style={{ fontSize: '1.2em', color: '#52c41a' }}>
                    {detailCustomer.tenders?.filter((t: any) => t.status === 'WON').length || 0}
                  </strong>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>
        )}
      </Drawer>

      <EditCustomerModal 
        visible={isEditModalOpen} 
        customer={selectedCustomer} 
        onClose={() => setIsEditModalOpen(false)} 
        onSuccess={() => fetchCustomers(pagination.current, pagination.pageSize)} 
      />
    </div>
  );
};

export default CustomersPage;
