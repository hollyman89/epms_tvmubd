import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Tag, Space, Modal, Form, Input, Select, message, Popconfirm, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, UserOutlined, MailOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/axios';

const { Title } = Typography;
const { Option } = Select;

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
  const queryClient = useQueryClient();
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isEditRoleModalVisible, setIsEditRoleModalVisible] = useState<boolean>(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [form] = Form.useForm();
  const [roleForm] = Form.useForm();

  const { data: rolesData, isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/admin/roles');
        const body = res.data;
        if (Array.isArray(body)) return body;
        if (Array.isArray(body?.data)) return body.data;
        return [];
      } catch (err) {
        console.error('Gagal mengambil master roles dari backend:', err);
        message.error('Gagal memuat master role dari server');
        return [];
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  const availableRoles = useMemo(() => rolesData || [], [rolesData]);

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  const { data: queryData, isLoading: loading } = useQuery<{ users: User[]; total: number }>({
    queryKey: ['admin-users', pagination.current, pagination.pageSize],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/admin/users', {
          params: { page: pagination.current, limit: pagination.pageSize },
        });
        const body = res.data;
        let userList: User[] = [];
        let totalCount = 0;

        if (Array.isArray(body)) {
          userList = body;
          totalCount = body.length;
        } else if (Array.isArray(body?.data)) {
          userList = body.data;
          totalCount = body.total ?? userList.length;
        } else if (body?.data && Array.isArray(body.data.data)) {
          userList = body.data.data;
          totalCount = body.data.total ?? userList.length;
        }

        return { users: userList, total: totalCount };
      } catch (error: any) {
        if (error.response?.status === 403) {
          message.error('Anda tidak memiliki akses (Bukan SUPER_ADMIN)');
        } else {
          message.error('Gagal mengambil data user');
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const users = queryData?.users || [];
  const totalUsers = queryData?.total || 0;

  const handleCreateUser = async (values: any) => {
    try {
      await apiClient.post('/admin/users', values);
      message.success('User berhasil dibuat');
      setIsModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Gagal membuat user');
    }
  };

  const handleUpdateRole = async (values: any) => {
    try {
      if (!selectedUserId) return;
      await apiClient.patch(`/admin/users/${selectedUserId}/roles`, values);
      message.success('Role berhasil diperbarui');
      setIsEditRoleModalVisible(false);
      setSelectedUserId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error: any) {
      message.error('Gagal memperbarui role');
    }
  };

  const handleDeleteUser = useCallback(async (id: number) => {
    try {
      await apiClient.delete(`/admin/users/${id}`);
      message.success('User berhasil dihapus (Soft Delete)');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error: any) {
      message.error('Gagal menghapus user');
    }
  }, [queryClient]);

  const columns = useMemo(() => [
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
  ], [handleDeleteUser, roleForm]);

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
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: totalUsers,
          showSizeChanger: true,
          onChange: (page, pageSize) => {
            setPagination({ current: page, pageSize: pageSize || 10 });
          },
        }}
        scroll={{ x: 800 }}
      />

      {/* Modal Tambah User (Lazy Mount) */}
      {isModalVisible && (
        <Modal
          title="Buat User Baru"
          open={isModalVisible}
          destroyOnClose
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
              <Select 
                placeholder={rolesLoading ? "Memuat master role..." : "Pilih Role"}
                loading={rolesLoading}
                disabled={rolesLoading || availableRoles.length === 0}
              >
                {availableRoles.map(r => (
                  <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* Modal Edit Role (Lazy Mount) */}
      {isEditRoleModalVisible && (
        <Modal
          title="Ubah Role User"
          open={isEditRoleModalVisible}
          destroyOnClose
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
              <Select 
                placeholder={rolesLoading ? "Memuat master role..." : "Pilih Role"}
                loading={rolesLoading}
                disabled={rolesLoading || availableRoles.length === 0}
              >
                {availableRoles.map(r => (
                  <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  );
};
