import React, { useState, useEffect } from 'react';
import { Badge, Popover, Tabs, List, Typography, Button, Spin, Empty } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/id';

dayjs.extend(relativeTime);
dayjs.locale('id');

const { Text } = Typography;
const { TabPane } = Tabs;

interface Notification {
  id: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const NotificationInbox: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

  // Get auth token from local storage (adjust to your auth mechanism)
  const getToken = () => localStorage.getItem('access_token') || '';

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:4000/api/v1/notifications', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      // Response format: { data: { data: [] } } or similar based on interceptor
      const data = res.data?.data?.data || res.data?.data || [];
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    if (getToken()) {
      fetchNotifications();
    }
    
    // Polling every 15 seconds
    const interval = setInterval(() => {
      if (getToken()) fetchNotifications();
    }, 15000);
    
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await axios.patch(`http://localhost:4000/api/v1/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      // Optimistic update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch(`http://localhost:4000/api/v1/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const renderNotificationItem = (item: any) => {
    const isWon = item.metaData?.action_type === 'MARKED_WON';
    const requiresApproval = item.metaData?.requires_approval === true;
    
    return (
      <List.Item
        key={item.id}
        style={{
          backgroundColor: item.isRead ? 'transparent' : '#f0f5ff',
          cursor: 'pointer',
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
        onClick={() => {
          if (!item.isRead) markAsRead(item.id);
          const targetUrl = item.metaData?.lead_id ? `/sales/tenders/${item.metaData.lead_id}` : item.actionLink;
          if (targetUrl) {
            window.location.href = targetUrl; // Or router.push if router is available
          }
        }}
      >
        <div style={{ flex: 1, paddingRight: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
            <Text style={{ display: 'block', fontSize: '14px', color: item.isRead ? '#595959' : '#262626', fontWeight: item.isRead ? 'normal' : '500' }}>
              <span dangerouslySetInnerHTML={{ __html: item.message }} />
            </Text>
            {isWon && (
              <Badge count="WON" style={{ backgroundColor: '#52c41a', marginLeft: '8px' }} />
            )}
          </div>
          
          {requiresApproval && (
            <Text type="warning" style={{ fontSize: '12px', display: 'block', marginTop: '2px', fontWeight: 600, color: '#d97706' }}>
              ⏳ Menunggu Approval
            </Text>
          )}

          <Text type="secondary" style={{ fontSize: '12px' }}>
            {dayjs(item.createdAt).fromNow()}
          </Text>
        </div>
        {!item.isRead && <Badge status="processing" />}
      </List.Item>
    );
  };

  const content = (
    <div style={{ width: 350, maxHeight: 500, overflowY: 'auto' }}>
      <Tabs defaultActiveKey="1" style={{ padding: '0 16px' }}>
        <TabPane tab="Notifications" key="1">
          {loading && notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>
          ) : notifications.length === 0 ? (
            <Empty description="No new notifications" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <>
              <div style={{ textAlign: 'right', padding: '0 0 8px 0' }}>
                <Button type="link" size="small" icon={<CheckOutlined />} onClick={markAllAsRead} disabled={unreadCount === 0}>
                  Mark all as read
                </Button>
              </div>
              <List
                itemLayout="horizontal"
                dataSource={notifications}
                renderItem={renderNotificationItem}
              />
            </>
          )}
        </TabPane>
        <TabPane tab="To-Do" key="2">
          <Empty description="No pending tasks" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </TabPane>
      </Tabs>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      overlayInnerStyle={{ padding: 0 }}
    >
      <Badge count={unreadCount} overflowCount={99} size="small" style={{ cursor: 'pointer' }}>
        <BellOutlined style={{ fontSize: '20px', cursor: 'pointer', color: '#595959' }} />
      </Badge>
    </Popover>
  );
};
