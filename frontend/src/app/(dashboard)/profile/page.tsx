"use client";

import React, { useState, useEffect } from 'react';
import { Typography, Card, Avatar, Descriptions, Button, Modal, Form, Input, message } from 'antd';
import { UserOutlined, EditOutlined, LockOutlined, MailOutlined, IdcardOutlined } from '@ant-design/icons';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/axios';

const { Title } = Typography;

export default function ProfilePage() {
  const { user, login } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (isModalOpen) {
      form.setFieldsValue({
        email: user?.email,
        fullName: user?.fullName,
        password: '',
      });
    }
  }, [isModalOpen, user, form]);

  const handleEditClick = () => {
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const handleUpdate = async (values: any) => {
    try {
      setLoading(true);
      // Remove empty password so it doesn't try to hash an empty string
      const payload: any = {
        email: values.email,
        fullName: values.fullName,
      };
      if (values.password && values.password.trim() !== '') {
        payload.password = values.password;
      }

      const res = await apiClient.put('/auth/profile', payload);
      
      // Update Context & LocalStorage with new token and user data
      const responseData = res.data.data || res.data;
      login(responseData.access_token, responseData.user);
      
      message.success('Profil berhasil diperbarui!');
      setIsModalOpen(false);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message;
      const msg = Array.isArray(errorMsg) ? errorMsg[0] : (errorMsg || 'Gagal memperbarui profil.');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'GENERAL_MANAGER', 'PROJECT_MANAGER', 'FINANCE', 'DIRECTOR', 'MANAGER', 'MARKETING']}>
      <div>
        <Card 
          title={<span style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>Profil Saya</span>}
          bordered={false} 
          style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
          extra={<Button type="primary" icon={<EditOutlined />} onClick={handleEditClick} style={{ background: '#0ea5e9', borderRadius: '8px' }}>Edit Profil</Button>}
        >
          <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', minWidth: '200px' }}>
              <Avatar size={130} icon={<UserOutlined />} style={{ backgroundColor: '#3b82f6', marginBottom: '20px', border: '4px solid #f1f5f9' }} />
              <Title level={4} style={{ margin: '0 0 8px 0', color: '#0f172a' }}>{user?.fullName || 'Pengguna EPMS'}</Title>
              <div style={{ color: '#0ea5e9', fontWeight: 600, letterSpacing: '0.5px' }}>{user?.roles?.[0]?.replace('_', ' ') || 'Pengguna'}</div>
            </div>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <Descriptions title={<span style={{ color: '#475569', fontSize: '15px' }}>Informasi Akun</span>} bordered column={1} size="middle" labelStyle={{ background: '#f8fafc', color: '#64748b', fontWeight: 500, width: '150px' }} contentStyle={{ color: '#1e293b', fontWeight: 500 }}>
                <Descriptions.Item label="Nama Lengkap">{user?.fullName || '-'}</Descriptions.Item>
                <Descriptions.Item label="Email">{user?.email}</Descriptions.Item>
                <Descriptions.Item label="Hak Akses (Role)">{user?.roles?.join(', ')}</Descriptions.Item>
                <Descriptions.Item label="Status Akun"><span style={{ color: '#10b981', background: '#d1fae5', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>Aktif</span></Descriptions.Item>
              </Descriptions>
            </div>
          </div>
        </Card>

        {isModalOpen && (
          <Modal
            title="Edit Profil Saya"
            open={isModalOpen}
            onOk={() => form.submit()}
            onCancel={handleCancel}
            confirmLoading={loading}
            okText="Simpan Perubahan"
            cancelText="Batal"
            okButtonProps={{ style: { background: '#0ea5e9', borderRadius: '8px' } }}
            cancelButtonProps={{ style: { borderRadius: '8px' } }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleUpdate}
              style={{ marginTop: 24 }}
            >
              <Form.Item
                name="fullName"
                label="Nama Lengkap"
                rules={[{ required: true, message: 'Masukkan nama lengkap Anda!' }]}
              >
                <Input prefix={<IdcardOutlined style={{ color: '#94a3b8' }} />} placeholder="Ketik nama lengkap" style={{ borderRadius: '8px', height: '40px' }} />
              </Form.Item>

              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Masukkan email Anda!' },
                  { type: 'email', message: 'Format email tidak valid!' }
                ]}
              >
                <Input prefix={<MailOutlined style={{ color: '#94a3b8' }} />} placeholder="email@epms.com" style={{ borderRadius: '8px', height: '40px' }} />
              </Form.Item>

              <Form.Item
                name="password"
                label="Ganti Password (Opsional)"
                rules={[
                  { min: 6, message: 'Password minimal 6 karakter' }
                ]}
                extra={<span style={{ fontSize: '12px', color: '#94a3b8' }}>Biarkan kosong jika tidak ingin mengubah password.</span>}
              >
                <Input.Password prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="Password baru" style={{ borderRadius: '8px', height: '40px' }} />
              </Form.Item>
            </Form>
          </Modal>
        )}
      </div>
    </ProtectedRoute>
  );
}
