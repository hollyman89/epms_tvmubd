import React, { useState, useEffect, useCallback } from 'react';
import { Typography, List, Badge, Button, Empty, Spin, message, theme, Tag } from 'antd';
import { CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/id';
import { useSocket } from '@/context/SocketProvider';
import { setupInboxSync } from '@/lib/notificationSync';

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
  const { notificationSocket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const getAuthToken = () => localStorage.getItem('access_token') || '';

  const fetchNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await apiClient.get('/notifications?page=1&limit=50');
      const rawData = res.data?.data?.data || res.data?.data || [];
      const dataArray = Array.isArray(rawData) ? rawData : [];
      setNotifications(dataArray);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
      if (!silent) message.error('Gagal memuat kotak masuk.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    return setupInboxSync({
      socket: notificationSocket,
      onNewNotification: () => {
        fetchNotifications(true);
      },
      onReconnectResync: () => {
        fetchNotifications(true);
      },
    });
  }, [notificationSocket, fetchNotifications]);

  const markAsRead = async (id: number) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      message.success('Semua notifikasi telah ditandai dibaca.');
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await apiClient.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      message.success('Notifikasi berhasil dihapus.');
    } catch (error) {
      console.error('Failed to delete notification', error);
    }
  };

  const getActionButtonLabel = (action: string) => {
    switch (String(action).toUpperCase()) {
      case 'VIEW_CONTRACT':
        return 'Lihat Kontrak';
      case 'REVIEW_REVISION':
        return 'Review Revisi';
      case 'PROJECT_BOARD':
        return 'Lihat Project';
      case 'REVIEW_CONTRACT':
        return 'Review Kontrak';
      default:
        return action;
    }
  };

  const renderCategoryTag = (category?: string) => {
    if (!category) return null;
    switch (String(category).toUpperCase()) {
      case 'LEGAL':
        return <Tag color="purple" style={{ fontSize: '11px' }}>LEGAL</Tag>;
      case 'PMO':
        return <Tag color="cyan" style={{ fontSize: '11px' }}>PMO</Tag>;
      case 'SALES':
        return <Tag color="green" style={{ fontSize: '11px' }}>SALES</Tag>;
      default:
        return <Tag color="blue" style={{ fontSize: '11px' }}>{String(category).toUpperCase()}</Tag>;
    }
  };

  const renderPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    switch (String(priority).toUpperCase()) {
      case 'URGENT':
        return <Tag color="error" style={{ fontSize: '11px', fontWeight: 600 }}>URGENT</Tag>;
      case 'HIGH':
        return <Tag color="warning" style={{ fontSize: '11px', fontWeight: 600 }}>HIGH</Tag>;
      case 'NORMAL':
        return <Tag color="processing" style={{ fontSize: '11px' }}>NORMAL</Tag>;
      default:
        return null;
    }
  };

  const renderSmartMessage = (rawMessage: string, isRead: boolean) => {
    if (!rawMessage) return null;
    if (/<[a-z][\s\S]*>/i.test(rawMessage)) {
      return <span dangerouslySetInnerHTML={{ __html: rawMessage }} />;
    }
    const parts = rawMessage.split(/("[^"]+")/g);
    return (
      <span>
        {parts.map((part, index) => {
          if (part.startsWith('"') && part.endsWith('"')) {
            return (
              <strong key={index} style={{ fontWeight: 600, color: isRead ? token.colorTextSecondary : token.colorTextHeading }}>
                {part}
              </strong>
            );
          }
          if (part.includes('Catatan:')) {
            const subParts = part.split(/(Catatan:)/g);
            return (
              <span key={index}>
                {subParts.map((sub, sIdx) =>
                  sub === 'Catatan:' ? (
                    <strong key={sIdx} style={{ fontWeight: 600, color: isRead ? token.colorTextSecondary : token.colorTextHeading }}>
                      {sub}
                    </strong>
                  ) : (
                    sub
                  )
                )}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
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
          renderItem={(item) => {
            const isWon = item.metaData?.action_type === 'MARKED_WON';

            const isApprovalTask = (notif: typeof item) => {
              if (notif.metaData?.requires_approval !== true) return false;
              const actionType = String(notif.metaData?.action_type || '').toUpperCase();
              const excludedActions = [
                'DELETED',
                'UPDATED',
                'PROPOSAL_UPLOADED',
                'GRACE_PERIOD_ACTIVATED',
                'NEW_ACTIVITY',
                'MARKED_LOST',
                'MARKED_WON',
                'CREATED'
              ];
              if (actionType && excludedActions.includes(actionType)) {
                return false;
              }
              const titleLower = String(notif.title || '').toLowerCase();
              if (titleLower.includes('info sistem') || titleLower.includes('kekalahan') || titleLower.includes('tender baru')) {
                return false;
              }
              const genuineApprovalActions = [
                'GO_NOGO_SUBMITTED',
                'GO_NOGO_RESUBMITTED',
                'GO_NOGO_REQUESTED',
                'DISCOUNT_APPROVAL_REQUESTED',
                'APPROVAL_REQUESTED'
              ];
              if (actionType && genuineApprovalActions.includes(actionType)) {
                return true;
              }
              if (notif.notificationType === 'TASK') {
                return true;
              }
              if (titleLower.includes('approval') || titleLower.includes('persetujuan') || titleLower.includes('menunggu approve')) {
                return true;
              }
              return false;
            };

            const requiresApproval = isApprovalTask(item);
            const category = item.metaData?.category;
            const priority = item.metaData?.priority;
            const actionButtons: string[] = Array.isArray(item.metaData?.action_buttons)
              ? item.metaData.action_buttons
              : item.metaData?.action_buttons
              ? [item.metaData.action_buttons]
              : [];
            const targetUrl = item.metaData?.lead_id ? `/sales/tenders/${item.metaData.lead_id}` : item.actionLink;

            return (
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
                  if (targetUrl) window.location.href = targetUrl;
                }}>
                  {/* Row 1: Badges & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                    {!item.isRead && <Badge status="processing" style={{ marginRight: 4 }} />}
                    {renderCategoryTag(category)}
                    {renderPriorityBadge(priority)}
                    {isWon && (
                      <Tag color="success" style={{ fontWeight: 'bold' }}>WON</Tag>
                    )}
                    {requiresApproval && (
                      <Tag color="warning" style={{ fontWeight: 600, color: '#d97706' }}>⏳ Menunggu Approval</Tag>
                    )}
                  </div>

                  {/* Row 2: Title (Distinct Heading) */}
                  {item.title && (
                    <div style={{ marginBottom: '4px' }}>
                      <Text strong style={{ fontSize: '15px', color: item.isRead ? token.colorTextSecondary : token.colorTextHeading, display: 'block' }}>
                        {item.title}
                      </Text>
                    </div>
                  )}

                  {/* Row 3: Message Body (Smart Formatted) */}
                  <div style={{ marginBottom: '8px' }}>
                    <Text style={{ fontSize: '14px', color: item.isRead ? token.colorTextSecondary : token.colorText, lineHeight: '1.6', display: 'block' }}>
                      {renderSmartMessage(item.message, item.isRead)}
                    </Text>
                  </div>

                  {/* Row 4: Action Buttons + Timestamp */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      {actionButtons.length > 0 && actionButtons.map((btnKey, idx) => (
                        <Button
                          key={idx}
                          type="primary"
                          size="small"
                          style={{ marginRight: '8px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!item.isRead) markAsRead(item.id);
                            if (targetUrl) window.location.href = targetUrl;
                          }}
                        >
                          {getActionButtonLabel(btnKey)}
                        </Button>
                      ))}
                    </div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {dayjs(item.createdAt).fromNow()}
                    </Text>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );
};
