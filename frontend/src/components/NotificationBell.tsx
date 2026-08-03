import React, { useState, useEffect } from 'react';
import { Badge, Popover, List, Typography, Button, Spin, Empty, theme, Tabs, Tag, notification as antNotification } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/id';
import { io, Socket } from 'socket.io-client';

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('todo');
  const router = useRouter();

  // Authentication token getter (adjust according to your auth logic)
  const getAuthToken = () => localStorage.getItem('access_token') || '';

  const fetchUnreadCount = async () => {
    try {
      const res = await axios.get('http://localhost:4000/api/v1/notifications/count/unread', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const count = res.data?.data?.data?.count ?? res.data?.data?.count ?? 0;
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch unread count', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:4000/api/v1/notifications?page=1&limit=10&isRead=false', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const rawData = res.data?.data?.data || res.data?.data || [];
      const dataArray = Array.isArray(rawData) ? rawData : [];
      setNotifications(dataArray);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (getAuthToken()) {
      fetchUnreadCount();
    }
    
    // Initial fetch if open
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  useEffect(() => {
    // Set up WebSocket
    let socket: Socket | null = null;
    let handleNewNotification: ((notif: Notification) => void) | null = null;

    if (getAuthToken()) {
      socket = io("http://localhost:4000/notifications", {
        auth: {
          token: `Bearer ${getAuthToken()}`
        }
      });

      socket.on("connect", () => {
        console.log("Connected to Real-Time Notifications");
      });

      handleNewNotification = (notif: Notification) => {
        // Deduplicate logic and UI update (Silent Bell Inbox update)
        setNotifications(prev => {
          if (prev.some(n => n.id === notif.id)) return prev;
          return [notif, ...prev];
        });
        setUnreadCount(prev => prev + 1);
      };

      socket.on("new_notification", handleNewNotification);
    }

    return () => {
      if (socket) {
        if (handleNewNotification) {
          socket.off("new_notification", handleNewNotification);
        }
        socket.disconnect();
      }
    };
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await axios.patch(`http://localhost:4000/api/v1/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch(`http://localhost:4000/api/v1/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const renderNotificationItem = (item: Notification) => {
    const isWon = item.metaData?.action_type === 'MARKED_WON';
    const requiresApproval = item.metaData?.requires_approval === true;
    
    const content = (
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <Text style={{ display: 'block', fontSize: '13px', color: item.isRead ? '#64748b' : '#334155', lineHeight: '1.5' }}>
            <span dangerouslySetInnerHTML={{ __html: item.message }} />
          </Text>
          {isWon && (
            <Tag color="success" style={{ marginLeft: '8px', fontWeight: 'bold' }}>WON</Tag>
          )}
        </div>
        
        {requiresApproval && (
          <Text type="warning" style={{ fontSize: '12px', display: 'block', marginTop: '2px', fontWeight: 600, color: '#d97706' }}>
            ⏳ Menunggu Approval
          </Text>
        )}
        
        <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '6px', color: '#94a3b8' }}>
          {dayjs(item.createdAt).fromNow()}
        </Text>
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
  };

  const todoNotifications = notifications.filter(n => n.notificationType === 'TASK');
  const alertNotifications = notifications.filter(n => n.notificationType === 'ALERT' || n.notificationType === 'SYSTEM');

  const currentNotifications = activeTab === 'todo' ? todoNotifications : alertNotifications;

  const popoverContent = (
    <div style={{ width: 380, maxHeight: 650, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
  );

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
