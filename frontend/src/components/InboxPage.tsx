import React, { useState, useEffect } from 'react';
import { Typography, List, Badge, Button, Empty, Spin, message, theme, Tag } from 'antd';
import { CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/id';

dayjs.extend(relativeTime);
dayjs.locale('id');

const { Title, Text, Link } = Typography;
const { useToken } = theme;

interface Notification {
  id: number;
  title: string;
  message: string;
  notificationType: string;
  actionLink: string | null;
  isRead: boolean;
  metaData: any;
  createdAt: string;
}

export const InboxPage: React.FC = () => {
  const { token } = useToken();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const getAuthToken = () => localStorage.getItem('access_token') || '';

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:4000/api/v1/notifications?page=1&limit=50', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const rawData = res.data?.data?.data || res.data?.data || [];
      const dataArray = Array.isArray(rawData) ? rawData : [];
      setNotifications(dataArray);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
      message.error('Gagal memuat kotak masuk.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await axios.patch(`http://localhost:4000/api/v1/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch(`http://localhost:4000/api/v1/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      message.success('Semua notifikasi telah ditandai dibaca.');
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await axios.delete(`http://localhost:4000/api/v1/notifications/${id}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
      message.success('Notifikasi berhasil dihapus.');
    } catch (error) {
      console.error('Failed to delete notification', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 8, minHeight: '80vh', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: `1px solid ${token.colorBorderSecondary}`, paddingBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Unified Inbox</Title>
          <Text type="secondary">Pusat pemberitahuan dan tugas Anda</Text>
        </div>
        {notifications.length > 0 && unreadCount > 0 && (
          <Button type="primary" icon={<CheckOutlined />} onClick={markAllAsRead}>
            Tandai Semua Dibaca
          </Button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : notifications.length === 0 ? (
        <Empty description="Tidak ada notifikasi di kotak masuk Anda" style={{ marginTop: 50 }} />
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={notifications}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              actions={[
                <Button key="delete" type="text" danger icon={<DeleteOutlined />} onClick={() => deleteNotification(item.id)} />
              ]}
              style={{
                backgroundColor: item.isRead ? '#ffffff' : '#f0f5ff',
                padding: '16px 24px',
                borderRadius: 8,
                marginBottom: 12,
                border: `1px solid ${item.isRead ? token.colorBorderSecondary : '#adc6ff'}`,
                transition: 'all 0.3s'
              }}
            >
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => {
                if (!item.isRead) markAsRead(item.id);
                const targetUrl = item.metaData?.lead_id ? `/sales/tenders/${item.metaData.lead_id}` : item.actionLink;
                if (targetUrl) window.location.href = targetUrl;
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {!item.isRead && <Badge status="processing" style={{ marginRight: 8 }} />}
                    <Text style={{ fontSize: '15px', color: item.isRead ? token.colorTextSecondary : token.colorTextHeading }}>
                      <span dangerouslySetInnerHTML={{ __html: item.message }} />
                    </Text>
                  </div>
                  {item.metaData?.action_type === 'MARKED_WON' && (
                    <Tag color="success" style={{ fontWeight: 'bold' }}>WON</Tag>
                  )}
                </div>
                {item.metaData?.requires_approval && (
                  <Text type="warning" style={{ fontSize: '13px', display: 'block', marginTop: 4, marginLeft: item.isRead ? 0 : 16, fontWeight: 600, color: '#d97706' }}>
                    ⏳ Menunggu Approval
                  </Text>
                )}
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 8, marginLeft: item.isRead ? 0 : 16 }}>
                  {dayjs(item.createdAt).fromNow()}
                </Text>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );
};
