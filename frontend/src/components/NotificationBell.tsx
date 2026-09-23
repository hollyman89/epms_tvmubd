import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge, Popover, List, Typography, Button, Spin, Empty, theme, Tabs, Tag } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/id';
import { useSocket } from '@/context/SocketProvider';
import { setupNotificationBellSync } from '@/lib/notificationSync';

dayjs.extend(relativeTime);
dayjs.locale('id');

const { Text } = Typography;
const { useToken } = theme;

interface Notification {
  id: number;
  title: string | null;
  message: string;
  notificationType: string;
  actionLink: string | null;
  isRead: boolean;
  metaData: any;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
  const { token } = useToken();
  const { notificationSocket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('todo');
  const router = useRouter();

  // Authentication token getter
  const getAuthToken = useCallback(() => localStorage.getItem('access_token') || '', []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications/count/unread');
      const count = res.data?.data?.data?.count ?? res.data?.data?.count ?? 0;
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch unread count', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/notifications?page=1&limit=10&isRead=false');
      const rawData = res.data?.data?.data || res.data?.data || [];
      const dataArray = Array.isArray(rawData) ? rawData : [];
      setNotifications(dataArray);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch unread count once on initial mount
  useEffect(() => {
    if (getAuthToken()) {
      fetchUnreadCount();
    }
  }, [fetchUnreadCount, getAuthToken]);

  // Fetch notification list only when popover opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  useEffect(() => {
    return setupNotificationBellSync({
      socket: notificationSocket,
      onNewNotification: (notif: Notification) => {
        // Deduplicate logic and UI update (Silent Bell Inbox update)
        setNotifications(prev => {
          if (prev.some(n => n.id === notif.id)) return prev;
          return [notif, ...prev];
        });
        setUnreadCount(prev => prev + 1);
      },
      onReconnectResync: () => {
        fetchUnreadCount();
        if (open) {
          fetchNotifications();
        }
      },
    });
  }, [notificationSocket, fetchUnreadCount, fetchNotifications, open]);

  const markAsRead = useCallback(async (id: number) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.patch('/notifications/read-all');
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  }, []);

  const renderNotificationItem = useCallback((item: Notification) => {
    const isWon = item.metaData?.action_type === 'MARKED_WON';

    const isApprovalTask = (notif: Notification) => {
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
    
    // Enterprise Metadata Extraction
    const category = item.metaData?.category;
    const priority = item.metaData?.priority;
    const actionButtons: string[] = Array.isArray(item.metaData?.action_buttons)
      ? item.metaData.action_buttons
      : item.metaData?.action_buttons
      ? [item.metaData.action_buttons]
      : [];

    const renderCategoryTag = () => {
      if (!category) return null;
      switch (String(category).toUpperCase()) {
        case 'LEGAL':
          return <Tag color="purple" style={{ marginRight: '4px', fontSize: '10px' }}>LEGAL</Tag>;
        case 'PMO':
          return <Tag color="cyan" style={{ marginRight: '4px', fontSize: '10px' }}>PMO</Tag>;
        case 'SALES':
          return <Tag color="green" style={{ marginRight: '4px', fontSize: '10px' }}>SALES</Tag>;
        default:
          return <Tag color="blue" style={{ marginRight: '4px', fontSize: '10px' }}>{String(category).toUpperCase()}</Tag>;
      }
    };

    const renderPriorityBadge = () => {
      if (!priority) return null;
      switch (String(priority).toUpperCase()) {
        case 'URGENT':
          return <Tag color="error" style={{ marginRight: '4px', fontSize: '10px', fontWeight: 600 }}>URGENT</Tag>;
        case 'HIGH':
          return <Tag color="warning" style={{ marginRight: '4px', fontSize: '10px', fontWeight: 600 }}>HIGH</Tag>;
        case 'NORMAL':
          return <Tag color="processing" style={{ marginRight: '4px', fontSize: '10px' }}>NORMAL</Tag>;
        default:
          return null;
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

    const renderSmartMessage = (rawMessage: string) => {
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
                <strong key={index} style={{ fontWeight: 600, color: item.isRead ? '#334155' : '#0f172a' }}>
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
                      <strong key={sIdx} style={{ fontWeight: 600, color: item.isRead ? '#334155' : '#0f172a' }}>
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

    const targetUrl = item.metaData?.lead_id ? `/sales/tenders/${item.metaData.lead_id}` : item.actionLink;

    const content = (
      <div style={{ flex: 1, width: '100%' }}>
        {/* Row 1: Badges (Category, Priority, WON, Approval) */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
          {renderCategoryTag()}
          {renderPriorityBadge()}
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
            <Text strong style={{ fontSize: '13px', color: item.isRead ? '#475569' : '#0f172a', display: 'block' }}>
              {item.title}
            </Text>
          </div>
        )}

        {/* Row 3: Message Body (Smart Formatted) */}
        <div style={{ marginBottom: '8px' }}>
          <Text style={{ display: 'block', fontSize: '12px', color: item.isRead ? '#64748b' : '#334155', lineHeight: '1.5' }}>
            {renderSmartMessage(item.message)}
          </Text>
        </div>

        {/* Row 4: Action Buttons + Timestamp */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            {actionButtons.length > 0 && actionButtons.map((btnKey, idx) => (
              <Button
                key={idx}
                type="primary"
                size="small"
                style={{ marginRight: '6px', fontSize: '11px', height: '24px', padding: '0 8px' }}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!item.isRead) {
                    await markAsRead(item.id);
                  }
                  if (targetUrl) {
                    router.push(targetUrl);
                    setOpen(false);
                  }
                }}
              >
                {getActionButtonLabel(btnKey)}
              </Button>
            ))}
          </div>
          <Text type="secondary" style={{ fontSize: '11px', color: '#94a3b8' }}>
            {dayjs(item.createdAt).fromNow()}
          </Text>
        </div>
      </div>
    );

    return (
      <List.Item
        key={item.id}
        className="notification-item"
        style={{
          backgroundColor: item.isRead ? '#ffffff' : '#f8fafc',
          cursor: 'pointer',
          padding: '16px',
          marginBottom: '8px',
          borderRadius: '8px',
          border: `1px solid ${item.isRead ? 'transparent' : '#e2e8f0'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          transition: 'all 0.2s ease',
        }}
        onClick={async () => {
          if (!item.isRead) {
            await markAsRead(item.id);
          }
          const targetUrl = item.metaData?.lead_id ? `/sales/tenders/${item.metaData.lead_id}` : item.actionLink;
          if (targetUrl) {
            router.push(targetUrl);
            setOpen(false);
          }
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = item.isRead ? '#ffffff' : '#f8fafc';
        }}
      >
        {content}
        
        {!item.isRead && (
          <div style={{ paddingLeft: '12px', paddingTop: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.1)' }} />
          </div>
        )}
      </List.Item>
    );
  }, [markAsRead, router]);

  const todoNotifications = useMemo(() => notifications.filter(n => n.notificationType === 'TASK'), [notifications]);
  const alertNotifications = useMemo(() => notifications.filter(n => n.notificationType === 'ALERT' || n.notificationType === 'SYSTEM'), [notifications]);

  const currentNotifications = useMemo(() => activeTab === 'todo' ? todoNotifications : alertNotifications, [activeTab, todoNotifications, alertNotifications]);

  const popoverContent = useMemo(() => (
    <div style={{ width: 'calc(100vw - 32px)', maxWidth: 380, maxHeight: 650, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 0 20px', borderBottom: `1px solid #f1f5f9`, backgroundColor: '#ffffff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <Text style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Inbox</Text>
          {unreadCount > 0 && <Badge count={unreadCount} style={{ backgroundColor: '#10b981', color: '#fff', fontWeight: 600, boxShadow: '0 0 0 1px #fff' }} />}
        </div>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          size="small"
          tabBarStyle={{ marginBottom: 0, borderBottom: 'none' }}
          items={[
            {
              key: 'todo',
              label: <span style={{ fontWeight: activeTab === 'todo' ? 600 : 400 }}>To-Do ({todoNotifications.length})</span>,
            },
            {
              key: 'alert',
              label: <span style={{ fontWeight: activeTab === 'alert' ? 600 : 400 }}>Notifications ({alertNotifications.length})</span>,
            }
          ]}
        />
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 200, padding: '12px 16px', backgroundColor: '#ffffff' }}>
        {loading && currentNotifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
        ) : currentNotifications.length === 0 ? (
          <Empty description="Belum ada notifikasi baru" style={{ margin: '40px 0' }} />
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={currentNotifications}
            renderItem={renderNotificationItem}
            split={false}
          />
        )}
      </div>

      {currentNotifications.length > 0 && (
        <div style={{ padding: '12px 20px', borderTop: `1px solid #f1f5f9`, textAlign: 'center', backgroundColor: '#ffffff' }}>
          <Button type="text" onClick={markAllAsRead} icon={<CheckOutlined />} style={{ color: '#3b82f6', fontWeight: 500, width: '100%', borderRadius: '6px' }}>
            Tandai semua telah dibaca
          </Button>
        </div>
      )}
    </div>
  ), [unreadCount, activeTab, todoNotifications, alertNotifications, currentNotifications, loading, renderNotificationItem, markAllAsRead]);

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      overlayInnerStyle={{ padding: 0, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
      arrow={false}
    >
      <Badge count={unreadCount} overflowCount={99} size="small" style={{ cursor: 'pointer' }}>
        <BellOutlined style={{ fontSize: '20px', cursor: 'pointer', color: token.colorTextSecondary }} />
      </Badge>
    </Popover>
  );
};
