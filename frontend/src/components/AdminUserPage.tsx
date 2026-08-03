import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Popconfirm, Tag, Typography } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;

interface Role {
  id: number;
  name: string;
}

interface User {
  id: number;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  roles: Role[];
}

export const AdminUserPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditRoleModalVisible, setIsEditRoleModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [roleForm] = Form.useForm();

  // Assuming roles are fetched from another endpoint or hardcoded for now
  const availableRoles = [
    { id: 1, name: 'SUPER_ADMIN' },
    { id: 2, name: 'PROJECT_MANAGER' },
    { id: 3, name: 'FINANCE' },
    { id: 4, name: 'DIRECTOR' },
    { id: 5, name: 'MANAGER' },
    { id: 6, name: 'GENERAL_MANAGER' },
    { id: 7, name: 'MARKETING' },
    { id: 8, name: 'LEGAL' },
    { id: 9, name: 'PURCHASING' },
  ];

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const res = await axios.get('http://localhost:4000/api/v1/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Handle global interceptor format { data: [...] } or direct array
      const data = res.data?.data || res.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch (error: any) {
      if (error.response?.status === 403) {
        message.error('Anda tidak memiliki akses (Bukan SUPER_ADMIN)');
      } else {
        message.error('Gagal mengambil data user');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (values: any) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post('http://localhost:4000/api/v1/admin/users', values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('User berhasil dibuat');
      setIsModalVisible(false);
      form.resetFields();
      fetchUsers();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Gagal membuat user');
    }
  };

  const handleUpdateRole = async (values: any) => {
    try {
      if (!selectedUserId) return;
      const token = localStorage.getItem('access_token');
      await axios.patch(`http://localhost:4000/api/v1/admin/users/${selectedUserId}/roles`, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('Role berhasil diperbarui');
      setIsEditRoleModalVisible(false);
      setSelectedUserId(null);
      fetchUsers();
    } catch (error: any) {
      message.error('Gagal memperbarui role');
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`http://localhost:4000/api/v1/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('User berhasil dihapus (Soft Delete)');
      fetchUsers();
    } catch (error: any) {
      message.error('Gagal menghapus user');
    }
  };

  const columns = [
    {
      title: 'Nama Lengkap',
      dataIndex: 'fullName',
      key: 'fullName',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      key: 'roles',
      render: (text: string, record: User) => (
        <span>
          {record.roles?.map(role => (
            <Tag color={role.name === 'SUPER_ADMIN' ? 'red' : 'blue'} key={role.id}>
              {role.name}
            </Tag>
          ))}
        </span>
      ),
    },
    {
      title: 'Terdaftar Pada',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (text: string, record: User) => (
        <Space size="middle">
          <Button 
            type="primary" 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => {
              setSelectedUserId(record.id);
              roleForm.setFieldsValue({ roleId: record.roles?.[0]?.id });
              setIsEditRoleModalVisible(true);
            }}
          >
            Ubah Role
          </Button>
          <Popconfirm
            title="Apakah Anda yakin ingin menghapus user ini?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Ya"
            cancelText="Tidak"
          >
            <Button type="primary" danger icon={<DeleteOutlined />} size="small">
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 8, minHeight: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={3}>Manajemen User (RBAC)</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setIsModalVisible(true)}
        >
          Tambah User Baru
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={users} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* Modal Tambah User */}
      <Modal
        title="Buat User Baru"
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateUser}>
          <Form.Item 
            name="fullName" 
            label="Nama Lengkap" 
            rules={[{ required: true, message: 'Masukkan nama lengkap' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="John Doe" />
          </Form.Item>
          
          <Form.Item 
            name="email" 
            label="Email" 
            rules={[
              { required: true, message: 'Masukkan email' },
              { type: 'email', message: 'Email tidak valid' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="john@epms.com" />
          </Form.Item>

          <Form.Item 
            name="password" 
            label="Password" 
            rules={[{ required: true, message: 'Masukkan password (min 6 karakter)', min: 6 }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password123" />
          </Form.Item>

          <Form.Item 
            name="roleId" 
            label="Role" 
            rules={[{ required: true, message: 'Pilih role' }]}
          >
            <Select placeholder="Pilih Role">
              {availableRoles.map(r => (
                <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Edit Role */}
      <Modal
        title="Ubah Role User"
        open={isEditRoleModalVisible}
        onCancel={() => {
          setIsEditRoleModalVisible(false);
          setSelectedUserId(null);
        }}
        onOk={() => roleForm.submit()}
      >
        <Form form={roleForm} layout="vertical" onFinish={handleUpdateRole}>
          <Form.Item 
            name="roleId" 
            label="Pilih Role Baru" 
            rules={[{ required: true, message: 'Pilih role' }]}
          >
            <Select placeholder="Pilih Role">
              {availableRoles.map(r => (
                <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
