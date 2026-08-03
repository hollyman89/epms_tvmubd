'use client';

import React, { useState, useEffect } from 'react';
import { Card, Tag, Typography, Space, Button, Table, Modal, message, Popconfirm, Badge, Tooltip } from 'antd';
import {
  DesktopOutlined,
  MobileOutlined,
  GlobalOutlined,
  LogoutOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Text } = Typography;

export interface UserSessionItem {
  id: number;
  device_id: string;
  ip_address: string;
  user_agent: string;
  last_activity: string;
  is_active: boolean;
}

export const UserSessionManagerUI: React.FC = () => {
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get('http://localhost:4000/api/v1/auth/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.data) {
        setSessions(res.data.data);
      }
    } catch (err) {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: number) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`http://localhost:4000/api/v1/auth/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success(`Sesi #${sessionId} berhasil dicabut (revoked)!`);
      fetchSessions();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Gagal mencabut sesi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeAllOthers = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete('http://localhost:4000/api/v1/auth/sessions/all-others', {
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success('Seluruh sesi perangkat lain berhasil dicabut!');
      fetchSessions();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Gagal mencabut sesi perangkat lain');
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    {
      title: 'Perangkat / Browser',
      key: 'device',
      render: (_: any, record: UserSessionItem) => {
        const isMobile = /iphone|android|mobile/i.test(record.user_agent);
        return (
          <Space>
            {isMobile ? <MobileOutlined style={{ color: '#0284c7', fontSize: 16 }} /> : <DesktopOutlined style={{ color: '#10b981', fontSize: 16 }} />}
            <div>
              <Text strong style={{ fontSize: 12, display: 'block' }}>{record.device_id || 'Browser Session'}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{record.user_agent.substring(0, 45)}...</Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Alamat IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (ip: string) => (
        <Tag icon={<GlobalOutlined />} color="blue">
          {ip}
        </Tag>
      ),
    },
    {
      title: 'Aktivitas Terakhir',
      dataIndex: 'last_activity',
      key: 'last_activity',
      render: (dateStr: string) => (
        <Space size={4}>
          <ClockCircleOutlined style={{ color: '#9ca3af' }} />
          <Text style={{ fontSize: 12 }}>{new Date(dateStr).toLocaleString('id-ID')}</Text>
        </Space>
      ),
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: any, record: UserSessionItem) => (
        <Popconfirm
          title="Cabut Sesi Perangkat Ini?"
          description="Sesi perangkat ini akan langsung di-logout secara paksa."
          onConfirm={() => handleRevokeSession(record.id)}
          okText="Ya, Cabut"
          cancelText="Batal"
        >
          <Button type="primary" danger ghost size="small" icon={<LogoutOutlined />}>
            Cabut Sesi
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <SafetyCertificateOutlined style={{ color: '#10b981', fontSize: 18 }} />
            <Text strong style={{ fontSize: 14 }}>Multi-Device Session & Security Manager</Text>
            <Badge count={sessions.length} overflowCount={99} style={{ backgroundColor: '#10b981' }} />
          </Space>
          <Popconfirm
            title="Cabut Seluruh Sesi Perangkat Lain?"
            description="Semua sesi di HP, Laptop, atau browser lain akan langsung di-logout paksa."
            onConfirm={handleRevokeAllOthers}
            okText="Ya, Logout Semua Perangkat Lain"
            cancelText="Batal"
          >
            <Button danger icon={<DeleteOutlined />} loading={actionLoading}>
              Cabut Semua Perangkat Lain
            </Button>
          </Popconfirm>
        </div>
      }
    >
      <Table dataSource={sessions} columns={columns} rowKey="id" loading={loading} pagination={false} />
    </Card>
  );
};
