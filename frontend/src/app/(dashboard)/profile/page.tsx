"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Avatar,
  Descriptions,
  Button,
  Modal,
  Form,
  Input,
  message,
  Table,
  Tag,
  Space,
  Popconfirm,
  Alert,
  Tooltip,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  LockOutlined,
  MailOutlined,
  IdcardOutlined,
  BellOutlined,
  ReloadOutlined,
  DeleteOutlined,
  MobileOutlined,
  DesktopOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/axios';
import { PushNotificationToggle } from '@/components/PushNotificationToggle';
import {
  fetchUserPushSubscriptions,
  deletePushSubscription,
  SanitizedPushSubscription,
  getDevicePlatform,
} from '@/lib/webPushClient';

const { Title, Text, Paragraph } = Typography;

function formatUserAgent(ua: string | null): { name: string; icon: React.ReactNode } {
  if (!ua) return { name: 'Perangkat Tidak Dikenal', icon: <DesktopOutlined /> };
  if (/Android/i.test(ua)) {
    if (/Chrome/i.test(ua)) return { name: 'Android (Google Chrome)', icon: <MobileOutlined style={{ color: '#10b981' }} /> };
    return { name: 'Android Browser', icon: <MobileOutlined style={{ color: '#10b981' }} /> };
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return { name: 'Apple iOS (Safari / PWA)', icon: <MobileOutlined style={{ color: '#0ea5e9' }} /> };
  }
  if (/Windows/i.test(ua)) {
    if (/Edg/i.test(ua)) return { name: 'Windows (Microsoft Edge)', icon: <DesktopOutlined style={{ color: '#3b82f6' }} /> };
    if (/Chrome/i.test(ua)) return { name: 'Windows (Google Chrome)', icon: <DesktopOutlined style={{ color: '#3b82f6' }} /> };
    if (/Firefox/i.test(ua)) return { name: 'Windows (Mozilla Firefox)', icon: <DesktopOutlined style={{ color: '#f97316' }} /> };
    return { name: 'Windows Desktop', icon: <DesktopOutlined style={{ color: '#3b82f6' }} /> };
  }
  if (/Macintosh/i.test(ua)) {
    if (/Chrome/i.test(ua)) return { name: 'macOS (Google Chrome)', icon: <DesktopOutlined /> };
    return { name: 'macOS (Apple Safari)', icon: <DesktopOutlined /> };
  }
  if (/Linux/i.test(ua)) return { name: 'Linux Desktop', icon: <DesktopOutlined /> };
  return { name: 'Browser Web', icon: <DesktopOutlined /> };
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export default function ProfilePage() {
  const { user, login } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Push subscriptions management
  const [subscriptions, setSubscriptions] = useState<SanitizedPushSubscription[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const loadSubscriptions = useCallback(async () => {
    try {
      setLoadingSubscriptions(true);
      const items = await fetchUserPushSubscriptions();
      setSubscriptions(items);
    } catch {
      setSubscriptions([]);
    } finally {
      setLoadingSubscriptions(false);
    }
  }, []);

  // Memoized push status change handler to prevent reference churn
  const handlePushStatusChange = useCallback(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

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
      const payload: any = {
        email: values.email,
        fullName: values.fullName,
      };
      if (values.password && values.password.trim() !== '') {
        payload.password = values.password;
      }

      const res = await apiClient.put('/auth/profile', payload);
      const responseData = res.data.data || res.data;
      login(responseData.access_token, responseData.user);

      message.success('Profil berhasil diperbarui!');
      setIsModalOpen(false);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message;
      const msg = Array.isArray(errorMsg) ? errorMsg[0] : errorMsg || 'Gagal memperbarui profil.';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubscription = async (id: number) => {
    try {
      setActionLoadingId(id);
      const res = await deletePushSubscription(id);
      if (res.success) {
        message.success('Pendaftaran perangkat berhasil dihapus.');
        loadSubscriptions();
      } else {
        message.error(res.error || 'Gagal menghapus perangkat.');
      }
    } catch (err: any) {
      message.error(err?.message || 'Terjadi kesalahan saat menghapus perangkat.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const subscriptionColumns = [
    {
      title: 'Perangkat & Browser',
      key: 'userAgent',
      render: (_: any, record: SanitizedPushSubscription) => {
        const info = formatUserAgent(record.userAgent);
        return (
          <Space>
            {info.icon}
            <div>
              <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                {info.name}
              </Text>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Origin: {record.endpointOrigin || 'https://unknown'}
              </div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Waktu Terdaftar',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (val: string) => <span style={{ fontSize: 12, color: '#475569' }}>{formatDate(val)}</span>,
    },
    {
      title: 'Terakhir Digunakan',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 170,
      render: (val: string | null) => (
        <span style={{ fontSize: 12, color: '#475569' }}>{val ? formatDate(val) : 'Belum ada pengiriman'}</span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_: any, record: SanitizedPushSubscription) =>
        record.isActive ? (
          <Tag color="success" style={{ fontSize: 11 }}>
            Aktif
          </Tag>
        ) : (
          <Tag color="default" style={{ fontSize: 11 }}>
            Nonaktif
          </Tag>
        ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 100,
      render: (_: any, record: SanitizedPushSubscription) => (
        <Popconfirm
          title="Hapus pendaftaran perangkat ini?"
          description="Perangkat ini tidak akan menerima notifikasi push lagi."
          okText="Ya, Hapus"
          cancelText="Batal"
          okButtonProps={{ danger: true, size: 'small' }}
          cancelButtonProps={{ size: 'small' }}
          onConfirm={() => handleDeleteSubscription(record.id)}
        >
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={actionLoadingId === record.id}
          >
            Hapus
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Card Profil Akun */}
        <Card
          title={<span style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>Profil Saya</span>}
          bordered={false}
          style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
          extra={
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={handleEditClick}
              style={{ background: '#0ea5e9', borderRadius: '8px' }}
            >
              Edit Profil
            </Button>
          }
        >
          <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', minWidth: '200px' }}>
              <Avatar
                size={130}
                icon={<UserOutlined />}
                style={{ backgroundColor: '#3b82f6', marginBottom: '20px', border: '4px solid #f1f5f9' }}
              />
              <Title level={4} style={{ margin: '0 0 8px 0', color: '#0f172a' }}>
                {user?.fullName || 'Pengguna EPMS'}
              </Title>
              <div style={{ color: '#0ea5e9', fontWeight: 600, letterSpacing: '0.5px' }}>
                {user?.roles?.[0]?.replace('_', ' ') || 'Pengguna'}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <Descriptions
                title={<span style={{ color: '#475569', fontSize: '15px' }}>Informasi Akun</span>}
                bordered
                column={1}
                size="middle"
                labelStyle={{ background: '#f8fafc', color: '#64748b', fontWeight: 500, width: '150px' }}
                contentStyle={{ color: '#1e293b', fontWeight: 500 }}
              >
                <Descriptions.Item label="Nama Lengkap">{user?.fullName || '-'}</Descriptions.Item>
                <Descriptions.Item label="Email">{user?.email}</Descriptions.Item>
                <Descriptions.Item label="Hak Akses (Role)">{user?.roles?.join(', ')}</Descriptions.Item>
                <Descriptions.Item label="Status Akun">
                  <span
                    style={{
                      color: '#10b981',
                      background: '#d1fae5',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                    }}
                  >
                    Aktif
                  </span>
                </Descriptions.Item>
              </Descriptions>
            </div>
          </div>
        </Card>

        {/* Card Pengaturan Notifikasi Web Push Perangkat */}
        <Card
          title={
            <Space>
              <BellOutlined style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
                Pengaturan Notifikasi Web Push Perangkat
              </span>
            </Space>
          }
          bordered={false}
          style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
          extra={
            <Tooltip title="Muat ulang daftar perangkat">
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={loadSubscriptions}
                loading={loadingSubscriptions}
              >
                Segarkan
              </Button>
            </Tooltip>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Aktivasi Perangkat Ini */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                padding: '16px 20px',
                borderRadius: 8,
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                  Status Notifikasi Perangkat Ini
                </Text>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  Aktifkan push notification pada browser HP atau komputer ini agar Anda tidak melewatkan tugas baru
                  maupun dokumen persetujuan.
                </div>
              </div>
              <div>
                <PushNotificationToggle
                  showGuideButton
                  onStatusChange={handlePushStatusChange}
                />
              </div>
            </div>

            {/* Daftar Perangkat Terdaftar */}
            <div>
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                  Perangkat Terdaftar ({subscriptions.length})
                </Text>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Daftar seluruh browser dan perangkat yang saat ini terdaftar untuk menerima push notification akun Anda:
                </div>
              </div>

              <Table
                dataSource={subscriptions}
                columns={subscriptionColumns}
                rowKey="id"
                loading={loadingSubscriptions}
                pagination={false}
                size="small"
                locale={{
                  emptyText: (
                    <div style={{ padding: '24px 0', textAlign: 'center' }}>
                      <BellOutlined style={{ fontSize: 28, color: '#cbd5e1', marginBottom: 8 }} />
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        Belum ada perangkat terdaftar untuk akun ini.
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                        Klik tombol <b>"Aktifkan Notifikasi Push"</b> di atas untuk mendaftarkan perangkat ini.
                      </div>
                    </div>
                  ),
                }}
              />
            </div>

            {/* Info Panduan Khusus Mobile */}
            <Alert
              message="Panduan Penerimaan Notifikasi di Handphone (HP)"
              description={
                <div style={{ fontSize: 12, lineHeight: 1.6, marginTop: 4 }}>
                  <div>
                    • <b>Android (Chrome):</b> Pastikan izin notifikasi pada setelan situs diizinkan. Jika menggunakan fitur hemat daya ekstrem, pastikan browser Chrome diizinkan berjalan di latar belakang.
                  </div>
                  <div style={{ marginTop: 4 }}>
                    • <b>iPhone / iPad (iOS 16.4+):</b> Buka EPMS di Safari, ketuk tombol <i>Bagikan (Share)</i>, lalu pilih <i>"Tambahkan ke Layar Utama" (Add to Home Screen)</i>. Buka aplikasi dari ikon di Layar Utama HP untuk mengaktifkan notifikasi.
                  </div>
                </div>
              }
              type="info"
              showIcon
              icon={<InfoCircleOutlined style={{ color: '#2563eb' }} />}
              style={{ borderRadius: 8 }}
            />
          </div>
        </Card>

        {/* Modal Edit Profil */}
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
            <Form form={form} layout="vertical" onFinish={handleUpdate} style={{ marginTop: 24 }}>
              <Form.Item
                name="fullName"
                label="Nama Lengkap"
                rules={[{ required: true, message: 'Masukkan nama lengkap Anda!' }]}
              >
                <Input
                  prefix={<IdcardOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Ketik nama lengkap"
                  style={{ borderRadius: '8px', height: '40px' }}
                />
              </Form.Item>

              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Masukkan email Anda!' },
                  { type: 'email', message: 'Format email tidak valid!' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="email@epms.com"
                  style={{ borderRadius: '8px', height: '40px' }}
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="Ganti Password (Opsional)"
                rules={[{ min: 6, message: 'Password minimal 6 karakter' }]}
                extra={
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Biarkan kosong jika tidak ingin mengubah password.
                  </span>
                }
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Password baru"
                  style={{ borderRadius: '8px', height: '40px' }}
                />
              </Form.Item>
            </Form>
          </Modal>
        )}
      </div>
    </ProtectedRoute>
  );
}
